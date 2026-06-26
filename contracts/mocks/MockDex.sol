// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockDexAdapter
/// @notice Test double implementing SwapRouter's IDexAdapter. 1:1 conversion.
///         Must be pre-funded with the output token.
contract MockDexAdapter {
    using SafeERC20 for IERC20;

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        amountOut = amountIn; // 1:1
        require(amountOut >= minAmountOut, "MockDex: min out");
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }
}

/// @title MockVeloPool
/// @notice Minimal Velodrome-v2 pool for testing SwapPaymentRouter. 1:1 output;
///         must be pre-funded with the output token. The router transfers the
///         input token in before calling swap(), mirroring the real pool.
contract MockVeloPool {
    using SafeERC20 for IERC20;
    address public token0;
    address public token1;

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function getAmountOut(uint256 amountIn, address) external pure returns (uint256) {
        return amountIn; // 1:1
    }

    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata) external {
        if (amount0Out > 0) IERC20(token0).safeTransfer(to, amount0Out);
        if (amount1Out > 0) IERC20(token1).safeTransfer(to, amount1Out);
    }
}

/// @title MockVeloPoolFactory
/// @notice Returns a single configured pool for any token pair (test double).
contract MockVeloPoolFactory {
    address public pool;
    function setPool(address _pool) external { pool = _pool; }
    function getPool(address, address, bool) external view returns (address) { return pool; }
}
