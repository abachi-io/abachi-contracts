// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

//import {IgABI} from "../interfaces/IgABI.sol";
import {MockERC20} from "./MockERC20.sol";

// TODO fulfills IgABI but is not inheriting because of dependency issues
contract MockGAbi is MockERC20 {

    /* ========== CONSTRUCTOR ========== */

    uint256 public immutable index;

    constructor(uint256 _initIndex)
        MockERC20("Governance ABI", "gABI", 18)
    {
        index = _initIndex;
    }

    function migrate(address _staking, address _sAbi) external {}

    function balanceFrom(uint256 _amount) public view returns (uint256) {
        return _amount * index / 10**decimals;
    }

    function balanceTo(uint256 _amount) public view returns (uint256) {
        return _amount * (10 ** decimals) / index;
    }
}
