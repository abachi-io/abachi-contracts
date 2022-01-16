// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;

import "../interfaces/IERC20.sol";
import "../types/Ownable.sol";

contract AbiFaucet is Ownable {
    IERC20 public abi;

    constructor(address _abi) {
        abi = IERC20(_abi);
    }

    function setAbi(address _abi) external onlyOwner {
        abi = IERC20(_abi);
    }

    function dispense() external {
        abi.transfer(msg.sender, 1e9);
    }
}
