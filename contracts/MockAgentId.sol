// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockAgentId — Minimal ERC-721 for TESTNET testing ONLY
/// @notice Mimics the real Agent ID contract's balanceOf() gate.
///         NOT the real contract, NOT for mainnet. Anyone may mint a
///         test token to any address so the positive check-in path can
///         be exercised on BSC testnet.
contract MockAgentId {
    string public name = "Mock Agent ID";
    string public symbol = "MAID";

    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _owners;
    uint256 private _nextId = 1;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "zero address");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "nonexistent token");
        return o;
    }

    /// @notice Mint one test Agent ID to `to`. Testnet only.
    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextId++;
        _owners[tokenId] = to;
        _balances[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function totalSupply() external view returns (uint256) {
        return _nextId - 1;
    }
}
