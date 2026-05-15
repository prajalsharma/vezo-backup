// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PriceOracleHub.sol";

/// @title MockPriceAdapter
/// @notice Simple price adapter for testing and initial deployment.
///         Admin can push prices manually; production deployments should replace
///         this with a Chainlink / Pyth adapter that reads from a real oracle.
///
/// @dev Implements IPriceAdapter from PriceOracleHub.
///      For production: deploy ChainlinkPriceAdapter.sol (not included here)
///      pointing at the relevant Chainlink aggregator on Mezo.

contract MockPriceAdapter is IPriceAdapter {

    address public owner;
    uint256 private _price;      // USD price, 18 dec
    uint256 private _updatedAt;

    event PriceSet(uint256 price, uint256 updatedAt);

    error Unauthorized();
    error ZeroPrice();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _owner, uint256 initialPrice) {
        require(_owner != address(0), "Invalid owner");
        owner       = _owner;
        _price      = initialPrice;
        _updatedAt  = block.timestamp;
    }

    /// @notice Push a new price (admin only — in production, use a real oracle)
    function setPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert ZeroPrice();
        _price     = newPrice;
        _updatedAt = block.timestamp;
        emit PriceSet(newPrice, block.timestamp);
    }

    /// @inheritdoc IPriceAdapter
    function getPrice() external view override returns (uint256 priceUsd18, uint256 updatedAt) {
        return (_price, _updatedAt);
    }
}
