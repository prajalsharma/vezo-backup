// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IMezoVeNFTAdapter.sol";
import "../interfaces/IPaymentRouter.sol";

// ─── Snapshot store interface (additive — optional) ───────────────────────────
interface IListingSnapshotStore {
    function recordSnapshot(
        uint256 listingId,
        address collection,
        uint256 tokenId,
        uint256 listPrice,
        uint256 usdValue
    ) external;
}

/// @title VeNFTMarketplace
/// @notice Escrowless P2P marketplace for veBTC and veMEZO NFTs
/// @dev Minimal core logic - adapters handle veNFT specifics
contract VeNFTMarketplace is ReentrancyGuard {
    /// @notice Adapter for querying veNFT values
    IMezoVeNFTAdapter public immutable adapter;

    /// @notice Router for handling payments
    IPaymentRouter public immutable paymentRouter;

    /// @notice Admin contract for pause/whitelist
    address public immutable adminContract;

    /// @notice Listing struct
    struct Listing {
        address seller;
        address collection;
        uint256 tokenId;
        uint256 price;
        address paymentToken;
        uint256 createdAt;
        bool active;
    }

    /// @notice All listings (listing ID => Listing)
    mapping(uint256 => Listing) public listings;

    /// @notice Current listing ID counter
    uint256 public nextListingId;

    /// @notice User's active listings (user => listing IDs)
    mapping(address => uint256[]) public userListings;

    /// @notice Collection floor prices (collection => payment token => price)
    mapping(address => mapping(address => uint256)) public floorPrices;

    /// @notice Active listing ID per NFT (collection => tokenId => listingId+1, 0 = no active listing)
    mapping(address => mapping(uint256 => uint256)) private _activeListingByToken;

    // ─── Additive: Snapshot store (optional) ──────────────────────────────────
    // Set once after deployment via setSnapshotStore().
    // If not set, listing / buy flows are unaffected — snapshots are simply skipped.

    /// @notice Optional ListingSnapshotStore for immutable per-listing snapshots
    IListingSnapshotStore public snapshotStore;

    /// @notice Emitted when NFT is listed
    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed collection,
        uint256 tokenId,
        uint256 price,
        address paymentToken
    );

    /// @notice Emitted when listing is cancelled
    event Cancelled(uint256 indexed listingId);

    /// @notice Emitted when listing is purchased
    event Purchased(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 price
    );

    /// @notice Emitted when listing price is updated
    event PriceUpdated(uint256 indexed listingId, uint256 oldPrice, uint256 newPrice);

    // ─── Additive: Rich analytics events ──────────────────────────────────────
    // These are supplementary to the original Listed/Cancelled/Purchased events.
    // Off-chain indexers can use these for floor prices, volume charts, and
    // average sale discount tracking.  Existing event consumers are unaffected.

    /// @notice Rich listing event with veNFT snapshot values
    event ListedWithSnapshot(
        uint256 indexed listingId,
        address indexed seller,
        address indexed collection,
        uint256 tokenId,
        uint256 price,
        address paymentToken,
        uint256 intrinsicValueAtListing,
        uint256 votingPowerAtListing,
        uint256 lockDurationAtListing,
        uint256 discountBpsAtListing
    );

    /// @notice Rich cancellation event
    event CancelledWithContext(
        uint256 indexed listingId,
        address indexed seller,
        address indexed collection,
        uint256 tokenId,
        uint256 originalPrice,
        address paymentToken
    );

    /// @notice Rich purchase event for analytics
    event PurchasedWithAnalytics(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        address collection,
        uint256 tokenId,
        uint256 price,
        address paymentToken,
        uint256 protocolFee,
        uint256 intrinsicValueAtSale,
        uint256 discountBpsAtSale
    );

    /// @notice Errors
    error Paused();
    error NotOwner();
    error NotApproved();
    error UnsupportedCollection();
    error UnsupportedPaymentToken();
    error ListingNotActive();
    error InsufficientPayment();
    error InvalidPrice();
    error TransferFailed();
    error ExpiredVeNFT();
    error SelfPurchase();
    error PauseCheckFailed();
    error InsufficientAllowance();
    error AlreadyListed();
    error SnapshotStoreAlreadySet();
    error NotAdmin();

    /// @notice Check if marketplace is paused (fail-closed: reverts if admin call fails)
    modifier whenNotPaused() {
        (bool success, bytes memory data) = adminContract.staticcall(
            abi.encodeWithSignature("isPaused()")
        );
        if (!success || data.length < 32) revert PauseCheckFailed();
        if (abi.decode(data, (bool))) revert Paused();
        _;
    }

    /// @notice Deploy marketplace
    /// @param _adapter MezoVeNFTAdapter address
    /// @param _paymentRouter PaymentRouter address
    /// @param _adminContract MarketplaceAdmin address
    constructor(address _adapter, address _paymentRouter, address _adminContract) {
        require(_adapter != address(0), "Invalid adapter");
        require(_paymentRouter != address(0), "Invalid router");
        require(_adminContract != address(0), "Invalid admin");

        adapter = IMezoVeNFTAdapter(_adapter);
        paymentRouter = IPaymentRouter(_paymentRouter);
        adminContract = _adminContract;
    }

    /// @notice Emitted when snapshot store is registered
    event SnapshotStoreSet(address indexed store);

    // ─── Additive: Snapshot store registration ─────────────────────────────────

    /// @notice Register the ListingSnapshotStore (admin only, one-time set).
    ///         Must be called by the adminContract owner after deployment.
    ///         The snapshot store is optional — if not set, listings work as before.
    /// @param store ListingSnapshotStore contract address
    function setSnapshotStore(address store) external {
        // Only the adminContract can set (reuses the admin authority model)
        (bool ok, bytes memory data) = adminContract.staticcall(
            abi.encodeWithSignature("hasRole(bytes32,address)",
                bytes32(0x00), // DEFAULT_ADMIN_ROLE
                msg.sender
            )
        );
        if (!ok || data.length < 32 || !abi.decode(data, (bool))) revert NotAdmin();
        if (address(snapshotStore) != address(0)) revert SnapshotStoreAlreadySet();
        require(store != address(0), "Invalid store");
        snapshotStore = IListingSnapshotStore(store);
        emit SnapshotStoreSet(store);
    }

    /// @notice List a veNFT for sale
    /// @param collection veBTC or veMEZO address
    /// @param tokenId Token ID to list
    /// @param price Sale price in payment token
    /// @param paymentToken Token to accept for payment
    /// @return listingId Created listing ID
    function listNFT(
        address collection,
        uint256 tokenId,
        uint256 price,
        address paymentToken
    ) external whenNotPaused nonReentrant returns (uint256 listingId) {
        // Validate collection
        if (!adapter.isSupported(collection)) revert UnsupportedCollection();

        // Validate payment token
        if (!paymentRouter.supportedTokens(paymentToken)) revert UnsupportedPaymentToken();

        // Validate price
        if (price == 0) revert InvalidPrice();

        // Validate ownership
        IERC721 nft = IERC721(collection);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotOwner();

        // Validate approval
        if (
            nft.getApproved(tokenId) != address(this) &&
            !nft.isApprovedForAll(msg.sender, address(this))
        ) revert NotApproved();

        // Prevent duplicate active listings for the same NFT
        if (_activeListingByToken[collection][tokenId] != 0) revert AlreadyListed();

        // Create listing
        listingId = nextListingId++;

        listings[listingId] = Listing({
            seller: msg.sender,
            collection: collection,
            tokenId: tokenId,
            price: price,
            paymentToken: paymentToken,
            createdAt: block.timestamp,
            active: true
        });

        userListings[msg.sender].push(listingId);

        // Track active listing for this NFT (store listingId + 1 so 0 means "no listing")
        _activeListingByToken[collection][tokenId] = listingId + 1;

        // Update floor price if needed
        uint256 currentFloor = floorPrices[collection][paymentToken];
        if (currentFloor == 0 || price < currentFloor) {
            floorPrices[collection][paymentToken] = price;
        }

        emit Listed(listingId, msg.sender, collection, tokenId, price, paymentToken);

        // ── Additive: snapshot + rich analytics event ──────────────────────
        // Fetching live veNFT values here is cheap (read-only adapter calls).
        // These values are snapshotted once at listing time so analytics remain
        // stable even as intrinsic value / voting power decays over time.
        (uint256 intrinsicVal, ) = adapter.getIntrinsicValue(collection, tokenId);
        uint256 votingPow   = adapter.getVotingPower(collection, tokenId);
        uint256 lockRemain  = adapter.getTimeRemaining(collection, tokenId);
        uint256 discountBps = adapter.calculateDiscount(price, intrinsicVal);

        emit ListedWithSnapshot(
            listingId, msg.sender, collection, tokenId, price, paymentToken,
            intrinsicVal, votingPow, lockRemain, discountBps
        );

        // Persist snapshot on-chain if store is registered (no-op otherwise)
        if (address(snapshotStore) != address(0)) {
            // usdValue = 0 here; PriceOracleHub is optional at listing time
            try snapshotStore.recordSnapshot(listingId, collection, tokenId, price, 0) {} catch {}
        }
    }

    /// @notice Cancel a listing
    /// @param listingId Listing ID to cancel
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];

        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotOwner();

        // Cache fields before state change for rich event
        address _seller      = listing.seller;
        address _collection  = listing.collection;
        uint256 _tokenId     = listing.tokenId;
        uint256 _price       = listing.price;
        address _payToken    = listing.paymentToken;

        listing.active = false;
        _activeListingByToken[_collection][_tokenId] = 0;

        emit Cancelled(listingId);

        // Additive rich cancellation event for analytics indexers
        emit CancelledWithContext(listingId, _seller, _collection, _tokenId, _price, _payToken);
    }

    /// @notice Update listing price
    /// @param listingId Listing ID to update
    /// @param newPrice New price in payment token
    function updatePrice(uint256 listingId, uint256 newPrice) external whenNotPaused nonReentrant {
        if (newPrice == 0) revert InvalidPrice();

        Listing storage listing = listings[listingId];

        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotOwner();

        uint256 oldPrice = listing.price;
        listing.price = newPrice;

        // Update floor price if needed
        if (newPrice < floorPrices[listing.collection][listing.paymentToken]) {
            floorPrices[listing.collection][listing.paymentToken] = newPrice;
        }

        emit PriceUpdated(listingId, oldPrice, newPrice);
    }

    /// @notice Purchase a listed veNFT
    /// @param listingId Listing ID to purchase
    function buyNFT(uint256 listingId) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];

        if (!listing.active) revert ListingNotActive();

        // Prevent seller from buying their own listing
        if (listing.seller == msg.sender) revert SelfPurchase();

        // Reject purchases of expired veNFTs (zero voting power / worthless lock)
        if (adapter.isExpired(listing.collection, listing.tokenId)) revert ExpiredVeNFT();

        // Validate seller still owns the NFT before any state changes
        if (IERC721(listing.collection).ownerOf(listing.tokenId) != listing.seller) revert NotOwner();

        // Mark as inactive before external calls (CEI pattern)
        listing.active = false;
        _activeListingByToken[listing.collection][listing.tokenId] = 0;

        address seller = listing.seller;
        address collection = listing.collection;
        uint256 tokenId = listing.tokenId;
        uint256 price = listing.price;
        address paymentToken = listing.paymentToken;

        // Validate buyer ERC-20 allowance before initiating any transfers.
        // This catches insufficient approval early, before the NFT moves.
        if (paymentToken != paymentRouter.BTC()) {
            uint256 allowance = IERC20(paymentToken).allowance(msg.sender, address(paymentRouter));
            if (allowance < price) revert InsufficientAllowance();
        }

        // Transfer NFT first, then route payment. The NFT-first ordering is intentional:
        // payment only executes if the NFT transfer succeeds. safeTransferFrom triggers
        // onERC721Received on contract buyers; nonReentrant bounds the re-entry surface.
        // EVM atomicity ensures the entire transaction reverts if payment fails afterward.
        IERC721(collection).safeTransferFrom(seller, msg.sender, tokenId);

        // Route payment through PaymentRouter
        if (paymentToken == paymentRouter.BTC()) {
            // Native BTC payment
            if (msg.value < price) revert InsufficientPayment();
            paymentRouter.routePayment{value: price}(msg.sender, seller, paymentToken, price);

            // Refund excess
            if (msg.value > price) {
                (bool refundSuccess, ) = msg.sender.call{value: msg.value - price}("");
                if (!refundSuccess) revert TransferFailed();
            }
        } else {
            // ERC-20 payment - pull from buyer after NFT is delivered
            paymentRouter.routePayment(msg.sender, seller, paymentToken, price);
        }

        emit Purchased(listingId, msg.sender, seller, price);

        // Additive: rich analytics event with live veNFT values at sale time
        // (intrinsic value and discount captured now for historical accuracy)
        {
            (uint256 iv, ) = adapter.getIntrinsicValue(collection, tokenId);
            uint256 saleDiscount = adapter.calculateDiscount(price, iv);
            (, uint256 fee) = paymentRouter.calculateFee(price);
            // fee above is sellerAmount; actual fee = price - fee
            uint256 protocolFee = price - fee;
            emit PurchasedWithAnalytics(
                listingId,
                msg.sender,
                seller,
                collection,
                tokenId,
                price,
                paymentToken,
                protocolFee,
                iv,
                saleDiscount
            );
        }
    }

    /// @notice Get listing details with veNFT intrinsic value
    /// @param listingId Listing ID to query
    function getListingWithValue(
        uint256 listingId
    )
        external
        view
        returns (
            Listing memory listing,
            uint256 intrinsicValue,
            uint256 lockEnd,
            uint256 votingPower,
            uint256 discountBps
        )
    {
        listing = listings[listingId];

        if (listing.collection != address(0)) {
            (intrinsicValue, lockEnd) = adapter.getIntrinsicValue(
                listing.collection,
                listing.tokenId
            );
            votingPower = adapter.getVotingPower(listing.collection, listing.tokenId);
            discountBps = adapter.calculateDiscount(listing.price, intrinsicValue);
        }
    }

    /// @notice Get all active listings for a collection
    /// @param collection Collection address
    /// @param offset Starting index
    /// @param limit Maximum results
    function getActiveListings(
        address collection,
        uint256 offset,
        uint256 limit
    ) external view returns (Listing[] memory result, uint256 total) {
        // Count active listings for collection
        uint256 count = 0;
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].active && listings[i].collection == collection) {
                count++;
            }
        }

        total = count;

        if (offset >= count) {
            return (new Listing[](0), total);
        }

        uint256 resultSize = limit;
        if (offset + limit > count) {
            resultSize = count - offset;
        }

        result = new Listing[](resultSize);

        uint256 found = 0;
        uint256 added = 0;

        for (uint256 i = 0; i < nextListingId && added < resultSize; i++) {
            if (listings[i].active && listings[i].collection == collection) {
                if (found >= offset) {
                    result[added] = listings[i];
                    added++;
                }
                found++;
            }
        }
    }

    /// @notice Get user's listing IDs
    /// @param user User address
    function getUserListings(address user) external view returns (uint256[] memory) {
        return userListings[user];
    }

    /// @notice Returns the lowest price ever listed for this collection/token pair.
    /// @dev WARNING: This value only decreases and is never reset on cancellation or sale.
    ///      It is not a reliable current floor price and must not be used as a price oracle.
    /// @param collection Collection address
    /// @param paymentToken Payment token address
    function getFloorPrice(
        address collection,
        address paymentToken
    ) external view returns (uint256) {
        return floorPrices[collection][paymentToken];
    }
}
