// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;

import "ds-test/test.sol"; // ds-test
import "../../../contracts/AbachiERC20.sol";

import "../../../contracts/AbachiAuthority.sol";


contract AbachiTest is DSTest {
    Abachi internal abiContract;

    IAbachiAuthority internal authority;

    address internal UNAUTHORIZED_USER = address(0x1);


    function test_erc20() public {
        authority = new AbachiAuthority(address(this), address(this), address(this), address(this));
        abiContract = new Abachi(address(authority));
        assertEq("Abachi", abiContract.name());
        assertEq("ABI", abiContract.symbol());
        assertEq(9, int(abiContract.decimals()));
    }

    function testCannot_mint() public {
        authority = new AbachiAuthority(address(this), address(this), address(this), UNAUTHORIZED_USER);
        abiContract = new AbachiERC20Token(address(authority));
        // try/catch block pattern copied from https://github.com/Anish-Agnihotri/MultiRaffle/blob/master/src/test/utils/DSTestExtended.sol
        try abiContract.mint(address(this), 100) {
            fail();
        } catch Error(string memory error) {
            // Assert revert error matches expected message
            assertEq("UNAUTHORIZED", error);
        }
    }

    // Tester will pass it's own parameters, see https://fv.ethereum.org/2020/12/11/symbolic-execution-with-ds-test/
    function test_mint(uint256 amount) public {
        authority = new AbachiAuthority(address(this), address(this), address(this), address(this));
        abiContract = new Abachi(address(authority));
        uint256 supplyBefore = abiContract.totalSupply();
         // TODO look into https://dapphub.chat/channel/dev?msg=HWrPJqxp8BHMiKTbo
        // abiContract.setVault(address(this)); //TODO WTF msg.sender doesn't propigate from .dapprc $DAPP_TEST_CALLER config via mint() call, must use this value
        abiContract.mint(address(this), amount);
        assertEq(supplyBefore + amount, abiContract.totalSupply());
    }

    // Tester will pass it's own parameters, see https://fv.ethereum.org/2020/12/11/symbolic-execution-with-ds-test/
    function test_burn(uint256 mintAmount, uint256 burnAmount) public {
        authority = new AbachiAuthority(address(this), address(this), address(this), address(this));
        abiContract = new Abachi(address(authority));
        uint256 supplyBefore = abiContract.totalSupply();
        // abiContract.setVault(address(this));  //TODO WTF msg.sender doesn't propigate from .dapprc $DAPP_TEST_CALLER config via mint() call, must use this value
        abiContract.mint(address(this), mintAmount);
        if (burnAmount <= mintAmount){
            abiContract.burn(burnAmount);
            assertEq(supplyBefore + mintAmount - burnAmount, abiContract.totalSupply());
        } else {
            try abiContract.burn(burnAmount) {
                fail();
            } catch Error(string memory error) {
                // Assert revert error matches expected message
                assertEq("ERC20: burn amount exceeds balance", error);
            }
        }
    }
}
