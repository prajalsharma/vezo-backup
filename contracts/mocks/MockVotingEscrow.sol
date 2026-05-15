// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title MockVotingEscrow
/// @notice Mock veNFT contract for testing
contract MockVotingEscrow is ERC721 {
    struct LockedBalance {
        int128 amount;
        uint256 end;
    }

    uint256 private _nextTokenId = 1;

    mapping(uint256 => LockedBalance) private _locks;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    /// @notice Create a mock veNFT position
    function createLock(address to, int128 amount, uint256 lockEnd) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _locks[tokenId] = LockedBalance({amount: amount, end: lockEnd});
        return tokenId;
    }

    /// @notice Set lock data for testing
    function setLock(uint256 tokenId, int128 amount, uint256 lockEnd) external {
        _locks[tokenId] = LockedBalance({amount: amount, end: lockEnd});
    }

    function locked(uint256 tokenId) external view returns (LockedBalance memory) {
        return _locks[tokenId];
    }

    function balanceOfNFT(uint256 tokenId) external view returns (uint256) {
        LockedBalance memory lock = _locks[tokenId];
        if (block.timestamp >= lock.end) return 0;

        // Simplified linear decay
        uint256 remaining = lock.end - block.timestamp;
        uint256 maxLock = 28 days; // Simplified for testing
        uint256 amount = uint256(uint128(lock.amount));

        return (amount * remaining) / maxLock;
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokens = new uint256[](balance);
        uint256 index = 0;

        for (uint256 i = 1; i < _nextTokenId && index < balance; i++) {
            if (_ownerOf(i) == owner) {
                tokens[index++] = i;
            }
        }

        return tokens;
    }

    function tokenByIndex(uint256 index) external view returns (uint256) {
        require(index < _nextTokenId - 1, "Index out of bounds");
        return index + 1;
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }
}
