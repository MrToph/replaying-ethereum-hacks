import * as fs from "fs";
import hre from "hardhat";
import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { ethers } from "ethers";

task("get-code", "gets the code of an address")
  .addPositionalParam("address", "The address of the contract")
  .addOptionalParam("path", "The path to store the contract", `contract.evm`)
  .setAction(async function (taskArgs, hre, runSuper) {
    let { address, path } = taskArgs;

    const provider: ethers.providers.JsonRpcProvider = hre.ethers.provider;
    const code = await provider.getCode(address);
    const bytes = Buffer.from(code.replace(`0x`, ``), `hex`);
    console.log(`address`, address);
    console.log(`contract size`, bytes.byteLength, bytes.slice(0, 256));
    fs.writeFileSync(path, bytes);
  });
