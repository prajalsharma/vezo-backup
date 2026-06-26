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

/// @title MockUniV2Router
/// @notice Minimal Uniswap-V2-compatible router for testing SwapPaymentRouter.
///         1:1 token-for-token conversion; must be pre-funded with the output token.
contract MockUniV2Router {
    using SafeERC20 for IERC20;

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 out = amountIn; // 1:1
        require(out >= amountOutMin, "MockUni: min out");
        IERC20(tokenOut).safeTransfer(to, out);
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = out;
    }

    function swapExactTokensForETH(uint256, uint256, address[] calldata, address, uint256)
        external
        pure
        returns (uint256[] memory)
    {
        revert("MockUni: ETH path not used");
    }

    function swapExactETHForTokens(uint256, address[] calldata, address, uint256)
        external
        payable
        returns (uint256[] memory)
    {
        revert("MockUni: ETH path not used");
    }
}
