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
