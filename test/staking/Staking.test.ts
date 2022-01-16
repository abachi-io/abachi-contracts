import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai, { expect } from "chai";
import { ethers } from "hardhat";
const { BigNumber } = ethers;
import { FakeContract, smock } from "@defi-wonderland/smock";
import {
    IDistributor,
    IgABI,
    IsABI,
    IABI,
    AbachiStaking,
    AbachiStaking__factory,
    AbachiAuthority,
    AbachiAuthority__factory,
} from "../../types";

chai.use(smock.matchers);

const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");

describe("AbachiStaking", async() => {
    let owner: SignerWithAddress;
    let governor: SignerWithAddress;
    let guardian: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let other: SignerWithAddress;
    let abiFake: FakeContract<IABI>;
    let sABIFake: FakeContract<IsABI>;
    let gABIFake: FakeContract<IgABI>;
    let distributorFake: FakeContract<IDistributor>;
    let staking: AbachiStaking;
    let authority: AbachiAuthority;

    const EPOCH_LENGTH = 2200;
    const EPOCH_NUMBER = 1;
    const FUTURE_END_TIME = 1022010000; // an arbitrary future block timestamp

    beforeEach(async () => {
        [owner, governor, guardian, alice, bob, other] = await ethers.getSigners();
        abiFake = await smock.fake<IABI>("IABI");
        gABIFake = await smock.fake<IgABI>("IgABI");
        // need to be specific because IsABI is also defined in OLD
        sABIFake = await smock.fake<IsABI>("contracts/interfaces/IsABI.sol:IsABI");
        distributorFake = await smock.fake<IDistributor>("IDistributor");
        authority = await new AbachiAuthority__factory(owner).deploy(
            governor.address,
            guardian.address,
            owner.address,
            owner.address
        );
    });

    describe("constructor", () => {
        it("can be constructed", async () => {
            staking = await new AbachiStaking__factory(owner).deploy(
                abiFake.address,
                sABIFake.address,
                gABIFake.address,
                EPOCH_LENGTH,
                EPOCH_NUMBER,
                FUTURE_END_TIME,
                authority.address
            );

            expect(await staking.ABI()).to.equal(abiFake.address);
            expect(await staking.sABI()).to.equal(sABIFake.address);
            const epoch = await staking.epoch();
            expect((epoch as any)._length).to.equal(BigNumber.from(EPOCH_LENGTH));
            expect(epoch.number).to.equal(BigNumber.from(EPOCH_NUMBER));
            expect(epoch.end).to.equal(BigNumber.from(FUTURE_END_TIME));

            expect(await authority.governor()).to.equal(governor.address);
        });

        it("will not allow a 0x0 ABI address", async () => {
            await expect(
                new AbachiStaking__factory(owner).deploy(
                    ZERO_ADDRESS,
                    sABIFake.address,
                    gABIFake.address,
                    EPOCH_LENGTH,
                    EPOCH_NUMBER,
                    FUTURE_END_TIME,
                    authority.address
                )
            ).to.be.reverted;
        });

        it("will not allow a 0x0 sABI address", async () => {
            await expect(
                new AbachiStaking__factory(owner).deploy(
                    abiFake.address,
                    ZERO_ADDRESS,
                    gABIFake.address,
                    EPOCH_LENGTH,
                    EPOCH_NUMBER,
                    FUTURE_END_TIME,
                    authority.address
                )
            ).to.be.reverted;
        });

        it("will not allow a 0x0 gABI address", async () => {
            await expect(
                new AbachiStaking__factory(owner).deploy(
                    abiFake.address,
                    sABIFake.address,
                    ZERO_ADDRESS,
                    EPOCH_LENGTH,
                    EPOCH_NUMBER,
                    FUTURE_END_TIME,
                    authority.address
                )
            ).to.be.reverted;
        });
    });

    describe("initialization", () => {
        beforeEach(async () => {
            staking = await new AbachiStaking__factory(owner).deploy(
                abiFake.address,
                sABIFake.address,
                gABIFake.address,
                EPOCH_LENGTH,
                EPOCH_NUMBER,
                FUTURE_END_TIME,
                authority.address
            );
        });

        describe("setDistributor", () => {
            it("can set the distributor", async () => {
                await staking.connect(governor).setDistributor(distributorFake.address);
                expect(await staking.distributor()).to.equal(distributorFake.address);
            });

            it("emits the DistributorSet event", async () => {
                await expect(staking.connect(governor).setDistributor(distributorFake.address))
                    .to.emit(staking, "DistributorSet")
                    .withArgs(distributorFake.address);
            });

            it("can only be done by the governor", async () => {
                await expect(staking.connect(other).setDistributor(distributorFake.address)).to.be
                    .reverted;
            });
        });

        describe("setWarmupLength", () => {
            it("sets the number of epochs of warmup are required", async () => {
                expect(await staking.warmupPeriod()).to.equal(0);
                await staking.connect(governor).setWarmupLength(2);
                expect(await staking.warmupPeriod()).to.equal(2);
            });

            it("emits a WarmupSet event", async () => {
                await expect(staking.connect(governor).setWarmupLength(2))
                    .to.emit(staking, "WarmupSet")
                    .withArgs(2);
            });

            it("can only be set by the governor", async () => {
                await expect(staking.connect(other).setWarmupLength(2)).to.be.reverted;
            });
        });
    });

    describe("post-initialization", () => {
        async function deployStaking(nextRebaseBlock: any) {
            staking = await new AbachiStaking__factory(owner).deploy(
                abiFake.address,
                sABIFake.address,
                gABIFake.address,
                EPOCH_LENGTH,
                EPOCH_NUMBER,
                nextRebaseBlock,
                authority.address
            );
            await staking.connect(governor).setDistributor(distributorFake.address);
        }

        beforeEach(async () => {
            const currentBlock = await ethers.provider.send("eth_blockNumber", []);
            const nextRebase = BigNumber.from(currentBlock).add(10000); // set the rebase far enough in the future to not hit it
            await deployStaking(nextRebase);
        });

        describe("stake", () => {
            it("adds amount to the warmup when claim is false, regardless of rebasing", async () => {
                // when _claim is false, the _rebasing flag is taken into account on the claim method
                const amount = 1000;
                const gons = 10;
                const rebasing = true;
                const claim = false;

                abiFake.transferFrom
                    .whenCalledWith(alice.address, staking.address, amount)
                    .returns(true);
                sABIFake.gonsForBalance.whenCalledWith(amount).returns(gons);
                sABIFake.balanceForGons.whenCalledWith(gons).returns(amount);

                await staking.connect(alice).stake(alice.address, amount, rebasing, claim);

                expect(await staking.supplyInWarmup()).to.equal(amount);
                expect(await staking.warmupPeriod()).to.equal(0);
                const warmupInfo = await staking.warmupInfo(alice.address);
                const epochInfo = await staking.epoch();
                expect(warmupInfo.deposit).to.equal(amount);
                expect(warmupInfo.gons).to.equal(gons);
                expect(warmupInfo.expiry).to.equal(epochInfo.number);
                expect(warmupInfo.lock).to.equal(false);
            });

            it("exchanges ABI for sABI when claim is true and rebasing is true", async () => {
                const amount = 1000;
                const rebasing = true;
                const claim = true;

                abiFake.transferFrom
                    .whenCalledWith(alice.address, staking.address, amount)
                    .returns(true);
                sABIFake.transfer.whenCalledWith(alice.address, amount).returns(true);

                await staking.connect(alice).stake(alice.address, amount, rebasing, claim);

                // nothing is in warmup
                sABIFake.balanceForGons.whenCalledWith(0).returns(0);
                expect(await staking.supplyInWarmup()).to.equal(0);
            });

            it("exchanges ABI for newly minted gABI when claim is true and rebasing is true", async () => {
                const amount = 1000;
                const indexedAmount = 10000;
                const rebasing = false;
                const claim = true;

                abiFake.transferFrom
                    .whenCalledWith(alice.address, staking.address, amount)
                    .returns(true);
                gABIFake.balanceTo.whenCalledWith(amount).returns(indexedAmount);

                await staking.connect(alice).stake(alice.address, amount, rebasing, claim);

                expect(gABIFake.mint).to.be.calledWith(alice.address, indexedAmount);
            });

            it("adds amount to warmup when claim is true and warmup period > 0, regardless of rebasing", async () => {
                // the rebasing flag is taken into account in the claim method
                const amount = 1000;
                const gons = 10;
                const rebasing = true;
                const claim = true;

                abiFake.transferFrom
                    .whenCalledWith(alice.address, staking.address, amount)
                    .returns(true);
                sABIFake.gonsForBalance.whenCalledWith(amount).returns(gons);
                sABIFake.balanceForGons.whenCalledWith(gons).returns(amount);

                await staking.connect(governor).setWarmupLength(1);
                await staking.connect(alice).stake(alice.address, amount, true, true);

                expect(await staking.supplyInWarmup()).to.equal(amount);
                const warmupInfo = await staking.warmupInfo(alice.address);
                const epochInfo = await staking.epoch();
                expect(warmupInfo.deposit).to.equal(amount);
                expect(warmupInfo.gons).to.equal(gons);
                expect(warmupInfo.expiry).to.equal(Number(epochInfo.number) + 1);
                expect(warmupInfo.lock).to.equal(false);
            });

            it("disables external deposits when locked", async () => {
                const amount = 1000;
                const gons = 10;
                const rebasing = false;
                const claim = false;

                abiFake.transferFrom
                    .whenCalledWith(alice.address, staking.address, amount)
                    .returns(true);
                sABIFake.gonsForBalance.whenCalledWith(amount).returns(gons);

                await staking.connect(alice).toggleLock();

                await expect(
                    staking.connect(alice).stake(bob.address, amount, rebasing, claim)
                ).to.be.revertedWith("External deposits for account are locked");
            });

            it("allows self deposits when locked", async () => {
                const amount = 1000;
                const gons = 10;
                const rebasing = false;
                const claim = false;

                abiFake.transferFrom
                    .whenCalledWith(alice.address, staking.address, amount)
                    .returns(true);
                sABIFake.gonsForBalance.whenCalledWith(amount).returns(gons);
                sABIFake.balanceForGons.whenCalledWith(gons).returns(amount);

                await staking.connect(alice).toggleLock();

                await staking.connect(alice).stake(alice.address, amount, rebasing, claim);

                expect(await staking.supplyInWarmup()).to.equal(amount);
            });
        });

        describe("claim", () => {
            async function createClaim(wallet: any, amount: number, gons: number) {
                const rebasing = true;
                const claim = false;
                abiFake.transferFrom
                    .whenCalledWith(alice.address, staking.address, amount)
                    .returns(true);
                sABIFake.gonsForBalance.whenCalledWith(amount).returns(gons);
                await staking.connect(wallet).stake(wallet.address, amount, rebasing, claim);
            }

            it("transfers sABI when rebasing is true", async () => {
                const amount = 1000;
                const gons = 10;
                await createClaim(alice, amount, gons);

                sABIFake.transfer.whenCalledWith(alice.address, amount).returns(true);
                sABIFake.balanceForGons.whenCalledWith(gons).returns(amount);

                await staking.connect(alice).claim(alice.address, true);

                sABIFake.balanceForGons.whenCalledWith(0).returns(0);
                expect(await staking.supplyInWarmup()).to.equal(0);
            });

            it("mints gABI when rebasing is false", async () => {
                const indexedAmount = 10000;
                const amount = 1000;
                const gons = 10;
                await createClaim(alice, amount, gons);

                gABIFake.balanceTo.whenCalledWith(amount).returns(indexedAmount);
                sABIFake.balanceForGons.whenCalledWith(gons).returns(amount);

                await staking.connect(alice).claim(alice.address, false);

                expect(gABIFake.mint).to.be.calledWith(alice.address, indexedAmount);

                sABIFake.balanceForGons.whenCalledWith(0).returns(0);
                expect(await staking.supplyInWarmup()).to.equal(0);
            });

            it("prevents external claims when locked", async () => {
                const amount = 1000;
                const gons = 10;
                await createClaim(alice, amount, gons);
                await staking.connect(alice).toggleLock();

                await expect(staking.connect(alice).claim(bob.address, false)).to.be.revertedWith(
                    "External claims for account are locked"
                );
            });

            it("allows internal claims when locked", async () => {
                const amount = 1000;
                const gons = 10;
                await createClaim(alice, amount, gons);
                await staking.connect(alice).toggleLock();

                sABIFake.transfer.whenCalledWith(alice.address, amount).returns(true);
                sABIFake.balanceForGons.whenCalledWith(gons).returns(amount);

                await staking.connect(alice).claim(alice.address, true);

                sABIFake.balanceForGons.whenCalledWith(0).returns(0);
                expect(await staking.supplyInWarmup()).to.equal(0);
            });

            it("does nothing when there is nothing to claim", async () => {
                await staking.connect(bob).claim(bob.address, true);

                expect(sABIFake.transfer).to.not.have.been.called;
                expect(gABIFake.mint).to.not.have.been.called;
            });

            it("does nothing when the warmup isn't over", async () => {
                await staking.connect(governor).setWarmupLength(2);
                await createClaim(alice, 1000, 10);

                await staking.connect(alice).claim(alice.address, true);

                expect(sABIFake.transfer).to.not.have.been.called;
                expect(gABIFake.mint).to.not.have.been.called;
            });
        });

        describe("forfeit", () => {
            let amount: number;
            let gons: number;

            beforeEach(async () => {
                // alice has a claim
                amount = 1000;
                gons = 10;
                const rebasing = true;
                const claim = false;
                abiFake.transferFrom
                    .whenCalledWith(alice.address, staking.address, amount)
                    .returns(true);
                sABIFake.gonsForBalance.whenCalledWith(amount).returns(gons);

                await staking.connect(alice).stake(alice.address, amount, rebasing, claim);
            });

            it("removes stake from warmup and returns ABI", async () => {
                abiFake.transfer.returns(true);

                await staking.connect(alice).forfeit();

                expect(abiFake.transfer).to.be.calledWith(alice.address, amount);

                sABIFake.balanceForGons.whenCalledWith(0).returns(0);
                expect(await staking.supplyInWarmup()).to.equal(0);
            });

            it("transfers zero if there is no balance in warmup", async () => {
                abiFake.transfer.returns(true);

                await staking.connect(bob).forfeit();

                expect(abiFake.transfer).to.be.calledWith(bob.address, 0);
            });
        });

        describe("unstake", () => {
            it("can redeem sABI for ABI", async () => {
                const amount = 1000;
                const rebasing = true;
                const claim = true;

                abiFake.transferFrom.returns(true);
                abiFake.balanceOf.returns(amount);
                sABIFake.transfer.returns(true);
                await staking.connect(alice).stake(alice.address, amount, rebasing, claim);

                sABIFake.transferFrom.returns(true);
                abiFake.transfer.returns(true);
                await staking.connect(alice).unstake(alice.address, amount, false, rebasing);

                expect(sABIFake.transferFrom).to.be.calledWith(
                    alice.address,
                    staking.address,
                    amount
                );
                expect(abiFake.transfer).to.be.calledWith(alice.address, amount);
            });

            it("can redeem gABI for ABI", async () => {
                const amount = 1000;
                const indexedAmount = 10000;
                const rebasing = false;
                const claim = true;

                abiFake.transferFrom.returns(true);
                await staking.connect(alice).stake(alice.address, amount, rebasing, claim);

                gABIFake.balanceFrom.whenCalledWith(indexedAmount).returns(amount);
                abiFake.transfer.returns(true);
                abiFake.balanceOf.returns(amount);
                await staking.connect(alice).unstake(alice.address, indexedAmount, false, rebasing);

                expect(abiFake.transfer).to.be.calledWith(alice.address, amount);
                expect(gABIFake.burn).to.be.calledWith(alice.address, indexedAmount);
            });
        });

        describe("wrap", () => {
            it("converts sABI into gABI", async () => {
                const amount = 1000;
                const indexedAmount = 10000;

                gABIFake.balanceTo.whenCalledWith(amount).returns(indexedAmount);
                sABIFake.transferFrom.returns(true);

                await staking.connect(alice).wrap(alice.address, amount);

                expect(gABIFake.mint).to.be.calledWith(alice.address, indexedAmount);
                expect(sABIFake.transferFrom).to.be.calledWith(
                    alice.address,
                    staking.address,
                    amount
                );
            });
        });

        describe("unwrap", () => {
            it("converts gABI into sABI", async () => {
                const amount = 1000;
                const indexedAmount = 10000;

                gABIFake.balanceFrom.whenCalledWith(indexedAmount).returns(amount);
                sABIFake.transfer.returns(true);

                await staking.connect(alice).unwrap(alice.address, indexedAmount);

                expect(gABIFake.burn).to.be.calledWith(alice.address, indexedAmount);
                expect(sABIFake.transfer).to.be.calledWith(alice.address, amount);
            });
        });

        describe("rebase", () => {
            it("does nothing if the block is before the epoch end block", async () => {
                const currentBlock = await ethers.provider.send("eth_blockNumber", []);
                const epoch = await staking.epoch();
                expect(BigNumber.from(currentBlock)).to.be.lt(BigNumber.from(epoch.end));

                await staking.connect(alice).rebase();
            });

            it("increments epoch number and calls rebase ", async () => {
                const currentBlock = await ethers.provider.send("eth_blockNumber", []);

                await deployStaking(currentBlock);

                const epoch = await staking.epoch();
                expect(BigNumber.from(currentBlock)).to.equal(BigNumber.from(epoch.end));

                await staking.connect(alice).rebase();

                const nextEpoch = await staking.epoch();
                expect(BigNumber.from(nextEpoch.number)).to.equal(
                    BigNumber.from(epoch.number).add(1)
                );
                expect(BigNumber.from(nextEpoch.end)).to.equal(
                    BigNumber.from(currentBlock).add(EPOCH_LENGTH)
                );
            });

            it("when the ABI balance of the staking contract equals sABI supply, distribute zero", async () => {
                const currentBlock = await ethers.provider.send("eth_blockNumber", []);
                await deployStaking(currentBlock);
                const epoch = await staking.epoch();
                expect(BigNumber.from(currentBlock)).to.equal(BigNumber.from(epoch.end));

                abiFake.balanceOf.whenCalledWith(staking.address).returns(10);
                sABIFake.circulatingSupply.returns(10);
                await staking.connect(alice).rebase();

                const nextEpoch = await staking.epoch();
                expect(BigNumber.from(nextEpoch.distribute)).to.equal(0);
            });

            it("will plan to distribute the difference between staked and total supply", async () => {
                const currentBlock = await ethers.provider.send("eth_blockNumber", []);
                await deployStaking(currentBlock);
                const epoch = await staking.epoch();
                expect(BigNumber.from(currentBlock)).to.equal(BigNumber.from(epoch.end));

                abiFake.balanceOf.whenCalledWith(staking.address).returns(10);
                sABIFake.circulatingSupply.returns(5);
                await staking.connect(alice).rebase();

                const nextEpoch = await staking.epoch();
                expect(BigNumber.from(nextEpoch.distribute)).to.equal(5);
            });

            it("will call the distributor, if set", async () => {
                const currentBlock = await ethers.provider.send("eth_blockNumber", []);
                await deployStaking(currentBlock);
                const epoch = await staking.epoch();
                expect(BigNumber.from(currentBlock)).to.equal(BigNumber.from(epoch.end));

                await staking.connect(alice).rebase();

                expect(distributorFake.distribute).to.have.been.called;
            });
        });
    });
});
