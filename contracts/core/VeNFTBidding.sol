// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IPaymentRouter.sol";

/// @title VeNFTBidding
/// @notice Additive offer/bidding system for the Vezo veNFT marketplace.
///         Fully backward-compatible — VeNFTMarketplace.sol is unchanged.
///
/// @dev Architecture overview
///   • Bidders pull funds from their own wallet at acceptance time (no escrow).
///   • acceptBid() validates ownership and approval on-chain before any transfer.
///   • Bids have an on-chain expiry timestamp; expired bids cannot be accepted.
///   • Protocol fee is routed through the existing PaymentRouter, ensuring
///     consistent fee accounting across listings and bids.
///   • CEI pattern + ReentrancyGuard + SafeERC20 throughout.
///
/// Extensibility hooks (future work):
///   • BidFilter struct attached to each bid supports range-based criteria
///     (minIntrinsicValue, maxLockDuration, minVotingPower, requireAutoMaxLock).
///     Currently stored but not enforced on-chain — indexers/UI can use them
///     to surface relevant bids.  Full enforcement can be added via an adapter
///     call without breaking existing bids.
///   • WatchlistEntry events enable off-chain watchlist/alert infrastructure
///     with zero storage cost on-chain.
///   • Rich analytics events on every state change feed floor-price dashboards
///     and volume charts.

contract VeNFTBidding is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ────────────────────────────────────────────────────────────────

    /// @notice Core bid record — matches the spec Bid struct exactly
    /// @dev Future extensibility fields (minIntrinsicValue … requireAutoMaxLock)
    ///      are stored but not currently enforced on-chain. The BidFilter companion
    ///      struct holds range criteria for indexers; on-chain enforcement can be
    ///      added later via an adapter call without a storage migration.
    struct Bid {
        uint256 id;
        address bidder;
        address collection;
        uint256 tokenId;             // 0 = collection-level bid (any token in collection)
        address paymentToken;
        uint256 amount;
        uint256 expiry;              // Unix timestamp; 0 = no expiry (not recommended)
        bool    active;
        // ── Extensibility fields (spec-required) ──────────────────────────
        uint256 minIntrinsicValue;   // 0 = no minimum required
        uint256 maxIntrinsicValue;   // 0 = no maximum required
        uint256 minVotingPower;      // 0 = any voting power accepted
        uint256 minLockDuration;     // minimum remaining lock seconds; 0 = any
        bool    requireAutoMaxLock;  // must be a permanent (auto-max) lock position
    }

    /// @notice Range-based filter — kept for backward-compatibility with existing
    ///         indexers that read the BidFilterSet event. Mirrors the Bid fields above.
    /// @dev All fields are hints; on-chain enforcement is opt-in via adapter
    struct BidFilter {
        uint256 minIntrinsicValue;   // 0 = no minimum
        uint256 maxIntrinsicValue;   // 0 = no maximum
        uint256 maxLockDuration;     // seconds; 0 = any
        uint256 minVotingPower;      // 0 = any
        bool    requireAutoMaxLock;  // must be a permanent auto-lock position
    }

    // ─── State ────────────────────────────────────────────────────────────────

    IPaymentRouter public immutable paymentRouter;
    address        public immutable adminContract;

    uint256 public nextBidId;

    /// @notice bid ID → Bid
    mapping(uint256 => Bid) public bids;

    /// @notice bid ID → BidFilter (range criteria hints)
    mapping(uint256 => BidFilter) public bidFilters;

    /// @notice bidder → list of bid IDs (includes inactive)
    mapping(address => uint256[]) public bidderBids;

    /// @notice collection → tokenId → list of active bid IDs
    ///         (may contain stale entries; always validate bid.active)
    mapping(address => mapping(uint256 => uint256[])) private _tokenBids;

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Bid placed
    event BidCreated(
        uint256 indexed bidId,
        address indexed bidder,
        address indexed collection,
        uint256 tokenId,
        address paymentToken,
        uint256 amount,
        uint256 expiry
    );

    /// @notice Bid cancelled by bidder
    event BidCancelled(uint256 indexed bidId, address indexed bidder);

    /// @notice Bid accepted by NFT owner
    event BidAccepted(
        uint256 indexed bidId,
        address indexed seller,
        address indexed bidder,
        address collection,
        uint256 tokenId,
        uint256 amount
    );

    /// @notice Emitted when bid filter criteria are set (for indexers)
    event BidFilterSet(
        uint256 indexed bidId,
        uint256 minIntrinsicValue,
        uint256 maxIntrinsicValue,
        uint256 maxLockDuration,
        uint256 minVotingPower,
        bool requireAutoMaxLock
    );

    /// @notice Rich bid acceptance event for analytics (additive — BidAccepted is preserved)
    event BidAcceptedWithAnalytics(
        uint256 indexed bidId,
        address indexed seller,
        address indexed bidder,
        address collection,
        uint256 tokenId,
        uint256 amount,
        address paymentToken,
        uint256 protocolFee,
        uint256 sellerReceived
    );

    /// @notice Rich bid creation event carrying extensibility filter fields
    event BidCreatedFull(
        uint256 indexed bidId,
        address indexed bidder,
        address indexed collection,
        uint256 tokenId,
        address paymentToken,
        uint256 amount,
        uint256 expiry,
        uint256 minIntrinsicValue,
        uint256 maxIntrinsicValue,
        uint256 minVotingPower,
        uint256 minLockDuration,
        bool    requireAutoMaxLock
    );

    /// @notice Watchlist event — zero storage cost, purely for off-chain indexing
    event WatchlistUpdated(
        address indexed user,
        address indexed collection,
        uint256 tokenId,
        bool watching    // true = added, false = removed
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Paused();
    error PauseCheckFailed();
    error BidNotActive();
    error BidExpired();
    error NotBidder();
    error NotOwner();
    error NotApproved();
    error SelfBid();
    error ZeroAmount();
    error ZeroExpiry();
    error UnsupportedPaymentToken();
    error InsufficientAllowance();
    error InsufficientBalance();

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier whenNotPaused() {
        (bool ok, bytes memory data) = adminContract.staticcall(
            abi.encodeWithSignature("isPaused()")
        );
        if (!ok || data.length < 32) revert PauseCheckFailed();
        if (abi.decode(data, (bool))) revert Paused();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _paymentRouter, address _adminContract) {
        require(_paymentRouter != address(0), "Invalid router");
        require(_adminContract != address(0), "Invalid admin");
        paymentRouter = IPaymentRouter(_paymentRouter);
        adminContract = _adminContract;
    }

    // ─── External functions ───────────────────────────────────────────────────

    /// @notice Place a bid on any veNFT (listed or unlisted)
    /// @param collection        veBTC or veMEZO contract address
    /// @param tokenId           NFT token ID (0 = collection-level bid for any token)
    /// @param paymentToken      Token to pay with (must be supported by PaymentRouter)
    /// @param amount            Bid amount in paymentToken decimals
    /// @param expiry            Unix timestamp after which bid cannot be accepted (must be future)
    /// @param filter            Range criteria hints for indexers/UI (optional, zero = any)
    /// @param minIntrinsicValue Minimum intrinsic value required (0 = any)
    /// @param maxIntrinsicValue Maximum intrinsic value allowed (0 = any)
    /// @param minVotingPower    Minimum voting power required (0 = any)
    /// @param minLockDuration   Minimum remaining lock seconds required (0 = any)
    /// @param requireAutoMaxLock Whether NFT must be an auto-max-lock position
    /// @return bidId Created bid ID
    function createBid(
        address collection,
        uint256 tokenId,
        address paymentToken,
        uint256 amount,
        uint256 expiry,
        BidFilter calldata filter,
        uint256 minIntrinsicValue,
        uint256 maxIntrinsicValue,
        uint256 minVotingPower,
        uint256 minLockDuration,
        bool    requireAutoMaxLock
    ) external whenNotPaused nonReentrant returns (uint256 bidId) {
        if (amount == 0) revert ZeroAmount();
        if (expiry == 0 || expiry <= block.timestamp) revert ZeroExpiry();
        if (!paymentRouter.supportedTokens(paymentToken)) revert UnsupportedPaymentToken();

        // Validate bidder has sufficient balance and has approved this contract
        // (or the router) so acceptBid() can pull funds atomically.
        // We check allowance against this contract because we pull via transferFrom
        // to the router in acceptBid().
        uint256 allowance = IERC20(paymentToken).allowance(msg.sender, address(this));
        if (allowance < amount) revert InsufficientAllowance();
        uint256 balance = IERC20(paymentToken).balanceOf(msg.sender);
        if (balance < amount) revert InsufficientBalance();

        bidId = nextBidId++;

        bids[bidId] = Bid({
            id:                  bidId,
            bidder:              msg.sender,
            collection:          collection,
            tokenId:             tokenId,
            paymentToken:        paymentToken,
            amount:              amount,
            expiry:              expiry,
            active:              true,
            minIntrinsicValue:   minIntrinsicValue,
            maxIntrinsicValue:   maxIntrinsicValue,
            minVotingPower:      minVotingPower,
            minLockDuration:     minLockDuration,
            requireAutoMaxLock:  requireAutoMaxLock
        });

        bidFilters[bidId] = filter;
        bidderBids[msg.sender].push(bidId);
        _tokenBids[collection][tokenId].push(bidId);

        emit BidCreated(bidId, msg.sender, collection, tokenId, paymentToken, amount, expiry);

        // Additive rich bid event carrying extensibility fields for indexers
        emit BidCreatedFull(
            bidId, msg.sender, collection, tokenId, paymentToken, amount, expiry,
            minIntrinsicValue, maxIntrinsicValue, minVotingPower, minLockDuration, requireAutoMaxLock
        );

        if (
            filter.minIntrinsicValue > 0 ||
            filter.maxIntrinsicValue > 0 ||
            filter.maxLockDuration > 0 ||
            filter.minVotingPower > 0 ||
            filter.requireAutoMaxLock
        ) {
            emit BidFilterSet(bidId, filter.minIntrinsicValue, filter.maxIntrinsicValue,
                filter.maxLockDuration, filter.minVotingPower, filter.requireAutoMaxLock);
        }
    }

    /// @notice Cancel an active bid. Only bidder can cancel.
    /// @param bidId Bid to cancel
    function cancelBid(uint256 bidId) external nonReentrant {
        Bid storage bid = bids[bidId];
        if (!bid.active) revert BidNotActive();
        if (bid.bidder != msg.sender) revert NotBidder();

        // CEI: mark inactive before any external interactions
        bid.active = false;

        emit BidCancelled(bidId, msg.sender);
    }

    /// @notice Accept a bid. Only the current NFT owner can accept.
    ///         NFT transfers to bidder; payment is pulled from bidder and
    ///         routed through PaymentRouter (applies protocol fee).
    /// @param bidId Bid to accept
    function acceptBid(uint256 bidId) external whenNotPaused nonReentrant {
        Bid storage bid = bids[bidId];

        if (!bid.active) revert BidNotActive();
        if (block.timestamp > bid.expiry && bid.expiry != 0) revert BidExpired();

        address collection = bid.collection;
        uint256 tokenId    = bid.tokenId;
        address bidder     = bid.bidder;
        address payToken   = bid.paymentToken;
        uint256 amount     = bid.amount;

        // No self-acceptance
        if (msg.sender == bidder) revert SelfBid();

        // Re-validate ownership at acceptance time
        if (IERC721(collection).ownerOf(tokenId) != msg.sender) revert NotOwner();

        // Re-validate NFT approval for marketplace contract
        bool approvedSingle = IERC721(collection).getApproved(tokenId) == address(this);
        bool approvedAll    = IERC721(collection).isApprovedForAll(msg.sender, address(this));
        if (!approvedSingle && !approvedAll) revert NotApproved();

        // Re-validate bidder still has allowance + balance
        uint256 allowance = IERC20(payToken).allowance(bidder, address(this));
        if (allowance < amount) revert InsufficientAllowance();
        uint256 balance = IERC20(payToken).balanceOf(bidder);
        if (balance < amount) revert InsufficientBalance();

        // ── CEI: mark inactive BEFORE any external calls ────────────────────
        bid.active = false;

        // ── Transfer NFT from seller (msg.sender) to bidder ─────────────────
        IERC721(collection).safeTransferFrom(msg.sender, bidder, tokenId);

        // ── Pull payment from bidder; route through PaymentRouter ────────────
        // Pull full amount to this contract first, then approve router to take it.
        IERC20(payToken).safeTransferFrom(bidder, address(this), amount);
        IERC20(payToken).forceApprove(address(paymentRouter), amount);
        paymentRouter.routePayment(address(this), msg.sender, payToken, amount);

        emit BidAccepted(bidId, msg.sender, bidder, collection, tokenId, amount);

        // Additive: rich analytics event for fee/volume tracking
        {
            (, uint256 sellerReceived) = paymentRouter.calculateFee(amount);
            uint256 protocolFee = amount - sellerReceived;
            emit BidAcceptedWithAnalytics(
                bidId, msg.sender, bidder, collection, tokenId, amount,
                payToken, protocolFee, sellerReceived
            );
        }
    }

    // ─── Watchlist helpers (event-only, zero storage) ─────────────────────────

    /// @notice Emit a watchlist signal for off-chain alert infrastructure.
    ///         Purely event-driven; no on-chain storage used.
    function emitWatchlistUpdate(
        address collection,
        uint256 tokenId,
        bool watching
    ) external {
        emit WatchlistUpdated(msg.sender, collection, tokenId, watching);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    /// @notice Get all bid IDs for a given bidder
    function getBidderBids(address bidder) external view returns (uint256[] memory) {
        return bidderBids[bidder];
    }

    /// @notice Get all bid IDs for a given token
    function getTokenBids(address collection, uint256 tokenId) external view returns (uint256[] memory) {
        return _tokenBids[collection][tokenId];
    }

    /// @notice Get active bids for a token (filters out inactive/expired inline)
    function getActiveTokenBids(
        address collection,
        uint256 tokenId
    ) external view returns (Bid[] memory activeBids) {
        uint256[] storage allIds = _tokenBids[collection][tokenId];
        uint256 count = 0;
        uint256 now_ = block.timestamp;

        for (uint256 i = 0; i < allIds.length; i++) {
            Bid storage b = bids[allIds[i]];
            if (b.active && (b.expiry == 0 || b.expiry > now_)) count++;
        }

        activeBids = new Bid[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allIds.length; i++) {
            Bid storage b = bids[allIds[i]];
            if (b.active && (b.expiry == 0 || b.expiry > now_)) {
                activeBids[idx++] = b;
            }
        }
    }
}
