// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IPaymentRouter.sol";
import "./QuoteRouter.sol";

/// @notice Pluggable DEX adapter interface (future production hook).
///         Deploy a concrete implementation (e.g. UniswapV3Adapter) and
///         register it via SwapRouter.setDexAdapter().
interface IDexAdapter {
    /// @notice Swap exactIn tokenIn for tokenOut; returns amountOut
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}

/// @title SwapRouter
/// @notice Executes cross-currency NFT settlements for the Vezo marketplace.
///
/// @dev Architecture
///   ┌──────────────┐     getQuote()     ┌──────────────────┐
///   │ QuoteRouter  │ ◄───────────────── │    SwapRouter    │
///   └──────────────┘                    │                  │
///                                       │  executeSwap()   │
///   ┌──────────────┐    routePayment()  │                  │
///   │ PaymentRouter│ ◄───────────────── │                  │
///   └──────────────┘                    └──────────────────┘
///
/// Settlement flow (buyer pays MEZO, seller wants MUSD):
///   1. Frontend calls QuoteRouter.getQuote(MUSD, askPrice, MEZO) → QuoteResult
///   2. Buyer approves SwapRouter for paymentAmount in MEZO
///   3. Marketplace calls SwapRouter.executeSwap(listingId, quote, maxPayAmount)
///   4. SwapRouter:
///      a. Re-validates quote freshness & slippage
///      b. Pulls buyer's MEZO → this contract
///      c. NOTE: In production a DEX adapter (Uniswap v3, etc.) converts
///               MEZO → MUSD. This stub skips the actual swap; a real adapter
///               must be registered via setDexAdapter() when available.
///      d. Approves PaymentRouter for MUSD settlementAmount
///      e. Calls paymentRouter.routePayment(this, seller, MUSD, settlementAmount)
///         → seller receives MUSD net of protocol fee
///      f. Swap fee (in MEZO) stays in SwapRouter → admin sweeps to treasury
///
/// Gas considerations:
///   • No storage writes on the hot path beyond swap fee accumulation.
///   • CEI pattern maintained: state updated before external calls.
///   • ReentrancyGuard on executeSwap().
///
/// Future extensions:
///   • Register a real DEX adapter (Uniswap v3 pool, aggregator) via setDexAdapter().
///   • Enable native BTC support via payable wrapper.
///   • Fee-on-swap can be routed to a dedicated treasury at sweep time.

contract SwapRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────────────────────

    IPaymentRouter public immutable paymentRouter;
    QuoteRouter    public immutable quoteRouter;
    address        public           owner;
    address        public           pendingOwner;

    /// @notice Authorised marketplace contracts allowed to call executeSwap
    mapping(address => bool) public authorisedCallers;

    /// @notice Optional DEX adapter (address(0) = stub/no-op for now)
    address public dexAdapter;

    /// @notice Accumulated swap fees per token (admin sweeps to treasury)
    mapping(address => uint256) public accumulatedFees;

    // ─── Events ───────────────────────────────────────────────────────────────

    event SwapExecuted(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        address paymentToken,
        address settlementToken,
        uint256 paymentAmount,
        uint256 settlementAmount,
        uint256 swapFee
    );

    event CallerAuthorised(address indexed caller, bool authorised);
    event DexAdapterSet(address indexed adapter);
    event FeeSwept(address indexed token, uint256 amount, address indexed recipient);
    event OwnershipTransferProposed(address indexed current, address indexed proposed);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Unauthorized();
    error QuoteExpired();
    error SlippageExceeded(uint256 required, uint256 max);
    error InsufficientAllowance();
    error SwapFailed();
    error ZeroAddress();

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAuthorised() {
        if (!authorisedCallers[msg.sender]) revert Unauthorized();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _paymentRouter,
        address _quoteRouter,
        address _owner
    ) {
        require(_paymentRouter != address(0), "Invalid router");
        require(_quoteRouter   != address(0), "Invalid quote router");
        require(_owner         != address(0), "Invalid owner");
        paymentRouter = IPaymentRouter(_paymentRouter);
        quoteRouter   = QuoteRouter(_quoteRouter);
        owner         = _owner;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Authorise or deauthorise a marketplace contract to call executeSwap
    function setAuthorisedCaller(address caller, bool authorised) external onlyOwner {
        if (caller == address(0)) revert ZeroAddress();
        authorisedCallers[caller] = authorised;
        emit CallerAuthorised(caller, authorised);
    }

    /// @notice Register the DEX adapter (Uniswap v3 wrapper, aggregator, etc.)
    ///         Set address(0) to revert to stub (same-currency fallback only).
    function setDexAdapter(address adapter) external onlyOwner {
        dexAdapter = adapter;
        emit DexAdapterSet(adapter);
    }

    /// @notice Sweep accumulated swap fees to treasury
    function sweepFees(address token, address recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 amount = accumulatedFees[token];
        if (amount == 0) return;
        // CEI
        accumulatedFees[token] = 0;
        IERC20(token).safeTransfer(recipient, amount);
        emit FeeSwept(token, amount, recipient);
    }

    // ─── Core: executeSwap ────────────────────────────────────────────────────

    /// @notice Execute a cross-currency swap for a marketplace listing.
    ///
    /// @param listingId        VeNFTMarketplace listing ID (for event tracking)
    /// @param buyer            Address of the buyer (payment pulled from here)
    /// @param seller           Address of the seller (settlement sent here)
    /// @param quote            QuoteResult from QuoteRouter.getQuote()
    /// @param maxPaymentAmount Slippage guard: revert if paymentAmount > this
    function executeSwap(
        uint256 listingId,
        address buyer,
        address seller,
        QuoteRouter.QuoteResult calldata quote,
        uint256 maxPaymentAmount
    ) external nonReentrant onlyAuthorised {
        // ── Validations ──────────────────────────────────────────────────────
        if (!quote.valid)                       revert SwapFailed();
        if (block.timestamp > quote.expiry)     revert QuoteExpired();
        if (quote.paymentAmount > maxPaymentAmount)
            revert SlippageExceeded(quote.paymentAmount, maxPaymentAmount);

        address payToken  = quote.paymentToken;
        address settToken = quote.settlementToken;
        uint256 payAmt    = quote.paymentAmount;
        uint256 settAmt   = quote.settlementAmount;
        uint256 feeAmt    = quote.swapFeeAmount;

        // ── S-1: re-derive the quote on-chain; NEVER trust caller-supplied
        //         amounts. getQuote() reverts SameToken if payToken == settToken,
        //         so this also enforces a genuine cross-currency swap.
        QuoteRouter.QuoteResult memory v = quoteRouter.getQuote(settToken, settAmt, payToken);
        if (v.paymentAmount != payAmt || v.swapFeeAmount != feeAmt) revert SwapFailed();

        // Verify buyer has approved this contract for the full paymentAmount
        if (IERC20(payToken).allowance(buyer, address(this)) < payAmt)
            revert InsufficientAllowance();

        // ── CEI: accumulate fee before external calls ─────────────────────
        accumulatedFees[payToken] += feeAmt;

        // ── Pull buyer's payment tokens into this contract ─────────────────
        IERC20(payToken).safeTransferFrom(buyer, address(this), payAmt);

        // ── S-3: a real DEX adapter is REQUIRED. The old stub fabricated
        //         receivedSettlementAmount = settAmt and routed a settToken the
        //         contract never held — settle only tokens actually received.
        if (dexAdapter == address(0)) revert SwapFailed();

        uint256 swapInput = payAmt - feeAmt;          // fee stays here for sweep
        IERC20(payToken).forceApprove(dexAdapter, swapInput);
        uint256 received = IDexAdapter(dexAdapter).swap(
            payToken, settToken, swapInput, settAmt, address(this)
        );
        if (received < settAmt) revert SwapFailed();

        // ── S-2: settle the fee split DIRECTLY. PaymentRouter.routePayment is
        //         onlyMarketplace and permanently bound to VeNFTMarketplace, so
        //         this contract can never call it. Replicate its ERC-20 accounting
        //         using calculateFee + feeRecipient (public views) and distribute
        //         the FULL received amount (nothing retained → no drain target).
        (uint256 protocolFee, uint256 sellerAmount) = paymentRouter.calculateFee(received);
        address treasury = paymentRouter.feeRecipient();
        IERC20(settToken).safeTransfer(seller, sellerAmount);
        if (protocolFee > 0) IERC20(settToken).safeTransfer(treasury, protocolFee);

        emit SwapExecuted(
            listingId,
            buyer,
            seller,
            payToken,
            settToken,
            payAmt,
            settAmt,
            feeAmt
        );
    }

    // ─── Ownership ────────────────────────────────────────────────────────────

    function proposeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid");
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address old = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(old, owner);
    }
}
