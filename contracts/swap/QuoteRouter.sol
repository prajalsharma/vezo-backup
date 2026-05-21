// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../oracles/PriceOracleHub.sol";

/// @title QuoteRouter
/// @notice Generates time-limited cross-currency quotes for the Vezo marketplace.
///
/// @dev Architecture
///   • Seller lists in their preferred token (e.g. MUSD).
///   • Buyer wants to pay in a different token (e.g. MEZO or BTC).
///   • QuoteRouter asks PriceOracleHub to convert seller's ask → buyer's token.
///   • Quote is valid for QUOTE_VALIDITY seconds (default 5 min); expired quotes
///     are rejected by SwapRouter before execution.
///   • Slippage tolerance is enforced: buyer specifies maxPaymentAmount and the
///     swap reverts if the required amount exceeds it.
///   • No funds are held here; this is purely a computation layer.
///
/// Integration path:
///   SwapRouter calls getQuote() → stores QuoteResult → executes swap if valid.

contract QuoteRouter {

    // ─── Types ────────────────────────────────────────────────────────────────

    struct QuoteResult {
        address paymentToken;       // Token the buyer will pay with
        address settlementToken;    // Token the seller will receive
        uint256 paymentAmount;      // Amount buyer must send (includes swap fee)
        uint256 settlementAmount;   // Amount seller receives
        uint256 swapFeeBps;         // Fee charged on top of base amount
        uint256 swapFeeAmount;      // Fee in paymentToken units
        uint256 expiry;             // Unix timestamp after which quote is stale
        bool    valid;
    }

    // ─── Constants ────────────────────────────────────────────────────────────

    /// @notice Default quote validity window (5 minutes)
    uint256 public constant QUOTE_VALIDITY = 5 minutes;

    /// @notice Maximum swap fee (3%)
    uint256 public constant MAX_SWAP_FEE_BPS = 300;

    // ─── State ────────────────────────────────────────────────────────────────

    PriceOracleHub public immutable oracle;
    address        public           owner;

    /// @notice Swap fee for cross-currency settlements (in bps, e.g. 50 = 0.5%)
    uint256 public swapFeeBps;

    /// @notice Symbol mapping: token address → oracle symbol
    mapping(address => bytes32) public tokenSymbol;

    // ─── Events ───────────────────────────────────────────────────────────────

    event SwapFeeUpdated(uint256 oldBps, uint256 newBps);
    event TokenSymbolRegistered(address indexed token, bytes32 symbol);
    event QuoteGenerated(
        address indexed paymentToken,
        address indexed settlementToken,
        uint256 paymentAmount,
        uint256 settlementAmount,
        uint256 expiry
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Unauthorized();
    error TokenNotRegistered(address token);
    error SwapFeeExceedsMax(uint256 requested, uint256 max);
    error ZeroAmount();
    error SameToken();

    // ─── Constructor ──────────────────────────────────────────────────────────

    /// @param _oracle      PriceOracleHub address
    /// @param _owner       Owner (admin)
    /// @param _swapFeeBps  Initial swap fee in basis points
    constructor(address _oracle, address _owner, uint256 _swapFeeBps) {
        require(_oracle != address(0), "Invalid oracle");
        require(_owner  != address(0), "Invalid owner");
        if (_swapFeeBps > MAX_SWAP_FEE_BPS) revert SwapFeeExceedsMax(_swapFeeBps, MAX_SWAP_FEE_BPS);
        oracle     = PriceOracleHub(_oracle);
        owner      = _owner;
        swapFeeBps = _swapFeeBps;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @notice Register the oracle symbol for a payment token
    function registerToken(address token, bytes32 symbol) external onlyOwner {
        require(token != address(0), "Invalid token");
        tokenSymbol[token] = symbol;
        emit TokenSymbolRegistered(token, symbol);
    }

    /// @notice Set swap fee (owner only, capped at MAX_SWAP_FEE_BPS)
    function setSwapFee(uint256 newBps) external onlyOwner {
        if (newBps > MAX_SWAP_FEE_BPS) revert SwapFeeExceedsMax(newBps, MAX_SWAP_FEE_BPS);
        uint256 old = swapFeeBps;
        swapFeeBps = newBps;
        emit SwapFeeUpdated(old, newBps);
    }

    // ─── Quote Logic ──────────────────────────────────────────────────────────

    /// @notice Check whether two tokens require cross-currency routing
    function needsSwap(address paymentToken, address settlementToken) external pure returns (bool) {
        return paymentToken != settlementToken;
    }

    /// @notice Get a cross-currency quote.
    ///
    /// @param settlementToken  Token the seller wants (listing currency)
    /// @param settlementAmount Amount the seller expects to receive
    /// @param paymentToken     Token the buyer will pay with
    /// @return q               QuoteResult with all fields populated
    function getQuote(
        address settlementToken,
        uint256 settlementAmount,
        address paymentToken
    ) external view returns (QuoteResult memory q) {
        if (settlementAmount == 0) revert ZeroAmount();
        if (paymentToken == settlementToken) revert SameToken();

        bytes32 paySymbol  = tokenSymbol[paymentToken];
        bytes32 settSymbol = tokenSymbol[settlementToken];
        if (paySymbol  == bytes32(0)) revert TokenNotRegistered(paymentToken);
        if (settSymbol == bytes32(0)) revert TokenNotRegistered(settlementToken);

        // Get USD prices from oracle (18 dec)
        (uint256 payPriceUsd, )  = oracle.getPrice(paySymbol);
        (uint256 settPriceUsd, ) = oracle.getPrice(settSymbol);

        // settlementAmount in settlementToken units → USD → paymentToken units
        // All values 18 dec:
        //   usdValue        = settlementAmount * settPrice / 1e18
        //   rawPayAmount    = usdValue * 1e18 / payPrice
        //                   = settlementAmount * settPrice / payPrice
        uint256 rawPayAmount = (settlementAmount * settPriceUsd) / payPriceUsd;

        // Apply swap fee on top (buyer pays fee)
        uint256 feeAmount   = (rawPayAmount * swapFeeBps) / 10_000;
        uint256 totalPay    = rawPayAmount + feeAmount;

        q = QuoteResult({
            paymentToken:     paymentToken,
            settlementToken:  settlementToken,
            paymentAmount:    totalPay,
            settlementAmount: settlementAmount,
            swapFeeBps:       swapFeeBps,
            swapFeeAmount:    feeAmount,
            expiry:           block.timestamp + QUOTE_VALIDITY,
            valid:            true
        });
        // Note: QuoteGenerated event is emitted by callers (non-view context) if needed.
    }

    /// @notice Validate that a previously generated quote is still valid and
    ///         that the buyer's maxPaymentAmount is not exceeded.
    ///
    /// @param q                 The QuoteResult from getQuote()
    /// @param maxPaymentAmount  Buyer's slippage tolerance ceiling
    function validateQuote(QuoteResult calldata q, uint256 maxPaymentAmount)
        external
        view
        returns (bool ok, string memory reason)
    {
        if (!q.valid)                           return (false, "Quote invalid");
        if (block.timestamp > q.expiry)         return (false, "Quote expired");
        if (q.paymentAmount > maxPaymentAmount) return (false, "Slippage exceeded");
        return (true, "");
    }
}
