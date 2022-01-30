# Abachi Smart Contracts

## Table of Contents
- [Required Tools](#required-tools)
- [Getting Started](#getting-started)
- [Contracts](#contracts)
- [Contribution](#contribution)


## Required Tools
* Node v14
* Git

## Getting Started

#### Setup
```
git clone https://github.com/abachi-io/abachi-contracts.git

cd abachi-contracts

npm i

cp .env.example .env
```

* Edit `.env` file
* Edit scripts/deployAll.js and fill out `//required` addresses

#### Compile Contracts

`npx hardhat compile`

#### Deploy

`npx hardhat run scripts/deployAll.js --network [NETWORK]`

#### Verify Contracts on Etherscan/Polyscan (optional)

`npx hardhat verify --network [NETWORK] [CONTRACT ADDRESS] [CONSTRUCTOR PARAM 1] [CONSTRUCTOR PARAM 2]`

#### Test contracts
`npx hardhat test`

* To test using a local chain, add a comma separated list of private keys from the local rpc server
* Update default network in hardhat config file to `localhost`

## Contracts

#### Matic Mainnet (Polygon)

|       Contract    | Address |
|     ------------- | ------------- |
| Abachi Authority      | [0x4b2Bd29b81D32e3DbCeB47260f0BbC76A6A0B8cd](https://polygonscan.com/address/0x4b2Bd29b81D32e3DbCeB47260f0BbC76A6A0B8cd)   |
| Abachi (ABI)           | [0x6d5f5317308C6fE7D6CE16930353a8Dfd92Ba4D7](https://polygonscan.com/address/0x6d5f5317308C6fE7D6CE16930353a8Dfd92Ba4D7)   |
| sABI     | [0x925a785a347f4a03529b06C50fa1b9a10808CAb5](https://polygonscan.com/address/0x925a785a347f4a03529b06C50fa1b9a10808CAb5)   |
| gABI     | [0xEd6AAb1615AaC7BC4C108dFd4Fdc9AD0c8304d47](https://polygonscan.com/address/0xEd6AAb1615AaC7BC4C108dFd4Fdc9AD0c8304d47)   |
| AbachiStaking    | [0x321019dC2dF5d09A47D3Cf4D8319E82feF9d75d4](https://polygonscan.com/address/0x321019dC2dF5d09A47D3Cf4D8319E82feF9d75d4)   |
| BondingCalculator     | [0x9d38B914B3755a697EEA39d9A146eb1a39516bc8](https://polygonscan.com/address/0x9d38B914B3755a697EEA39d9A146eb1a39516bc8)   |
| Bond Depository (V2)     | [0xC55686ccad36cF586F79658529e3A4E9bb43ddAf](https://polygonscan.com/address/0xC55686ccad36cF586F79658529e3A4E9bb43ddAf)   |
| DAI Bond (V1)     | [0x105BcdDaBDF5e8a4e14C8e23B2E8d9BA220143c2 ](https://polygonscan.com/address/0x105BcdDaBDF5e8a4e14C8e23B2E8d9BA220143c2 )   |

## Contribution

Thank you for considering to help out with the source code! We welcome contributions from anyone on the internet, and are grateful for even the smallest of fixes!

If you'd like to contribute to Abachi, please fork, fix, commit and send a pull request for the maintainers to review and merge into the main code base.

Please make sure your contributions adhere to our coding guidelines:

* Pull requests need to be based on and opened against the master branch.
* Pull request should have a detailed explanation about the enhancement or fix
* Commit messages should be prefixed with the file they modify.

Please see the [First Contributer's Guide](documentation/CONTRIBUTE.md) for more details on how to configure your git environment.
