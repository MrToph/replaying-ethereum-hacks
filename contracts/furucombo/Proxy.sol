/**
 *Submitted for verification at Etherscan.io on 2021-01-09
 https://etherscan.io/address/0x17e8Ca1b4798B97602895f63206afCd1Fc90Ca5f#code
*/

pragma solidity ^0.8.0;

interface IRegistry {
    function infos(address) external view returns (bytes32);

    function isValid(address handler) external view returns (bool result);
}

/**
 * @title The entrance of Furucombo
 * @author Ben Huang
 */
interface IProxy {
    /**
     * @notice Combo execution function. Including three phases: pre-process,
     * exection and post-process.
     * @param tos The handlers of combo.
     * @param configs The configurations of executing cubes.
     * @param datas The combo datas.
     */
    function batchExec(
        address[] memory tos,
        bytes32[] memory configs,
        bytes[] memory datas
    ) external;
}

// https://etherscan.io/address/0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9#code
interface IAaveV2Proxy {
    function initialize(address _logic, bytes memory _data) external payable;
}