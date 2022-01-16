// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import "ds-test/test.sol"; // ds-test

import "../../../contracts/libraries/SafeMath.sol";
import "../../../contracts/libraries/FixedPoint.sol";
import "../../../contracts/libraries/FullMath.sol";
import "../../../contracts/Staking.sol";
import "../../../contracts/Abachi.sol";
import "../../../contracts/sAbachi.sol";
import "../../../contracts/governance/gABI.sol";
import "../../../contracts/Treasury.sol";
import "../../../contracts/StakingDistributor.sol";
import "../../../contracts/AbachiAuthority.sol";

import "./util/Hevm.sol";
import "./util/MockContract.sol";

contract StakingTest is DSTest {
    using FixedPoint for *;
    using SafeMath for uint256;
    using SafeMath for uint112;

    AbachiStaking internal staking;
    AbachiTreasury internal treasury;
    AbachiAuthority internal authority;
    Distributor internal distributor;

    Abachi internal abi;
    sAbachi internal sabi;
    gABI internal gabi;

    MockContract internal mockToken;

    /// @dev Hevm setup
    Hevm internal constant hevm = Hevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    uint256 internal constant AMOUNT = 1000;
    uint256 internal constant EPOCH_LENGTH = 8; // In Seconds
    uint256 internal constant START_TIME = 0; // Starting at this epoch
    uint256 internal constant NEXT_REBASE_TIME = 1; // Next epoch is here
    uint256 internal constant BOUNTY = 42;

    function setUp() public {
        // Start at timestamp
        hevm.warp(START_TIME);

        // Setup mockToken to deposit into treasury (for excess reserves)
        mockToken = new MockContract();
        mockToken.givenMethodReturn(abi.encodeWithSelector(ERC20.name.selector), abi.encode("mock DAO"));
        mockToken.givenMethodReturn(abi.encodeWithSelector(ERC20.symbol.selector), abi.encode("MOCK"));
        mockToken.givenMethodReturnUint(abi.encodeWithSelector(ERC20.decimals.selector), 18);
        mockToken.givenMethodReturnBool(abi.encodeWithSelector(IERC20.transferFrom.selector), true);

        authority = new AbachiAuthority(address(this), address(this), address(this), address(this));

        abi = new Abachi(address(authority));
        gabi = new gABI(address(this), address(this));
        sabi = new sAbachi();
        sabi.setIndex(10);
        sabi.setgABI(address(gabi));

        treasury = new AbachiTreasury(address(abi), 1, address(authority));

        staking = new AbachiStaking(
            address(abi),
            address(sabi),
            address(gabi),
            EPOCH_LENGTH,
            START_TIME,
            NEXT_REBASE_TIME,
            address(authority)
        );

        distributor = new Distributor(address(treasury), address(abi), address(staking), address(authority));
        distributor.setBounty(BOUNTY);
        staking.setDistributor(address(distributor));
        treasury.enable(AbachiTreasury.STATUS.REWARDMANAGER, address(distributor), address(0)); // Allows distributor to mint abi.
        treasury.enable(AbachiTreasury.STATUS.RESERVETOKEN, address(mockToken), address(0)); // Allow mock token to be deposited into treasury
        treasury.enable(AbachiTreasury.STATUS.RESERVEDEPOSITOR, address(this), address(0)); // Allow this contract to deposit token into treeasury

        sabi.initialize(address(staking), address(treasury));
        gabi.migrate(address(staking), address(sabi));

        // Give the treasury permissions to mint
        authority.pushVault(address(treasury), true);

        // Deposit a token who's profit (3rd param) determines how much abi the treasury can mint
        uint256 depositAmount = 20e18;
        treasury.deposit(depositAmount, address(mockToken), BOUNTY.mul(2)); // Mints (depositAmount- 2xBounty) for this contract
    }

    function testStakeNoBalance() public {
        uint256 newAmount = AMOUNT.mul(2);
        try staking.stake(address(this), newAmount, true, true) {
            fail();
        } catch Error(string memory error) {
            assertEq(error, "TRANSFER_FROM_FAILED"); // Should be 'Transfer exceeds balance'
        }
    }

    function testStakeWithoutAllowance() public {
        try staking.stake(address(this), AMOUNT, true, true) {
            fail();
        } catch Error(string memory error) {
            assertEq(error, "TRANSFER_FROM_FAILED"); // Should be 'Transfer exceeds allowance'
        }
    }

    function testStake() public {
        abi.approve(address(staking), AMOUNT);
        uint256 amountStaked = staking.stake(address(this), AMOUNT, true, true);
        assertEq(amountStaked, AMOUNT);
    }

    function testStakeAtRebaseToGabi() public {
        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        abi.approve(address(staking), AMOUNT);
        bool isSabi = false;
        bool claim = true;
        uint256 gABIRecieved = staking.stake(address(this), AMOUNT, isSabi, claim);

        uint256 expectedAmount = gabi.balanceTo(AMOUNT.add(BOUNTY));
        assertEq(gABIRecieved, expectedAmount);
    }

    function testStakeAtRebase() public {
        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        abi.approve(address(staking), AMOUNT);
        bool isSabi = true;
        bool claim = true;
        uint256 amountStaked = staking.stake(address(this), AMOUNT, isSabi, claim);

        uint256 expectedAmount = AMOUNT.add(BOUNTY);
        assertEq(amountStaked, expectedAmount);
    }

    function testUnstake() public {
        bool triggerRebase = true;
        bool isSabi = true;
        bool claim = true;

        // Stake the abi
        uint256 initialAbiBalance = abi.balanceOf(address(this));
        abi.approve(address(staking), initialAbiBalance);
        uint256 amountStaked = staking.stake(address(this), initialAbiBalance, isSabi, claim);
        assertEq(amountStaked, initialAbiBalance);

        // Validate balances post stake
        uint256 abiBalance = abi.balanceOf(address(this));
        uint256 sAbiBalance = sabi.balanceOf(address(this));
        assertEq(abiBalance, 0);
        assertEq(sAbiBalance, initialAbiBalance);

        // Unstake sABI
        sabi.approve(address(staking), sAbiBalance);
        staking.unstake(address(this), sAbiBalance, triggerRebase, isSabi);

        // Validate Balances post unstake
        abiBalance = abi.balanceOf(address(this));
        sAbiBalance = sabi.balanceOf(address(this));
        assertEq(abiBalance, initialAbiBalance);
        assertEq(sAbiBalance, 0);
    }

    function testUnstakeAtRebase() public {
        bool triggerRebase = true;
        bool isSabi = true;
        bool claim = true;

        // Stake the abi
        uint256 initialAbiBalance = abi.balanceOf(address(this));
        abi.approve(address(staking), initialAbiBalance);
        uint256 amountStaked = staking.stake(address(this), initialAbiBalance, isSabi, claim);
        assertEq(amountStaked, initialAbiBalance);

        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        // Validate balances post stake
        // Post initial rebase, distribution amount is 0, so sABI balance doens't change.
        uint256 abiBalance = abi.balanceOf(address(this));
        uint256 sAbiBalance = sabi.balanceOf(address(this));
        assertEq(abiBalance, 0);
        assertEq(sAbiBalance, initialAbiBalance);

        // Unstake sABI
        sabi.approve(address(staking), sAbiBalance);
        staking.unstake(address(this), sAbiBalance, triggerRebase, isSabi);

        // Validate balances post unstake
        abiBalance = abi.balanceOf(address(this));
        sAbiBalance = sabi.balanceOf(address(this));
        uint256 expectedAmount = initialAbiBalance.add(BOUNTY); // Rebase earns a bounty
        assertEq(abiBalance, expectedAmount);
        assertEq(sAbiBalance, 0);
    }

    function testUnstakeAtRebaseFromGabi() public {
        bool triggerRebase = true;
        bool isSabi = false;
        bool claim = true;

        // Stake the abi
        uint256 initialAbiBalance = abi.balanceOf(address(this));
        abi.approve(address(staking), initialAbiBalance);
        uint256 amountStaked = staking.stake(address(this), initialAbiBalance, isSabi, claim);
        uint256 gabiAmount = gabi.balanceTo(initialAbiBalance);
        assertEq(amountStaked, gabiAmount);

        // test the unstake
        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        // Validate balances post-stake
        uint256 abiBalance = abi.balanceOf(address(this));
        uint256 gabiBalance = gabi.balanceOf(address(this));
        assertEq(abiBalance, 0);
        assertEq(gabiBalance, gabiAmount);

        // Unstake gABI
        gabi.approve(address(staking), gabiBalance);
        staking.unstake(address(this), gabiBalance, triggerRebase, isSabi);

        // Validate balances post unstake
        abiBalance = abi.balanceOf(address(this));
        gabiBalance = gabi.balanceOf(address(this));
        uint256 expectedAbi = initialAbiBalance.add(BOUNTY); // Rebase earns a bounty
        assertEq(abiBalance, expectedAbi);
        assertEq(gabiBalance, 0);
    }
}
