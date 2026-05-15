// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IPaymentRouter Interface
/// @notice Interface for multi-token payment routing with protocol fees
interface IPaymentRouter {
    /// @notice Emitted when a payment is routed
    event PaymentRouted(
        address indexed buyer,
        address indexed seller,
        address indexed token,
        uint256 amount,
        uint256 fee
    );

    /// @notice Emitted when protocol fee is updated
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);

    /// @notice Emitted when fee recipient is updated
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    /// @notice Route payment from buyer to seller with fee
    /// @param buyer Address making payment (for ERC20 transfers)
    /// @param seller Address receiving payment
    /// @param token Payment token address (use BTC constant for native)
    /// @param amount Total payment amount
    function routePayment(address buyer, address seller, address token, uint256 amount) external payable;

    /// @notice Calculate fee breakdown for an amount
    /// @param amount Total amount
    /// @return fee Protocol fee amount
    /// @return sellerAmount Amount after fee deduction
    function calculateFee(uint256 amount) external view returns (uint256 fee, uint256 sellerAmount);

    /// @notice Check if token is supported for payments
    function supportedTokens(address token) external view returns (bool);

    /// @notice Get current protocol fee in basis points
    function protocolFeeBps() external view returns (uint256);

    /// @notice Get fee recipient address
    function feeRecipient() external view returns (address);

    /// @notice Get BTC address constant
    function BTC() external pure returns (address);

    /// @notice Get authorized marketplace address
    function marketplace() external view returns (address);
}
