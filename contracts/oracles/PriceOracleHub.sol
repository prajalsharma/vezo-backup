// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PriceOracleHub
/// @notice Modular, extensible price oracle hub for the Vezo marketplace.
///
/// @dev Design principles
///   • Oracle adapters are registered per asset symbol (e.g. "BTC", "MEZO", "MUSD").
///   • Each adapter is a contract implementing IPriceAdapter (see below).
///   • Prices are cached with a configurable staleness window; stale reads revert
///     so callers are never silently served bad data.
///   • Owner-governed: new feeds can be added, old ones updated, without redeployment.
///   • All prices are normalised to USD with 18 decimal places.
///   • The hub itself does NOT hold funds; it is purely a read-routing layer.
///
/// Extending feeds:
///   1. Deploy a new IPriceAdapter implementation (Chainlink, Pyth, TWAP, mock…).
///   2. Call registerFeed(symbol, adapterAddress, stalenessWindow).
///   3. Existing consumers automatically pick up the new feed on next call.

interface IPriceAdapter {
    /// @notice Returns the asset price in USD (18 dec) and the source timestamp
    function getPrice() external view returns (uint256 priceUsd18, uint256 updatedAt);
}

contract PriceOracleHub {

    // ─── Types ────────────────────────────────────────────────────────────────

    struct FeedConfig {
        IPriceAdapter adapter;          // Pluggable adapter contract
        uint256       stalenessWindow;  // Max age of a price (seconds). 0 = no check
        bool          active;           // Whether feed is currently live
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Owner (MarketplaceAdmin or deployer)
    address public owner;

    /// @notice Pending owner for two-step transfer
    address public pendingOwner;

    /// @notice symbol => FeedConfig
    mapping(bytes32 => FeedConfig) public feeds;

    /// @notice Registered symbol list (for enumeration off-chain)
    bytes32[] public registeredSymbols;

    /// @notice symbol => whether symbol is in registeredSymbols
    mapping(bytes32 => bool) private _symbolKnown;

    // ─── Events ───────────────────────────────────────────────────────────────

    event FeedRegistered(bytes32 indexed symbol, address indexed adapter, uint256 stalenessWindow);
    event FeedUpdated(bytes32 indexed symbol, address indexed newAdapter, uint256 stalenessWindow);
    event FeedDeactivated(bytes32 indexed symbol);
    event FeedActivated(bytes32 indexed symbol);
    event OwnershipTransferProposed(address indexed current, address indexed proposed);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Unauthorized();
    error FeedNotFound(bytes32 symbol);
    error FeedNotActive(bytes32 symbol);
    error StalePriceFeed(bytes32 symbol, uint256 updatedAt, uint256 maxAge);
    error InvalidAdapter();
    error FeedAlreadyRegistered(bytes32 symbol);
    error ZeroPrice(bytes32 symbol);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _owner) {
        require(_owner != address(0), "Invalid owner");
        owner = _owner;
    }

    // ─── Feed Management ──────────────────────────────────────────────────────

    /// @notice Register a new price feed
    /// @param symbol     Asset symbol, e.g. bytes32("BTC")
    /// @param adapter    IPriceAdapter implementation
    /// @param staleness  Maximum price age in seconds (0 = no staleness check)
    function registerFeed(
        bytes32 symbol,
        address adapter,
        uint256 staleness
    ) external onlyOwner {
        if (adapter == address(0)) revert InvalidAdapter();
        if (_symbolKnown[symbol] && feeds[symbol].active) revert FeedAlreadyRegistered(symbol);

        feeds[symbol] = FeedConfig({
            adapter:          IPriceAdapter(adapter),
            stalenessWindow:  staleness,
            active:           true
        });

        if (!_symbolKnown[symbol]) {
            registeredSymbols.push(symbol);
            _symbolKnown[symbol] = true;
        }

        emit FeedRegistered(symbol, adapter, staleness);
    }

    /// @notice Replace the adapter for an existing feed (e.g. upgrading oracle source)
    function updateFeed(
        bytes32 symbol,
        address newAdapter,
        uint256 staleness
    ) external onlyOwner {
        if (!_symbolKnown[symbol]) revert FeedNotFound(symbol);
        if (newAdapter == address(0)) revert InvalidAdapter();

        feeds[symbol].adapter         = IPriceAdapter(newAdapter);
        feeds[symbol].stalenessWindow = staleness;
        feeds[symbol].active          = true;

        emit FeedUpdated(symbol, newAdapter, staleness);
    }

    /// @notice Deactivate a feed (price queries for that symbol will revert)
    function deactivateFeed(bytes32 symbol) external onlyOwner {
        if (!_symbolKnown[symbol]) revert FeedNotFound(symbol);
        feeds[symbol].active = false;
        emit FeedDeactivated(symbol);
    }

    /// @notice Reactivate a previously deactivated feed
    function activateFeed(bytes32 symbol) external onlyOwner {
        if (!_symbolKnown[symbol]) revert FeedNotFound(symbol);
        feeds[symbol].active = true;
        emit FeedActivated(symbol);
    }

    // ─── Price Queries ────────────────────────────────────────────────────────

    /// @notice Get USD price for a symbol (18 dec). Reverts if stale or missing.
    /// @param symbol  e.g. bytes32("BTC"), bytes32("MEZO"), bytes32("MUSD")
    function getPrice(bytes32 symbol)
        external
        view
        returns (uint256 priceUsd18, uint256 updatedAt)
    {
        FeedConfig storage cfg = feeds[symbol];
        if (!_symbolKnown[symbol]) revert FeedNotFound(symbol);
        if (!cfg.active)           revert FeedNotActive(symbol);

        (priceUsd18, updatedAt) = cfg.adapter.getPrice();
        if (priceUsd18 == 0) revert ZeroPrice(symbol);

        if (cfg.stalenessWindow > 0) {
            if (block.timestamp > updatedAt + cfg.stalenessWindow) {
                revert StalePriceFeed(symbol, updatedAt, cfg.stalenessWindow);
            }
        }
    }

    /// @notice Try to get a price; returns (0, 0) instead of reverting.
    ///         Safe for UI reads where a best-effort value is acceptable.
    function tryGetPrice(bytes32 symbol)
        external
        view
        returns (uint256 priceUsd18, uint256 updatedAt, bool valid)
    {
        if (!_symbolKnown[symbol] || !feeds[symbol].active) {
            return (0, 0, false);
        }
        try feeds[symbol].adapter.getPrice() returns (uint256 p, uint256 ts) {
            if (p == 0) return (0, 0, false);
            if (
                feeds[symbol].stalenessWindow > 0 &&
                block.timestamp > ts + feeds[symbol].stalenessWindow
            ) {
                return (0, ts, false);
            }
            return (p, ts, true);
        } catch {
            return (0, 0, false);
        }
    }

    /// @notice Convert an amount of tokenA to USD (18 dec)
    /// @param symbol    Symbol for tokenA (e.g. bytes32("BTC"))
    /// @param amount    Amount in tokenA units (18 dec)
    function toUsd(bytes32 symbol, uint256 amount)
        external
        view
        returns (uint256 usdAmount)
    {
        (uint256 price, ) = this.getPrice(symbol);
        // price is 18 dec, amount is 18 dec → result is 18 dec
        usdAmount = (amount * price) / 1e18;
    }

    /// @notice Convert USD amount (18 dec) to token units (18 dec)
    function fromUsd(bytes32 symbol, uint256 usdAmount)
        external
        view
        returns (uint256 tokenAmount)
    {
        (uint256 price, ) = this.getPrice(symbol);
        require(price > 0, "Zero price");
        tokenAmount = (usdAmount * 1e18) / price;
    }

    /// @notice Get all registered symbols (for off-chain enumeration)
    function getRegisteredSymbols() external view returns (bytes32[] memory) {
        return registeredSymbols;
    }

    /// @notice Check if a symbol has an active feed
    function hasFeed(bytes32 symbol) external view returns (bool) {
        return _symbolKnown[symbol] && feeds[symbol].active;
    }

    // ─── Ownership ────────────────────────────────────────────────────────────

    function proposeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid");
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address old = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(old, owner);
    }
}
