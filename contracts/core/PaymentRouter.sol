// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IPaymentRouter.sol";

/// @title PaymentRouter
/// @notice Routes payments from buyers to sellers with protocol fee deduction
/// @dev Supports native BTC, MEZO, and MUSD tokens on Mezo network
contract PaymentRouter is IPaymentRouter, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Native BTC token address on Mezo
    address public constant BTC = 0x7b7C000000000000000000000000000000000000;

    /// @notice MEZO governance token address
    address public constant MEZO = 0x7B7c000000000000000000000000000000000001;

    /// @notice MUSD stablecoin address (mainnet)
    address public immutable MUSD;

    /// @notice Protocol fee in basis points (1 bp = 0.01%)
    uint256 public override protocolFeeBps;

    /// @notice Maximum allowed protocol fee (5%)
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Address receiving protocol fees
    address public override feeRecipient;

    /// @notice Admin address with fee control
    address public admin;

    /// @notice Authorized marketplace contract (only caller allowed for routePayment)
    address public marketplace;

    /// @notice Pending admin for two-step transfer
    address public pendingAdmin;

    /// @notice Mapping of supported payment tokens
    mapping(address => bool) public override supportedTokens;

    /// @notice Emitted when admin transfer is proposed
    event AdminTransferProposed(address indexed currentAdmin, address indexed pendingAdmin);

    /// @notice Emitted when admin transfer is accepted
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    /// @notice Emitted when token support is toggled
    event TokenSupportUpdated(address indexed token, bool supported);

    /// @notice Emitted when marketplace is set
    event MarketplaceSet(address indexed marketplace);

    /// @notice Error for invalid parameters
    error InvalidAddress();
    error InvalidAmount();
    error UnsupportedToken(address token);
    error FeeTooHigh(uint256 requested, uint256 maximum);
    error TransferFailed();
    error Unauthorized();
    error InsufficientPayment(uint256 sent, uint256 required);
    error AlreadySet();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    modifier onlyMarketplace() {
        if (msg.sender != marketplace) revert Unauthorized();
        _;
    }

    /// @notice Deploy PaymentRouter
    /// @param _feeRecipient Address to receive protocol fees
    /// @param _admin Admin address for fee management
    /// @param _musd MUSD token address
    /// @param _initialFeeBps Initial protocol fee in basis points
    constructor(
        address _feeRecipient,
        address _admin,
        address _musd,
        uint256 _initialFeeBps
    ) {
        if (_feeRecipient == address(0)) revert InvalidAddress();
        if (_admin == address(0)) revert InvalidAddress();
        if (_musd == address(0)) revert InvalidAddress();
        if (_initialFeeBps > MAX_FEE_BPS) revert FeeTooHigh(_initialFeeBps, MAX_FEE_BPS);

        feeRecipient = _feeRecipient;
        admin = _admin;
        MUSD = _musd;
        protocolFeeBps = _initialFeeBps;

        // Initialize supported tokens
        supportedTokens[BTC] = true;
        supportedTokens[MEZO] = true;
        supportedTokens[_musd] = true;
    }

    /// @notice Set the authorized marketplace address (admin only, one-time)
    /// @param _marketplace Address of the VeNFTMarketplace contract
    function setMarketplace(address _marketplace) external onlyAdmin {
        if (_marketplace == address(0)) revert InvalidAddress();
        if (marketplace != address(0)) revert AlreadySet();
        marketplace = _marketplace;
        emit MarketplaceSet(_marketplace);
    }

    /// @inheritdoc IPaymentRouter
    function routePayment(
        address buyer,
        address seller,
        address token,
        uint256 amount
    ) external payable override nonReentrant onlyMarketplace {
        if (buyer == address(0)) revert InvalidAddress();
        if (seller == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (!supportedTokens[token]) revert UnsupportedToken(token);

        (uint256 fee, uint256 sellerAmount) = calculateFee(amount);

        if (token == BTC) {
            // Native BTC payment
            if (msg.value != amount) revert InsufficientPayment(msg.value, amount);

            // Transfer to seller
            (bool sellerSuccess, ) = payable(seller).call{value: sellerAmount}("");
            if (!sellerSuccess) revert TransferFailed();

            // Transfer fee to treasury
            if (fee > 0) {
                (bool feeSuccess, ) = payable(feeRecipient).call{value: fee}("");
                if (!feeSuccess) revert TransferFailed();
            }
        } else {
            // ERC-20 payment - transfer from buyer
            if (msg.value != 0) revert InvalidAmount(); // No ETH with ERC20

            IERC20(token).safeTransferFrom(buyer, seller, sellerAmount);
            if (fee > 0) {
                IERC20(token).safeTransferFrom(buyer, feeRecipient, fee);
            }
        }

        emit PaymentRouted(buyer, seller, token, amount, fee);
    }

    /// @inheritdoc IPaymentRouter
    function calculateFee(
        uint256 amount
    ) public view override returns (uint256 fee, uint256 sellerAmount) {
        fee = (amount * protocolFeeBps) / 10000;
        sellerAmount = amount - fee;
    }

    /// @notice Set protocol fee (admin or MarketplaceAdmin only)
    /// @dev To enforce the 48-hour timelock, set PaymentRouter.admin to the MarketplaceAdmin
    ///      contract address so all fee changes flow through proposeFeeChange/executeFeeChange.
    /// @param _feeBps New fee in basis points
    function setProtocolFee(uint256 _feeBps) external onlyAdmin {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh(_feeBps, MAX_FEE_BPS);

        uint256 oldFee = protocolFeeBps;
        protocolFeeBps = _feeBps;

        emit ProtocolFeeUpdated(oldFee, _feeBps);
    }

    /// @notice Set fee recipient (admin only)
    /// @param _recipient New fee recipient address
    function setFeeRecipient(address _recipient) external onlyAdmin {
        if (_recipient == address(0)) revert InvalidAddress();

        address oldRecipient = feeRecipient;
        feeRecipient = _recipient;

        emit FeeRecipientUpdated(oldRecipient, _recipient);
    }

    /// @notice Add or remove supported token (admin only)
    /// @param token Token address to update
    /// @param supported Whether token should be supported
    function setTokenSupport(address token, bool supported) external onlyAdmin {
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }

    /// @notice Propose admin transfer (two-step: propose then accept)
    /// @param newAdmin New admin address
    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        pendingAdmin = newAdmin;
        emit AdminTransferProposed(admin, newAdmin);
    }

    /// @notice Accept admin role (must be called by the pending admin)
    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert Unauthorized();
        address oldAdmin = admin;
        admin = pendingAdmin;
        pendingAdmin = address(0);
        emit AdminTransferred(oldAdmin, admin);
    }

    /// @notice Sweep accidentally sent BTC to admin (admin only)
    function sweepBTC() external onlyAdmin nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert InvalidAmount();
        (bool success, ) = payable(admin).call{value: balance}("");
        if (!success) revert TransferFailed();
    }

    /// @notice Allow contract to receive native BTC
    receive() external payable {}
}
