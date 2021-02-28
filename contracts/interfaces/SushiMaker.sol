pragma solidity >=0.5.0;

interface SushiMaker {
    event LogBridgeSet(address indexed token, address indexed bridge);

    function convert(address token0, address token1) external;
}
