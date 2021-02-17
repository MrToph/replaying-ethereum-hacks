import hre from "hardhat";
import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";

// follows ETH/BTC's BIP 39 protocol
// https://iancoleman.io/bip39/
// and matches the one hardhat uses when using { accounts: { mnemonic }}
task("accounts", "prints the first few accounts of a mnemonic")
  .addOptionalParam(
    "mnemonic",
    "The mnemonic used for BIP39 key derivation: See https://iancoleman.io/bip39"
  )
  .setAction(async function (taskArgs, hre, runSuper) {
    let { mnemonic } = taskArgs;

    if (!mnemonic) {
      mnemonic = process.env.MNEMONIC;
      if (!mnemonic) {
        throw new Error(`Missing task argument --mnemonic or MNEMONIC env var`);
      }
      console.warn(`Read MNEMONIC from environment var`);
    }
    const masterKey = hre.ethers.utils.HDNode.fromMnemonic(mnemonic);

    // "m/44'/60'/0'/0/0" first account
    const getPathForIndex = (index: number) => `m/44'/60'/0'/0/${index}`;

    Array.from({ length: 5 }).forEach((_, index) => {
      const key = masterKey.derivePath(getPathForIndex(index));
      console.log(
        `Key ${getPathForIndex(index)}: ${key.address} (PK: ${
          key.publicKey
        }) (sk: ${key.privateKey})`
      );
    });
  });
