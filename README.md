# Replaying Ethereum Hacks

Repo for [Replaying Ethereum hacks](https://cmichel.io/replaying-ethereum-hacks-introduction/).

# Setup

```bash
npm i
```

#### Hardhat

This repo uses [hardhat](https://hardhat.org/).
Hacks are implemented as hardhat tests in [`/test`](./test).

The tests run on a local hardnet network but it needs to be forked from mainnet.
To fork the Ethereum mainnet, you need access to an archive node like the free ones from [Alchemy](https://alchemyapi.io/).

#### Environment variables

Add your Ethereum archival node URL to the `.env` file

```bash
cp .env.template .env
# fill out
ARCHIVE_URL=https://eth-mainnet.alchemyapi.io/v2/...
```

#### Replaying hack

The hacks are implemented as hardhat tests and can therefore be run as:

```bash
npx hardhat test test/<name>.ts
```

#### Debugging transactions with tenderly

Set up `tenderly.yaml` in the repo root and follow [this article](http://blog.tenderly.co/level-up-your-smart-contract-productivity-using-hardhat-and-tenderly/).

TLDR:

```bash
# run this in second terminal
npx hardhat node
# run test against local network
npx hardhat test test/foo.js --network local
# you want an actual tx id which means the tx may not fail in eth_estimateGas already
# therefore hardcode some gas values
# {value: ethers.utils.parseEther(`100`), gasLimit: `15000000`, gasPrice: ethers.utils.parseUnits(`200`, 9) }
# the (failed) tx hash appears on the CLI after "eth_sendTransaction"
# --force is required to skip gas estimation check in tenderly
tenderly export <txHash> --force
```