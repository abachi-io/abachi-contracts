const { ethers } = require("hardhat");

const governor = { address: '0x0000000000f1d80C6D27fB1b2faC8BF6E769f0B5'} // required
const guardian  = { address: '0x0000000000f1d80C6D27fB1b2faC8BF6E769f0B5'} // required
const policy = { address: '0x0000000000f1d80C6D27fB1b2faC8BF6E769f0B5'} // required
const vault = { address: '0x0000000000000000000000000000000000000000'} // set later

async function main() {

    const [deployer] = await ethers.getSigners();

    console.log('Deploying contracts with the account: ' + deployer.address);
    console.log('----------------------------------------------------------------------------------')

    const AbachiAuthority = await ethers.getContractFactory('AbachiAuthority');
    console.log('Deploying AbachiAuthority.sol')
    const abachiAuthority = await AbachiAuthority.deploy(governor.address, guardian.address, policy.address, vault.address);
    console.log( "AbachiAuthority: " + abachiAuthority.address + '\n');

    const ABI = await ethers.getContractFactory('Abachi');
    console.log('Deploying Abachi.sol')
    const abi = await ABI.deploy(abachiAuthority.address);
    console.log( "Abachi: " + abi.address + '\n');

    console.log('----------------------------------------------------------------------------------')
    console.log( "AbachiAuthority: " + abachiAuthority.address);
    console.log( "Abachi: " + abi.address);
}

main()
    .then(() => process.exit())
    .catch(error => {
        console.error(error);
        process.exit(1);
})
