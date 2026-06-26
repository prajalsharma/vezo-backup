// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @dev Velodrome-v2 (Solidly) pool — Mezo's on-chain DEX uses this, NOT Uniswap.
///      getAmountOut already nets the pool fee; swap() is the low-level primitive
///      (tokens must be transferred IN before calling, like Uniswap-V2 pairs).
interface IVeloPool {
    function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
    function token0() external view returns (address);
    function token1() external view returns (address);
}

/// @dev Velodrome-v2 PoolFactory — resolves the canonical pool for a token pair.
interface IVeloPoolFactory {
    function getPool(address tokenA, address tokenB, bool stable) external view returns (address);
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
/// @notice Lets a buyer pay for an ERC-20-quoted listing using a DIFFERENT token,
///         swapping through Mezo's Velodrome-v2 DEX (pool-direct, no router) and
///         then calling the existing marketplace's buyNFT(). The NFT is briefly
///         received here and forwarded to the buyer via onERC721Received.
///
/// @dev Scope (v1): the listing's quote token must be an ERC-20 (e.g. MUSD). The
///      buyer's pay token must have a Velodrome pool to that quote token — on Mezo
///      mainnet that means BTC (BTC is a real ERC-20 at 0x7b7C…0000), mUSDC, mUSDT.
///      MEZO has no DEX pool and cannot be swapped. BTC-quoted listings settle
///      natively in the marketplace and are out of scope for this swap path.
///
///      No API key or off-chain service is required — quotes and swaps are 100%
///      on-chain. The buyer pays gas; the protocol holds no inventory.
contract SwapPaymentRouter is ReentrancyGuard, Pausable, IERC721Receiver {
    using SafeERC20 for IERC20;

    /// @notice Native BTC sentinel (also a real ERC-20 on Mezo). Not a valid quote
    ///         token for this swap path (marketplace settles BTC natively).
    address public constant BTC = 0x7b7C000000000000000000000000000000000000;
    uint256 public constant MAX_SWAP_FEE_BPS = 100; // 1%

    address public admin;
    IVeloPoolFactory public poolFactory;
    address public marketplace;
    uint256 public platformFeeSwapBps;
    address public feeRecipient;

    /// @dev Tracks the real buyer across the NFT receive callback. Protected by nonReentrant.
    address private _currentBuyer;

    event SwapAndPurchase(
        uint256 indexed listingId, address indexed buyer,
        address payToken, uint256 amountIn, address quoteToken, uint256 amountOut, uint256 swapFee
    );
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event PoolFactorySet(address indexed factory);
    event MarketplaceSet(address indexed marketplace);
    event SwapFeeUpdated(uint256 oldBps, uint256 newBps);
    event FeeRecipientUpdated(address indexed old, address indexed next);

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error NoPoolFactory();
    error NoPool(address tokenIn, address tokenOut);
    error UnsupportedQuoteToken();
    error SameToken();
    error InsufficientOutput(uint256 received, uint256 minimum);
    error FeeTooHigh(uint256 requested, uint256 max);

    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }

    constructor(address _admin, address _feeRecipient, address _marketplace, address _poolFactory, uint256 _feeBps) {
        if (_admin == address(0) || _feeRecipient == address(0) || _marketplace == address(0)) revert InvalidAddress();
        if (_feeBps > MAX_SWAP_FEE_BPS) revert FeeTooHigh(_feeBps, MAX_SWAP_FEE_BPS);
        admin = _admin;
        feeRecipient = _feeRecipient;
        marketplace = _marketplace;
        poolFactory = IVeloPoolFactory(_poolFactory); // may be zero until configured
        platformFeeSwapBps = _feeBps;
    }

    function setPoolFactory(address _f) external onlyAdmin { if (_f == address(0)) revert InvalidAddress(); poolFactory = IVeloPoolFactory(_f); emit PoolFactorySet(_f); }
    function setMarketplace(address _m) external onlyAdmin { if (_m == address(0)) revert InvalidAddress(); marketplace = _m; emit MarketplaceSet(_m); }
    function setSwapFee(uint256 _bps) external onlyAdmin { if (_bps > MAX_SWAP_FEE_BPS) revert FeeTooHigh(_bps, MAX_SWAP_FEE_BPS); uint256 o = platformFeeSwapBps; platformFeeSwapBps = _bps; emit SwapFeeUpdated(o, _bps); }
    function setFeeRecipient(address _r) external onlyAdmin { if (_r == address(0)) revert InvalidAddress(); address o = feeRecipient; feeRecipient = _r; emit FeeRecipientUpdated(o, _r); }
    function transferAdmin(address _a) external onlyAdmin { if (_a == address(0)) revert InvalidAddress(); address o = admin; admin = _a; emit AdminTransferred(o, _a); }
    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    /// @notice Buy an ERC-20-quoted listing by paying with a different ERC-20 token,
    ///         swapping through Velodrome.
    /// @param listingId    Marketplace listing ID
    /// @param payToken     Token the buyer pays with (must have a Velodrome pool to the quote token)
    /// @param maxAmountIn  Max payToken to spend (swap input + swap fee)
    /// @param amountOutMin Minimum quote-token out from the swap (slippage guard); must be >= price
    /// @param stable       Whether to route through the stable or volatile Velodrome pool
    function swapAndBuy(
        uint256 listingId,
        address payToken,
        uint256 maxAmountIn,
        uint256 amountOutMin,
        bool stable
    ) external whenNotPaused nonReentrant {
        if (address(poolFactory) == address(0)) revert NoPoolFactory();
        if (payToken == address(0) || maxAmountIn == 0) revert InvalidAmount();

        IVeNFTMarketplace.Listing memory listing = IVeNFTMarketplace(marketplace).listings(listingId);
        address quoteToken = listing.paymentToken;
        uint256 required   = listing.price;
        if (required == 0) revert InvalidAmount();
        // v1 settles the marketplace leg in ERC-20; BTC-quoted listings use the
        // marketplace's native path and are not supported here.
        if (quoteToken == BTC) revert UnsupportedQuoteToken();
        if (payToken == quoteToken) revert SameToken(); // no swap needed — use a direct buy

        _currentBuyer = msg.sender;

        // Pull the full budget, skim the platform swap fee, swap the remainder.
        uint256 fee = (maxAmountIn * platformFeeSwapBps) / 10000;
        uint256 netIn = maxAmountIn - fee;
        IERC20(payToken).safeTransferFrom(msg.sender, address(this), maxAmountIn);
        if (fee > 0) IERC20(payToken).safeTransfer(feeRecipient, fee);

        uint256 actualOut = _swap(payToken, quoteToken, netIn, amountOutMin, required, stable);

        // Settle the marketplace purchase in the quote token (ERC-20 path).
        IERC20(quoteToken).forceApprove(IVeNFTMarketplace(marketplace).paymentRouter(), required);
        IVeNFTMarketplace(marketplace).buyNFT(listingId);

        // Refund only THIS swap's surplus (actualOut - required), never the full balance.
        uint256 surplus = actualOut - required;
        if (surplus > 0) IERC20(quoteToken).safeTransfer(msg.sender, surplus);

        emit SwapAndPurchase(listingId, msg.sender, payToken, maxAmountIn, quoteToken, actualOut, fee);
        _currentBuyer = address(0);
    }

    /// @dev Velodrome pool-direct swap: quote via getAmountOut (already fee-netted),
    ///      transfer input to the pool, then call the low-level swap().
    function _swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 required,
        bool stable
    ) internal returns (uint256 actualOut) {
        // The swap must yield at least the listing price; slippage may widen the
        // INPUT, never reduce the OUTPUT below `required` (a short output would buy
        // a position the marketplace leg can't settle).
        if (amountOutMin < required) revert InsufficientOutput(amountOutMin, required);

        address pool = poolFactory.getPool(tokenIn, tokenOut, stable);
        if (pool == address(0)) revert NoPool(tokenIn, tokenOut);

        actualOut = IVeloPool(pool).getAmountOut(amountIn, tokenIn);
        if (actualOut < amountOutMin) revert InsufficientOutput(actualOut, amountOutMin);

        IERC20(tokenIn).safeTransfer(pool, amountIn);
        (uint256 amount0Out, uint256 amount1Out) =
            tokenIn == IVeloPool(pool).token0() ? (uint256(0), actualOut) : (actualOut, uint256(0));
        IVeloPool(pool).swap(amount0Out, amount1Out, address(this), "");
    }

    /// @notice ERC-721 receive hook — immediately forwards the NFT to the real buyer.
    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external override returns (bytes4) {
        address buyer = _currentBuyer;
        if (buyer != address(0)) IERC721(msg.sender).safeTransferFrom(address(this), buyer, tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }
}
