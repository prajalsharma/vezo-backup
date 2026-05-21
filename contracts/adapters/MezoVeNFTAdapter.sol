// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IVotingEscrow.sol";
import "../interfaces/IMezoVeNFTAdapter.sol";

/// @title MezoVeNFTAdapter
/// @notice Adapter for querying veBTC and veMEZO intrinsic values and voting power
/// @dev Read-only contract - no state modifications, minimal attack surface
contract MezoVeNFTAdapter is IMezoVeNFTAdapter {
    /// @notice veBTC contract address (immutable for gas efficiency)
    address public immutable veBTC;

    /// @notice veMEZO contract address (immutable for gas efficiency)
    address public immutable veMEZO;

    /// @notice Week duration in seconds
    uint256 public constant WEEK = 7 days;

    /// @notice Maximum lock duration for veBTC (28 days)
    uint256 public constant MAX_LOCK_VEBTC = 28 days;

    /// @notice Maximum lock duration for veMEZO (4 years = 1456 days)
    uint256 public constant MAX_LOCK_VEMEZO = 1456 days;

    /// @notice Error when collection is not supported
    error UnsupportedCollection(address collection);

    /// @notice Deploy adapter with veBTC and veMEZO addresses
    /// @param _veBTC veBTC contract address
    /// @param _veMEZO veMEZO contract address
    constructor(address _veBTC, address _veMEZO) {
        require(_veBTC != address(0), "Invalid veBTC address");
        require(_veMEZO != address(0), "Invalid veMEZO address");
        veBTC = _veBTC;
        veMEZO = _veMEZO;
    }

    /// @inheritdoc IMezoVeNFTAdapter
    function getIntrinsicValue(
        address collection,
        uint256 tokenId
    ) external view override returns (uint256 amount, uint256 lockEnd) {
        _requireSupported(collection);
        try IVotingEscrow(collection).locked(tokenId) returns (IVotingEscrow.LockedBalance memory lock) {
            amount = lock.amount > 0 ? uint256(uint128(lock.amount)) : 0;
            lockEnd = lock.end;
        } catch {
            amount = 0;
            lockEnd = 0;
        }
    }

    /// @inheritdoc IMezoVeNFTAdapter
    /// @dev Computed from locked() data: amount * (end - now) / MAXTIME.
    ///      balanceOfNFT is not present on deployed Mezo veBTC/veMEZO contracts
    ///      (Velodrome v2 fork), so we replicate the linear decay formula on-chain.
    function getVotingPower(
        address collection,
        uint256 tokenId
    ) external view override returns (uint256) {
        _requireSupported(collection);
        try IVotingEscrow(collection).locked(tokenId) returns (IVotingEscrow.LockedBalance memory lock) {
            if (lock.amount <= 0) return 0;
            if (lock.end == 0) return uint256(uint128(lock.amount)); // permanent lock: full power
            if (block.timestamp >= lock.end) return 0; // expired
            uint256 maxLock = collection == veBTC ? MAX_LOCK_VEBTC : MAX_LOCK_VEMEZO;
            uint256 remaining = lock.end - block.timestamp;
            return (uint256(uint128(lock.amount)) * remaining) / maxLock;
        } catch {
            return 0;
        }
    }

    /// @inheritdoc IMezoVeNFTAdapter
    function isExpired(address collection, uint256 tokenId) external view override returns (bool) {
        _requireSupported(collection);
        // Defensive: if the locked() call fails or returns zero end, treat as not expired
        // so the buy flow is not blocked by adapter errors on edge-case tokens.
        try IVotingEscrow(collection).locked(tokenId) returns (IVotingEscrow.LockedBalance memory lock) {
            if (lock.end == 0) return false; // permanent lock or uninitialized — not expired
            return block.timestamp >= lock.end;
        } catch {
            return false;
        }
    }

    /// @inheritdoc IMezoVeNFTAdapter
    function calculateDiscount(
        uint256 listPrice,
        uint256 intrinsicValue
    ) external pure override returns (uint256 discountBps) {
        if (intrinsicValue == 0 || listPrice >= intrinsicValue) {
            return 0;
        }
        return ((intrinsicValue - listPrice) * 10000) / intrinsicValue;
    }

    /// @inheritdoc IMezoVeNFTAdapter
    function getTimeRemaining(
        address collection,
        uint256 tokenId
    ) external view override returns (uint256) {
        _requireSupported(collection);
        try IVotingEscrow(collection).locked(tokenId) returns (IVotingEscrow.LockedBalance memory lock) {
            if (lock.end == 0 || block.timestamp >= lock.end) return 0;
            return lock.end - block.timestamp;
        } catch {
            return 0;
        }
    }

    /// @inheritdoc IMezoVeNFTAdapter
    function isSupported(address collection) public view override returns (bool) {
        return collection == veBTC || collection == veMEZO;
    }

    /// @notice Get maximum lock duration for collection
    /// @param collection veBTC or veMEZO address
    /// @return Maximum lock duration in seconds
    function getMaxLockDuration(address collection) external view returns (uint256) {
        _requireSupported(collection);
        return collection == veBTC ? MAX_LOCK_VEBTC : MAX_LOCK_VEMEZO;
    }

    /// @notice Get lock health as percentage (100% = max lock)
    /// @param collection veBTC or veMEZO address
    /// @param tokenId Token ID to check
    /// @return healthBps Health in basis points (0-10000)
    function getLockHealth(
        address collection,
        uint256 tokenId
    ) external view returns (uint256 healthBps) {
        _requireSupported(collection);
        try IVotingEscrow(collection).locked(tokenId) returns (IVotingEscrow.LockedBalance memory lock) {
            if (lock.end == 0 || block.timestamp >= lock.end) return 0;

            uint256 remaining = lock.end - block.timestamp;
            uint256 maxLock = collection == veBTC ? MAX_LOCK_VEBTC : MAX_LOCK_VEMEZO;

            if (remaining >= maxLock) return 10000;
            return (remaining * 10000) / maxLock;
        } catch {
            return 0;
        }
    }

    /// @dev Require collection to be veBTC or veMEZO
    function _requireSupported(address collection) internal view {
        if (!isSupported(collection)) {
            revert UnsupportedCollection(collection);
        }
    }
}
