import { Contract } from "ethers";

type TEventSpec = () => { name: string; filterArgs: any[] };

const getEvents = async (
  contract: Contract, // needs to define the event in ABI
  eventSpec: TEventSpec,
  from: number | string = 0,
  to: number | string = "latest"
) => {
  // can also define the event as abi
  // ["event Transfer(bytes32 indexed node, address owner)"];

  const eventArgs = eventSpec();
  // event Transfer(address indexed from, address indexed to, uint256 value);
  // event Approval(address indexed owner, address indexed spender, uint256 value);
  // filterArgs are the event's indexed args
  const filter = contract.filters[eventArgs.name](...eventArgs.filterArgs);

  const logs = await contract.queryFilter(filter, from, to);
  return logs;
}

export {
  getEvents,
};
