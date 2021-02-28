import dotenv from "dotenv";
dotenv.config(); // load env vars from .env
import { task, HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@tenderly/hardhat-tenderly";
import "./tasks/index";

const { ARCHIVE_URL } = process.env;

if (!ARCHIVE_URL)
  throw new Error(
    `ARCHIVE_URL env var not set. Copy .env.template to .env and set the env var`
  );

const accounts = {
  // use default accounts
  mnemonic: `test test test test test test test test test test test junk`,
};

// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      // add missing versions here
      { version: "0.4.11" },
      { version: "0.6.2" },
      { version: "0.7.0" },
      { version: "0.8.0" },
    ],
  },
  networks: {
    hardhat: {
      accounts,
      loggingEnabled: false,
      forking: {
        url: ARCHIVE_URL, // https://eth-mainnet.alchemyapi.io/v2/SECRET`,
        blockNumber: 11800000, // we will set this in each test
      },
    },
    // local: {
    //   url: "http://127.0.0.1:8545",
    // },
  },
  mocha: {
    timeout: 300 * 1e3,
  },
  // tenderly: {
  //   username: process.env.TENDERLY_USERNAME!,
  //   project: process.env.TENDERLY_PROJECT!,
  // },
};

export default config;
