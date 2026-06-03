// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IMezoVeNFTAdapter.sol";
import "../interfaces/IPaymentRouter.sol";

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

    /// @notice BidRegistry — only address allowed to call fulfillBidPurchase
    address public bidRegistry;

    /// @notice Current listing ID counter
    uint256 public nextListingId;

    /// @notice User's active listings (user => listing IDs)
    mapping(address => uint256[]) public userListings;

    /// @notice Collection floor prices (collection => payment token => price)
    mapping(address => mapping(address => uint256)) public floorPrices;

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

    /// @notice Emitted when bid registry is configured
    event BidRegistrySet(address indexed registry);

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
    error OnlyBidRegistry();

    /// @notice Check if marketplace is paused
    modifier whenNotPaused() {
        (bool success, bytes memory data) = adminContract.staticcall(
            abi.encodeWithSignature("isPaused()")
        );
        if (success && abi.decode(data, (bool))) revert Paused();
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

        // Update floor price if needed
        uint256 currentFloor = floorPrices[collection][paymentToken];
        if (currentFloor == 0 || price < currentFloor) {
            floorPrices[collection][paymentToken] = price;
        }

        emit Listed(listingId, msg.sender, collection, tokenId, price, paymentToken);
    }

    /// @notice Cancel a listing
    /// @param listingId Listing ID to cancel
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];

        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotOwner();

        listing.active = false;

        emit Cancelled(listingId);
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

        address seller = listing.seller;
        address collection = listing.collection;
        uint256 tokenId = listing.tokenId;
        uint256 price = listing.price;
        address paymentToken = listing.paymentToken;

        // Transfer NFT from seller to buyer FIRST, then route payment
        // This ensures payment only happens if NFT transfer succeeds
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

    /// @notice Get floor price for collection in payment token
    /// @param collection Collection address
    /// @param paymentToken Payment token address
    function getFloorPrice(
        address collection,
        address paymentToken
    ) external view returns (uint256) {
        return floorPrices[collection][paymentToken];
    }

    // ── BidRegistry integration ──────────────────────────────────────────────────

    /// @notice Set the BidRegistry contract (admin only via adminContract role)
    function setBidRegistry(address _bidRegistry) external {
        (bool ok, bytes memory data) = adminContract.staticcall(
            abi.encodeWithSignature("hasRole(bytes32,address)", keccak256("DEFAULT_ADMIN_ROLE"), msg.sender)
        );
        if (!ok || !abi.decode(data, (bool))) revert NotOwner();
        bidRegistry = _bidRegistry;
        emit BidRegistrySet(_bidRegistry);
    }

    /// @notice Emit a unified Purchased event for bid-based sales.
    ///         Only callable by the registered BidRegistry contract.
    function fulfillBidPurchase(
        address collection,
        uint256 tokenId,
        address buyer,
        address seller,
        address token,
        uint256 amount
    ) external {
        if (msg.sender != bidRegistry) revert OnlyBidRegistry();
        // Synthetic listing ID in the high range to distinguish from real listings
        emit Purchased((type(uint256).max / 2) + tokenId, buyer, seller, amount);
    }
}
