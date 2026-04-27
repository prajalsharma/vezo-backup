// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IVotingEscrow Interface
/// @notice Interface for Mezo veBTC and veMEZO contracts
interface IVotingEscrow {
    struct LockedBalance {
        int128 amount;
        uint256 end;
    }

    /// @notice Get locked balance for a token ID
    function locked(uint256 tokenId) external view returns (LockedBalance memory);

    /// @notice Get current voting power for a token ID (after decay)
    function balanceOfNFT(uint256 tokenId) external view returns (uint256);

    /// @notice Get owner of a token ID
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice Check if token exists
    function exists(uint256 tokenId) external view returns (bool);

    /// @notice Get total supply of tokens
    function totalSupply() external view returns (uint256);

    /// @notice Get token by index
    function tokenByIndex(uint256 index) external view returns (uint256);

    /// @notice Get tokens owned by address
    function tokensOfOwner(address owner) external view returns (uint256[] memory);
}
