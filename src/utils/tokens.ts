import hre from "hardhat";
import { Contract, ethers } from "ethers";

export type TToken = {
  contract: Contract;
  symbol: string;
  decimals: number;
};

export const createTokenMap = async (
  tokenAddresses: string[]
): Promise<{ [address: string]: TToken }> => {
  const tokenContracts = await Promise.all(
    tokenAddresses.map((token) => hre.ethers.getContractAt(`IERC20`, token))
  );
  const tokenInfo = await Promise.all(
    tokenContracts.map((contract) => {
      return Promise.all([
        contract.symbol().catch(() => contract.address),
        contract.decimals().catch(() => 18),
      ]);
    })
  );

  return tokenContracts.reduce((acc, current, index) => {
    return {
      ...acc,
      [current.address]: {
        contract: current,
        symbol: tokenInfo[index][0],
        decimals: tokenInfo[index][1],
      },
    };
  }, {});
};
