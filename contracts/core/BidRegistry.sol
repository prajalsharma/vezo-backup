// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IVeNFTMarketplaceForBids {
    function fulfillBidPurchase(address collection, uint256 tokenId, address buyer, address seller, address token, uint256 amount) external;
}

/// @title BidRegistry
/// @notice Escrow-based on-chain bid (offer) system for veBTC and veMEZO NFTs.
///         Bidders lock ERC-20 tokens; NFT owners accept to atomically exchange.
contract BidRegistry is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE_BPS      = 200;
    uint256 public constant MIN_BID_DURATION = 1 hours;
    uint256 public constant MAX_BID_DURATION = 30 days;

    struct Bid {
        address bidder;
        address bidToken;
        uint256 bidAmount;
        uint256 expiry;
        bool    active;
    }

    address public admin;
    uint256 public platformFeeBidBps;
    address public feeRecipient;
    address public marketplace;

    mapping(address => bool) public supportedTokens;
    mapping(address => bool) public supportedCollections;
    mapping(address => mapping(uint256 => Bid[])) private _bids;

    event BidPlaced(address indexed collection, uint256 indexed tokenId, uint256 indexed bidIndex, address bidder, address bidToken, uint256 bidAmount, uint256 expiry);
    event BidCancelled(address indexed collection, uint256 indexed tokenId, uint256 indexed bidIndex, address bidder);
    event BidAccepted(address indexed collection, uint256 indexed tokenId, uint256 indexed bidIndex, address bidder, address seller, address bidToken, uint256 bidAmount, uint256 fee);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event CollectionAdded(address indexed collection);
    event CollectionRemoved(address indexed collection);
    event FeeUpdated(uint256 oldBps, uint256 newBps);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event MarketplaceSet(address indexed marketplace);

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error UnsupportedToken(address token);
    error UnsupportedCollection(address collection);
    error BidNotActive();
    error BidExpired();
    error NotBidder();
    error NotNFTOwner();
    error FeeTooHigh(uint256 requested, uint256 max);
    error DurationOutOfRange();
    error DuplicateBid();

    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }

    /// @notice Deploy BidRegistry
    constructor(address _admin, address _feeRecipient, address _marketplace, uint256 _feeBps, address[] memory _tokens, address[] memory _collections) {
        if (_admin == address(0) || _feeRecipient == address(0) || _marketplace == address(0)) revert InvalidAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh(_feeBps, MAX_FEE_BPS);
        admin = _admin; feeRecipient = _feeRecipient; marketplace = _marketplace; platformFeeBidBps = _feeBps;
        for (uint256 i; i < _tokens.length;) { supportedTokens[_tokens[i]] = true; emit TokenAdded(_tokens[i]); unchecked{++i;} }
        for (uint256 i; i < _collections.length;) { supportedCollections[_collections[i]] = true; emit CollectionAdded(_collections[i]); unchecked{++i;} }
    }

    function addToken(address t) external onlyAdmin { supportedTokens[t] = true; emit TokenAdded(t); }
    function removeToken(address t) external onlyAdmin { supportedTokens[t] = false; emit TokenRemoved(t); }
    function addCollection(address c) external onlyAdmin { supportedCollections[c] = true; emit CollectionAdded(c); }
    function removeCollection(address c) external onlyAdmin { supportedCollections[c] = false; emit CollectionRemoved(c); }
    function setFee(uint256 bps) external onlyAdmin { if (bps > MAX_FEE_BPS) revert FeeTooHigh(bps, MAX_FEE_BPS); uint256 old = platformFeeBidBps; platformFeeBidBps = bps; emit FeeUpdated(old, bps); }
    function setFeeRecipient(address r) external onlyAdmin { if (r == address(0)) revert InvalidAddress(); feeRecipient = r; }
    function setMarketplace(address m) external onlyAdmin { if (m == address(0)) revert InvalidAddress(); marketplace = m; emit MarketplaceSet(m); }
    function transferAdmin(address a) external onlyAdmin { if (a == address(0)) revert InvalidAddress(); address old = admin; admin = a; emit AdminTransferred(old, a); }
    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    /// @notice Place a bid on a veNFT, locking bidToken into escrow.
    /// @param collection NFT contract address
    /// @param tokenId    Token to bid on
    /// @param bidToken   ERC-20 payment token
    /// @param bidAmount  Amount to lock
    /// @param duration   Bid lifetime in seconds (1h–30d)
    function placeBid(address collection, uint256 tokenId, address bidToken, uint256 bidAmount, uint256 duration) external whenNotPaused nonReentrant {
        if (!supportedCollections[collection]) revert UnsupportedCollection(collection);
        if (!supportedTokens[bidToken]) revert UnsupportedToken(bidToken);
        if (bidAmount == 0) revert InvalidAmount();
        if (duration < MIN_BID_DURATION || duration > MAX_BID_DURATION) revert DurationOutOfRange();

        Bid[] storage bids = _bids[collection][tokenId];
        for (uint256 i; i < bids.length;) { if (bids[i].active && bids[i].bidder == msg.sender) revert DuplicateBid(); unchecked{++i;} }

        IERC20(bidToken).safeTransferFrom(msg.sender, address(this), bidAmount);

        uint256 expiry   = block.timestamp + duration;
        uint256 bidIndex = bids.length;
        bids.push(Bid({ bidder: msg.sender, bidToken: bidToken, bidAmount: bidAmount, expiry: expiry, active: true }));

        emit BidPlaced(collection, tokenId, bidIndex, msg.sender, bidToken, bidAmount, expiry);
    }

    /// @notice Cancel a bid and reclaim escrowed tokens. Can be called anytime by bidder.
    function cancelBid(address collection, uint256 tokenId, uint256 bidIndex) external nonReentrant {
        Bid storage bid = _bids[collection][tokenId][bidIndex];
        if (!bid.active) revert BidNotActive();
        if (bid.bidder != msg.sender) revert NotBidder();

        bid.active = false;
        IERC20(bid.bidToken).safeTransfer(msg.sender, bid.bidAmount);
        emit BidCancelled(collection, tokenId, bidIndex, msg.sender);
    }

    /// @notice Accept a bid. Caller must own the NFT (or be approved operator).
    ///         Transfers NFT to bidder, releases escrowed funds to caller minus fee.
    function acceptBid(address collection, uint256 tokenId, uint256 bidIndex) external whenNotPaused nonReentrant {
        Bid storage bid = _bids[collection][tokenId][bidIndex];
        if (!bid.active) revert BidNotActive();
        if (block.timestamp > bid.expiry) revert BidExpired();

        IERC721 nft = IERC721(collection);
        address owner = nft.ownerOf(tokenId);
        if (msg.sender != owner && nft.getApproved(tokenId) != msg.sender && !nft.isApprovedForAll(owner, msg.sender)) revert NotNFTOwner();

        bid.active = false;

        address bidder    = bid.bidder;
        address bidToken  = bid.bidToken;
        uint256 bidAmount = bid.bidAmount;
        uint256 fee       = (bidAmount * platformFeeBidBps) / 10000;
        uint256 sellerAmt = bidAmount - fee;

        // Transfer NFT from seller to bidder (CEI: state already updated)
        nft.safeTransferFrom(msg.sender, bidder, tokenId);

        // Release escrow
        IERC20(bidToken).safeTransfer(msg.sender, sellerAmt);
        if (fee > 0) IERC20(bidToken).safeTransfer(feeRecipient, fee);

        // Emit unified Purchased event via marketplace (non-critical — wrapped in try/catch)
        if (marketplace != address(0)) {
            try IVeNFTMarketplaceForBids(marketplace).fulfillBidPurchase(collection, tokenId, bidder, msg.sender, bidToken, bidAmount) {} catch {}
        }

        emit BidAccepted(collection, tokenId, bidIndex, bidder, msg.sender, bidToken, bidAmount, fee);
    }

    /// @notice Return all bids for a token.
    function getBidsForToken(address collection, uint256 tokenId) external view returns (Bid[] memory) {
        return _bids[collection][tokenId];
    }

    /// @notice Return active non-expired bids and their indices.
    function getActiveBids(address collection, uint256 tokenId) external view returns (Bid[] memory activeBids, uint256[] memory indices) {
        Bid[] storage all = _bids[collection][tokenId];
        uint256 now_ = block.timestamp;
        uint256 count;
        for (uint256 i; i < all.length;) { if (all[i].active && all[i].expiry > now_) count++; unchecked{++i;} }
        activeBids = new Bid[](count); indices = new uint256[](count);
        uint256 j;
        for (uint256 i; i < all.length;) {
            if (all[i].active && all[i].expiry > now_) { activeBids[j] = all[i]; indices[j] = i; unchecked{++j;} }
            unchecked{++i;}
        }
    }

    /// @notice Count of active non-expired bids (for UI badge).
    function activeBidCount(address collection, uint256 tokenId) external view returns (uint256 count) {
        Bid[] storage all = _bids[collection][tokenId];
        uint256 now_ = block.timestamp;
        for (uint256 i; i < all.length;) { if (all[i].active && all[i].expiry > now_) count++; unchecked{++i;} }
    }
}
