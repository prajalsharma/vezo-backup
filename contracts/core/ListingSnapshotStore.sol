// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IMezoVeNFTAdapter.sol";

/// @title ListingSnapshotStore
/// @notice Stores immutable veNFT snapshots at listing creation time.
///
/// @dev Architecture
///   • This is a pure additive companion to VeNFTMarketplace.sol.
///   • VeNFTMarketplace.listNFT() can call recordSnapshot() right after creating
///     a listing, or the frontend can call recordSnapshot() separately.
///   • Snapshots are write-once: once recorded for a listingId they cannot be
///     overwritten, preserving historical accuracy.
///   • No existing contract storage is touched — purely additive mappings.
///
/// Why this matters:
///   • veNFT intrinsic value and voting power change continuously with time decay.
///   • Without snapshots, "discount at listing" shown in the UI is actually
///     "discount right now", leading to inconsistent historical analytics.
///   • Storing snapshots off-chain from events is possible, but on-chain snapshots
///     allow smart contracts (e.g. acceptBid) to reference listing-time context.

contract ListingSnapshotStore {

    // ─── Types ────────────────────────────────────────────────────────────────

    /// @notice Snapshot captured at the moment a listing is created
    struct ListingSnapshot {
        /// @dev Intrinsic value in locked-token units (18 dec) at list time
        uint256 intrinsicValueAtListing;
        /// @dev Voting power (18 dec) at list time
        uint256 votingPowerAtListing;
        /// @dev Seconds remaining on the lock at list time
        uint256 lockDurationAtListing;
        /// @dev Lock expiry timestamp copied from the veNFT at list time
        uint256 lockEndAtListing;
        /// @dev Discount in basis points vs intrinsic value at list time (0-10000)
        uint256 discountBpsAtListing;
        /// @dev USD-normalised intrinsic value (scaled 1e18, oracle-dependent)
        ///      Set to 0 if no oracle is available at list time.
        uint256 usdValueAtListing;
        /// @dev Block timestamp when snapshot was taken
        uint256 snapshotTimestamp;
        /// @dev Whether this snapshot has been recorded
        bool exists;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Adapter used to read veNFT values at snapshot time
    IMezoVeNFTAdapter public immutable adapter;

    /// @notice Authorised recorder — the marketplace contract or admin
    address public immutable marketplace;

    /// @notice listing ID => ListingSnapshot
    mapping(uint256 => ListingSnapshot) public snapshots;

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a snapshot is recorded
    event SnapshotRecorded(
        uint256 indexed listingId,
        address indexed collection,
        uint256 indexed tokenId,
        uint256 intrinsicValue,
        uint256 votingPower,
        uint256 lockDuration,
        uint256 lockEnd,
        uint256 discountBps,
        uint256 usdValue,
        uint256 timestamp
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Unauthorized();
    error SnapshotAlreadyExists(uint256 listingId);
    error InvalidListingParams();

    // ─── Constructor ──────────────────────────────────────────────────────────

    /// @param _adapter  MezoVeNFTAdapter address
    /// @param _marketplace  Address authorised to record snapshots (VeNFTMarketplace)
    constructor(address _adapter, address _marketplace) {
        require(_adapter    != address(0), "Invalid adapter");
        require(_marketplace != address(0), "Invalid marketplace");
        adapter     = IMezoVeNFTAdapter(_adapter);
        marketplace = _marketplace;
    }

    // ─── External ─────────────────────────────────────────────────────────────

    /// @notice Record a snapshot for a newly created listing.
    ///         Can only be called by the authorised marketplace contract.
    ///         Idempotent guard: reverts if snapshot already recorded.
    ///
    /// @param listingId    The ID assigned by VeNFTMarketplace
    /// @param collection   veBTC or veMEZO address
    /// @param tokenId      NFT token ID
    /// @param listPrice    Listing price in payment token
    /// @param usdValue     USD-normalised value (pass 0 if oracle not available)
    function recordSnapshot(
        uint256 listingId,
        address collection,
        uint256 tokenId,
        uint256 listPrice,
        uint256 usdValue
    ) external {
        if (msg.sender != marketplace) revert Unauthorized();
        if (snapshots[listingId].exists) revert SnapshotAlreadyExists(listingId);
        if (collection == address(0)) revert InvalidListingParams();

        // Read live values from adapter — these are the "at listing" values
        (uint256 intrinsicValue, uint256 lockEnd) = adapter.getIntrinsicValue(collection, tokenId);
        uint256 votingPower = adapter.getVotingPower(collection, tokenId);
        uint256 timeRemaining = adapter.getTimeRemaining(collection, tokenId);
        uint256 discountBps = adapter.calculateDiscount(listPrice, intrinsicValue);

        snapshots[listingId] = ListingSnapshot({
            intrinsicValueAtListing: intrinsicValue,
            votingPowerAtListing:    votingPower,
            lockDurationAtListing:   timeRemaining,
            lockEndAtListing:        lockEnd,
            discountBpsAtListing:    discountBps,
            usdValueAtListing:       usdValue,
            snapshotTimestamp:       block.timestamp,
            exists:                  true
        });

        emit SnapshotRecorded(
            listingId,
            collection,
            tokenId,
            intrinsicValue,
            votingPower,
            timeRemaining,
            lockEnd,
            discountBps,
            usdValue,
            block.timestamp
        );
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    /// @notice Retrieve snapshot for a listing.
    /// @return snap The snapshot struct (snap.exists is false if none recorded)
    function getSnapshot(uint256 listingId)
        external
        view
        returns (ListingSnapshot memory snap)
    {
        return snapshots[listingId];
    }

    /// @notice Convenience: return just the discount at listing time
    function getListingDiscount(uint256 listingId)
        external
        view
        returns (uint256 discountBps, bool exists_)
    {
        ListingSnapshot storage s = snapshots[listingId];
        return (s.discountBpsAtListing, s.exists);
    }
}
