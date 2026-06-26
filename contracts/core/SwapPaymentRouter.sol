// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @dev Uniswap V2-compatible DEX router interface.
interface IUniswapV2Router {
    function swapExactTokensForTokens(uint256, uint256, address[] calldata, address, uint256) external returns (uint256[] memory);
    function swapExactTokensForETH(uint256, uint256, address[] calldata, address, uint256) external returns (uint256[] memory);
    function swapExactETHForTokens(uint256, address[] calldata, address, uint256) external payable returns (uint256[] memory);
}

/// @dev Minimal marketplace interface needed by this router.
interface IVeNFTMarketplace {
    struct Listing {
        address seller; address collection; uint256 tokenId;
        uint256 price; address paymentToken; uint256 createdAt; bool active;
    }
    function listings(uint256 listingId) external view returns (Listing memory);
    function buyNFT(uint256 listingId) external payable;
    function paymentRouter() external view returns (address);
}

/// @title SwapPaymentRouter
/// @notice Allows buyers to pay in any supported token regardless of listing's quoted token.
///         Swaps via a configurable Uniswap V2-compatible DEX, then calls buyNFT.
///         NFT is briefly held in this contract and forwarded to the buyer via onERC721Received.
/// @dev ReentrancyGuard protects swapAndBuy; _currentBuyer slot is safe because
///      only one call can be in-flight at a time.
contract SwapPaymentRouter is ReentrancyGuard, Pausable, IERC721Receiver {
    using SafeERC20 for IERC20;

    address public constant BTC = 0x7b7C000000000000000000000000000000000000;
    uint256 public constant MAX_SWAP_FEE_BPS  = 100;   // 1%
    uint256 public constant MAX_SLIPPAGE_BPS  = 1000;  // 10%
    uint256 public constant DEADLINE_WINDOW   = 5 minutes;

    address public admin;
    address public dexRouter;
    address public wbtc;
    address public marketplace;
    uint256 public platformFeeSwapBps;
    address public feeRecipient;

    /// @dev Tracks the real buyer across the NFT receive callback. Protected by nonReentrant.
    address private _currentBuyer;

    event SwapAndPurchase(uint256 indexed listingId, address indexed buyer, address payToken, uint256 amountIn, address quoteToken, uint256 amountOut, uint256 swapFee);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event DexRouterSet(address indexed router);
    event WbtcSet(address indexed wbtc);
    event MarketplaceSet(address indexed marketplace);
    event SwapFeeUpdated(uint256 oldBps, uint256 newBps);
    event FeeRecipientUpdated(address indexed old, address indexed next);

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error NoDexRouter();
    error SlippageTooHigh(uint256 requested, uint256 max);
    error InsufficientOutput(uint256 received, uint256 minimum);
    error RefundFailed();

    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }

    /// @notice Deploy SwapPaymentRouter
    constructor(address _admin, address _feeRecipient, address _marketplace, uint256 _feeBps) {
        if (_admin == address(0) || _feeRecipient == address(0) || _marketplace == address(0)) revert InvalidAddress();
        if (_feeBps > MAX_SWAP_FEE_BPS) revert SlippageTooHigh(_feeBps, MAX_SWAP_FEE_BPS);
        admin = _admin; feeRecipient = _feeRecipient; marketplace = _marketplace; platformFeeSwapBps = _feeBps;
    }

    function setDexRouter(address _r) external onlyAdmin { if (_r == address(0)) revert InvalidAddress(); dexRouter = _r; emit DexRouterSet(_r); }
    function setWbtc(address _w) external onlyAdmin { if (_w == address(0)) revert InvalidAddress(); wbtc = _w; emit WbtcSet(_w); }
    function setMarketplace(address _m) external onlyAdmin { if (_m == address(0)) revert InvalidAddress(); marketplace = _m; emit MarketplaceSet(_m); }
    function setSwapFee(uint256 _bps) external onlyAdmin { if (_bps > MAX_SWAP_FEE_BPS) revert SlippageTooHigh(_bps, MAX_SWAP_FEE_BPS); uint256 old = platformFeeSwapBps; platformFeeSwapBps = _bps; emit SwapFeeUpdated(old, _bps); }
    function setFeeRecipient(address _r) external onlyAdmin { if (_r == address(0)) revert InvalidAddress(); address old = feeRecipient; feeRecipient = _r; emit FeeRecipientUpdated(old, _r); }
    function transferAdmin(address _a) external onlyAdmin { if (_a == address(0)) revert InvalidAddress(); address old = admin; admin = _a; emit AdminTransferred(old, _a); }
    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    /// @notice Buy a listed veNFT using any supported token.
    /// @param listingId    Marketplace listing ID
    /// @param buyToken     Token the buyer pays with (BTC address = native)
    /// @param maxAmountIn  Max amount of buyToken to spend
    /// @param amountOutMin Min quote token from DEX (slippage cap)
    /// @param maxSlippageBps Additional slippage check (0 = rely on amountOutMin only)
    function swapAndBuy(
        uint256 listingId,
        address buyToken,
        uint256 maxAmountIn,
        uint256 amountOutMin,
        uint256 maxSlippageBps
    ) external payable whenNotPaused nonReentrant {
        if (dexRouter == address(0)) revert NoDexRouter();
        if (buyToken == address(0) || maxAmountIn == 0) revert InvalidAmount();
        if (maxSlippageBps > MAX_SLIPPAGE_BPS) revert SlippageTooHigh(maxSlippageBps, MAX_SLIPPAGE_BPS);

        IVeNFTMarketplace.Listing memory listing = IVeNFTMarketplace(marketplace).listings(listingId);
        address quoteToken = listing.paymentToken;
        uint256 required   = listing.price;
        if (required == 0) revert InvalidAmount();

        _currentBuyer = msg.sender;

        if (buyToken == quoteToken) {
            // Same token — no swap needed
            if (quoteToken == BTC) {
                if (msg.value < required) revert InvalidAmount();
                IVeNFTMarketplace(marketplace).buyNFT{value: required}(listingId);
                uint256 excess = msg.value - required;
                if (excess > 0) { (bool ok,) = payable(msg.sender).call{value: excess}(""); if (!ok) revert RefundFailed(); }
            } else {
                IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), required);
                IERC20(quoteToken).forceApprove(IVeNFTMarketplace(marketplace).paymentRouter(), required);
                IVeNFTMarketplace(marketplace).buyNFT(listingId);
            }
            emit SwapAndPurchase(listingId, msg.sender, buyToken, required, quoteToken, required, 0);
        } else {
            uint256 fee = (maxAmountIn * platformFeeSwapBps) / 10000;
            uint256 netIn = maxAmountIn - fee;

            uint256 actualOut = _swap(buyToken, quoteToken, netIn, amountOutMin, maxSlippageBps, required);

            if (fee > 0) {
                if (buyToken == BTC) { (bool ok,) = payable(feeRecipient).call{value: fee}(""); if (!ok) revert RefundFailed(); }
                else IERC20(buyToken).safeTransferFrom(msg.sender, feeRecipient, fee);
            }

            if (quoteToken == BTC) {
                IVeNFTMarketplace(marketplace).buyNFT{value: required}(listingId);
                uint256 surplus = actualOut - required;
                if (surplus > 0) { (bool ok,) = payable(msg.sender).call{value: surplus}(""); if (!ok) revert RefundFailed(); }
            } else {
                IERC20(quoteToken).forceApprove(IVeNFTMarketplace(marketplace).paymentRouter(), required);
                IVeNFTMarketplace(marketplace).buyNFT(listingId);
                // Refund only THIS swap's surplus (actualOut - required), not the
                // contract's full quoteToken balance — a full-balance refund would
                // sweep any residual/donated quoteToken to whoever calls next.
                uint256 surplus = actualOut - required;
                if (surplus > 0) IERC20(quoteToken).safeTransfer(msg.sender, surplus);
            }

            emit SwapAndPurchase(listingId, msg.sender, buyToken, maxAmountIn, quoteToken, actualOut, fee);
        }

        _currentBuyer = address(0);

        // Refund any unspent native BTC (overpayment). For buyToken == BTC the
        // function spends at most maxAmountIn (netIn swapped + fee); without this
        // refund msg.value - amountSpent would be permanently stuck (there is no
        // BTC sweep). Cleared _currentBuyer first (CEI) so the external call cannot
        // re-enter a settlement callback with buyer context.
        if (buyToken == BTC) {
            uint256 leftover = address(this).balance;
            if (leftover > 0) {
                (bool ok, ) = payable(msg.sender).call{value: leftover}("");
                if (!ok) revert RefundFailed();
            }
        }
    }

    /// @notice ERC-721 receive hook — immediately forwards NFT to the real buyer.
    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external override returns (bytes4) {
        address buyer = _currentBuyer;
        if (buyer != address(0)) IERC721(msg.sender).safeTransferFrom(address(this), buyer, tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function _swap(address buyToken, address quoteToken, uint256 amountIn, uint256 amountOutMin, uint256 /*maxSlippageBps*/, uint256 required) internal returns (uint256 actualOut) {
        // The DEX output must cover at least the listing price. Slippage tolerance
        // may widen the INPUT the buyer spends, but the OUTPUT floor is always
        // `required`: a sub-`required` output would swap successfully and then
        // revert at settlement (buyNFT needs exactly `required`), burning the
        // buyer's swap. Enforce amountOutMin >= required up-front.
        uint256 floor = required;
        if (amountOutMin < floor) revert InsufficientOutput(amountOutMin, floor);

        address r = dexRouter;
        uint256 deadline = block.timestamp + DEADLINE_WINDOW;

        if (buyToken == BTC) {
            if (msg.value < amountIn) revert InvalidAmount();
            uint256[] memory amounts = IUniswapV2Router(r).swapExactETHForTokens{value: amountIn}(amountOutMin, _path(wbtc, quoteToken), address(this), deadline);
            actualOut = amounts[amounts.length - 1];
        } else if (quoteToken == BTC) {
            IERC20(buyToken).safeTransferFrom(msg.sender, address(this), amountIn);
            IERC20(buyToken).forceApprove(r, amountIn);
            uint256[] memory amounts = IUniswapV2Router(r).swapExactTokensForETH(amountIn, amountOutMin, _path(buyToken, wbtc), address(this), deadline);
            actualOut = amounts[amounts.length - 1];
        } else {
            IERC20(buyToken).safeTransferFrom(msg.sender, address(this), amountIn);
            IERC20(buyToken).forceApprove(r, amountIn);
            uint256[] memory amounts = IUniswapV2Router(r).swapExactTokensForTokens(amountIn, amountOutMin, _path(buyToken, quoteToken), address(this), deadline);
            actualOut = amounts[amounts.length - 1];
        }

        if (actualOut < amountOutMin) revert InsufficientOutput(actualOut, amountOutMin);
    }

    function _path(address a, address b) internal view returns (address[] memory p) {
        address w = wbtc;
        if (w != address(0) && a != w && b != w) {
            p = new address[](3); p[0] = a; p[1] = w; p[2] = b;
        } else {
            p = new address[](2); p[0] = a; p[1] = b;
        }
    }

    receive() external payable {}
}
