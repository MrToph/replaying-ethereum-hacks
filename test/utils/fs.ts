import path from 'path'

export const getAttackerContractName = (testPath:string) => {
  const fileNameNoExtension = path.parse(testPath).name
  return `contracts/${fileNameNoExtension}/Attacker.sol:Attacker`
}