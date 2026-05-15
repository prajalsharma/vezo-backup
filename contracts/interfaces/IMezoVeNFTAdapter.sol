// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IMezoVeNFTAdapter Interface
/// @notice Interface for querying veNFT intrinsic values and voting power
interface IMezoVeNFTAdapter {
    /// @notice Get intrinsic value and lock end time for a veNFT
    /// @param collection veBTC or veMEZO contract address
    /// @param tokenId The NFT token ID
    /// @return amount Locked token amount (18 decimals)
    /// @return lockEnd Unix timestamp when lock expires
    function getIntrinsicValue(
        address collection,
        uint256 tokenId
    ) external view returns (uint256 amount, uint256 lockEnd);

    /// @notice Get current voting power (after decay)
    /// @param collection veBTC or veMEZO contract address
    /// @param tokenId The NFT token ID
    /// @return Current voting power
    function getVotingPower(address collection, uint256 tokenId) external view returns (uint256);

    /// @notice Check if lock has expired
    /// @param collection veBTC or veMEZO contract address
    /// @param tokenId The NFT token ID
    /// @return True if lock has expired
    function isExpired(address collection, uint256 tokenId) external view returns (bool);

    /// @notice Calculate discount percentage vs intrinsic value
    /// @param listPrice Listed price in payment token
    /// @param intrinsicValue Value of locked tokens
    /// @return discountBps Discount in basis points
    function calculateDiscount(
        uint256 listPrice,
        uint256 intrinsicValue
    ) external pure returns (uint256 discountBps);

    /// @notice Get time remaining on lock
    /// @param collection veBTC or veMEZO contract address
    /// @param tokenId The NFT token ID
    /// @return Seconds remaining until lock expires
    function getTimeRemaining(address collection, uint256 tokenId) external view returns (uint256);

    /// @notice Check if collection is supported (veBTC or veMEZO)
    function isSupported(address collection) external view returns (bool);
}
