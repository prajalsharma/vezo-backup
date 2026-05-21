// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title MarketplaceAdmin
/// @notice Admin controls for veNFT marketplace: pause, whitelist, fee governance
/// @dev Uses OpenZeppelin AccessControl for role-based permissions
contract MarketplaceAdmin is AccessControl, Pausable {
    /// @notice Role for emergency pause functionality
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Role for fee management
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    /// @notice Role for collection whitelist management
    bytes32 public constant COLLECTION_MANAGER_ROLE = keccak256("COLLECTION_MANAGER_ROLE");

    /// @notice Timelock duration for fee changes (48 hours)
    uint256 public constant FEE_TIMELOCK = 48 hours;

    /// @notice veBTC mainnet address
    address public constant VEBTC_MAINNET = 0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279;

    /// @notice veBTC testnet address
    address public constant VEBTC_TESTNET = 0x38E35d92E6Bfc6787272A62345856B13eA12130a;

    /// @notice veMEZO mainnet address
    address public constant VEMEZO_MAINNET = 0xb90fdAd3DFD180458D62Cc6acedc983D78E20122;

    /// @notice veMEZO testnet address
    address public constant VEMEZO_TESTNET = 0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b;

    /// @notice Pending fee change struct
    struct PendingFeeChange {
        uint256 newFeeBps;
        uint256 effectiveTime;
        bool pending;
    }

    /// @notice Pending fee change data
    PendingFeeChange public pendingFee;

    /// @notice Whitelisted collections mapping
    /// @dev Advisory only — VeNFTMarketplace enforces collection support via
    ///      MezoVeNFTAdapter.isSupported(), not this mapping. Changes here do not
    ///      block or enable listings on the marketplace. Retained for off-chain
    ///      governance tracking and potential future integration.
    mapping(address => bool) public supportedCollections;

    /// @notice Payment router address
    address public paymentRouter;

    /// @notice Emitted when collection is added to whitelist
    event CollectionAdded(address indexed collection);

    /// @notice Emitted when collection is removed from whitelist
    event CollectionRemoved(address indexed collection);

    /// @notice Emitted when fee change is proposed
    event FeeChangeProposed(uint256 newFeeBps, uint256 effectiveTime);

    /// @notice Emitted when fee change is executed
    event FeeChangeExecuted(uint256 newFeeBps);

    /// @notice Emitted when fee change is cancelled
    event FeeChangeCancelled();

    /// @notice Emitted on emergency pause
    event EmergencyPause(address indexed pauser, string reason);

    /// @notice Emitted when payment router is set
    event PaymentRouterSet(address indexed router);

    /// @notice Error for invalid operations
    error TimelockActive(uint256 remainingTime);
    error NoPendingChange();
    error InvalidAddress();
    error AlreadyWhitelisted();
    error NotWhitelisted();
    error PendingChangeExists();
    error RouterNotSet();

    /// @notice Deploy MarketplaceAdmin
    /// @param defaultAdmin Address receiving all admin roles
    /// @param isTestnet Whether deploying to testnet
    constructor(address defaultAdmin, bool isTestnet) {
        if (defaultAdmin == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(FEE_MANAGER_ROLE, defaultAdmin);
        _grantRole(COLLECTION_MANAGER_ROLE, defaultAdmin);

        // Whitelist appropriate veNFT collections
        if (isTestnet) {
            supportedCollections[VEBTC_TESTNET] = true;
            supportedCollections[VEMEZO_TESTNET] = true;
            emit CollectionAdded(VEBTC_TESTNET);
            emit CollectionAdded(VEMEZO_TESTNET);
        } else {
            supportedCollections[VEBTC_MAINNET] = true;
            supportedCollections[VEMEZO_MAINNET] = true;
            emit CollectionAdded(VEBTC_MAINNET);
            emit CollectionAdded(VEMEZO_MAINNET);
        }
    }

    /// @notice Set payment router address
    /// @param _router PaymentRouter contract address
    function setPaymentRouter(address _router) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_router == address(0)) revert InvalidAddress();
        paymentRouter = _router;
        emit PaymentRouterSet(_router);
    }

    /// @notice Accept admin role on PaymentRouter (completes two-step transfer)
    /// @dev Call after PaymentRouter.transferAdmin(thisContract) has been invoked.
    function acceptRouterAdmin() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (paymentRouter == address(0)) revert RouterNotSet();
        (bool success, ) = paymentRouter.call(
            abi.encodeWithSignature("acceptAdmin()")
        );
        require(success, "Accept admin failed");
    }

    /// @notice Emergency pause marketplace
    /// @param reason Human-readable reason for pause
    function emergencyPause(string calldata reason) external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender, reason);
    }

    /// @notice Unpause marketplace
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Propose fee change with timelock
    /// @dev Reverts if a proposal is already pending. Cancel the existing proposal first.
    /// @param _newFeeBps New fee in basis points (max 500 = 5%)
    function proposeFeeChange(uint256 _newFeeBps) external onlyRole(FEE_MANAGER_ROLE) {
        require(_newFeeBps <= 500, "Max 5%");
        if (pendingFee.pending) revert PendingChangeExists();

        pendingFee = PendingFeeChange({
            newFeeBps: _newFeeBps,
            effectiveTime: block.timestamp + FEE_TIMELOCK,
            pending: true
        });

        emit FeeChangeProposed(_newFeeBps, pendingFee.effectiveTime);
    }

    /// @notice Execute pending fee change after timelock
    /// @dev Reverts if paymentRouter has not been set via setPaymentRouter.
    function executeFeeChange() external onlyRole(FEE_MANAGER_ROLE) {
        if (!pendingFee.pending) revert NoPendingChange();
        if (block.timestamp < pendingFee.effectiveTime) {
            revert TimelockActive(pendingFee.effectiveTime - block.timestamp);
        }
        if (paymentRouter == address(0)) revert RouterNotSet();

        uint256 newFee = pendingFee.newFeeBps;

        // Reset pending state
        delete pendingFee;

        // Call PaymentRouter to update fee
        (bool success, ) = paymentRouter.call(
            abi.encodeWithSignature("setProtocolFee(uint256)", newFee)
        );
        require(success, "Fee update failed");

        emit FeeChangeExecuted(newFee);
    }

    /// @notice Cancel pending fee change
    function cancelFeeChange() external onlyRole(FEE_MANAGER_ROLE) {
        if (!pendingFee.pending) revert NoPendingChange();
        delete pendingFee;
        emit FeeChangeCancelled();
    }

    /// @notice Add collection to whitelist
    /// @param collection Collection address to add
    function addCollection(address collection) external onlyRole(COLLECTION_MANAGER_ROLE) {
        if (collection == address(0)) revert InvalidAddress();
        if (supportedCollections[collection]) revert AlreadyWhitelisted();

        supportedCollections[collection] = true;
        emit CollectionAdded(collection);
    }

    /// @notice Remove collection from whitelist
    /// @param collection Collection address to remove
    function removeCollection(address collection) external onlyRole(COLLECTION_MANAGER_ROLE) {
        if (!supportedCollections[collection]) revert NotWhitelisted();

        supportedCollections[collection] = false;
        emit CollectionRemoved(collection);
    }

    /// @notice Check if collection is supported
    /// @param collection Collection address to check
    /// @return True if collection is whitelisted
    function isCollectionSupported(address collection) external view returns (bool) {
        return supportedCollections[collection];
    }

    /// @notice Check if marketplace is paused
    /// @return True if paused
    function isPaused() external view returns (bool) {
        return paused();
    }

    /// @notice Get pending fee change details
    /// @return newFeeBps Proposed new fee
    /// @return effectiveTime When change can be executed
    /// @return isPending Whether change is pending
    function getPendingFeeChange()
        external
        view
        returns (uint256 newFeeBps, uint256 effectiveTime, bool isPending)
    {
        return (pendingFee.newFeeBps, pendingFee.effectiveTime, pendingFee.pending);
    }
}
