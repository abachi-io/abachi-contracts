
const chai = require("chai");
const { ethers } = require("hardhat");
const { expect } = chai;
chai.use(require("chai-as-promised"));


describe("Abachi token", () => {

  let Abachi, owner, address, newOwner;
  let ABIAuth;

  beforeEach(async () => {
    [owner, newOwner] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Abachi");

    const ABIAuthContract = await ethers.getContractFactory("AbachiAuthority");
    ABIAuth = await ABIAuthContract.deploy(owner.address, owner.address, owner.address, owner.address);

    Abachi = await Token.deploy(ABIAuth.address);
    [owner, newOwner] = await ethers.getSigners();
   
    
  });

  describe("mint", () => {
    it("vault owner should be able mint tokens", async () => {
      await expect(Abachi.mint(newOwner.address, 100)).to.be.fulfilled;
      expect(await Abachi.balanceOf(newOwner.address)).to.equal(BigInt(100));
    });
  
    it("not vault owner should not be able mint tokens", async () => {
      await expect(Abachi.connect(newOwner).mint(newOwner.address, 100)).to.be.rejectedWith("UNAUTHORIZED");
    });
    
    it("updating owner in policy should allow only the new owner to mint", async () => {
      await ABIAuth.pushVault(newOwner.address, true);    
      
      await Abachi.connect(newOwner).mint(newOwner.address, 100);
      expect(await Abachi.balanceOf(newOwner.address)).to.equal(BigInt(100));
  
      // old owner should not be able to mint
      await expect(Abachi.mint(newOwner.address, 100)).to.be.rejectedWith("UNAUTHORIZED");
    });

    it("should not mint beyond max supply", async () => {      
      await expect(Abachi.mint(newOwner.address, BigInt(1000000 * 10**9 + 1))).to.be.rejected;
      await expect(Abachi.mint(newOwner.address, BigInt(1000000 * 10**9))).not.to.be.rejected;
    });
  });

  describe("burn", () => {
    it("should burn tokens", async () => {
      await Abachi.mint(owner.address, BigInt(100));
  
      expect(await Abachi.balanceOf(owner.address)).to.equal(BigInt(100));
  
      await Abachi.burn(BigInt(50));
  
      expect(await Abachi.balanceOf(owner.address)).to.equal(BigInt(50));
    });
  
    it("should be able to burn allowed tokens", async () => {
      await Abachi.mint(newOwner.address, BigInt(100));
  
      expect(await Abachi.balanceOf(newOwner.address)).to.equal(BigInt(100));
      
      await Abachi.connect(newOwner).approve(owner.address, BigInt(50));
      await Abachi.burnFrom(newOwner.address, BigInt(50));
      expect(await Abachi.balanceOf(newOwner.address)).to.equal(BigInt(50));
    });
  
    it("should not be able to burn more than allowed tokens", async () => {
      await Abachi.mint(newOwner.address, BigInt(100));
  
      expect(await Abachi.balanceOf(newOwner.address)).to.equal(BigInt(100));
      
      await Abachi.connect(newOwner).approve(owner.address, BigInt(50));
      await expect(Abachi.burnFrom(newOwner.address, BigInt(51))).to.be.rejectedWith("ERC20: burn amount exceeds allowance");
      expect(await Abachi.balanceOf(newOwner.address)).to.equal(BigInt(100));
    });
  
    it("should not be able to burn if not approved", async () => {
      await Abachi.mint(newOwner.address, BigInt(100));   
      
      await expect(Abachi.burnFrom(newOwner.address, BigInt(50))).to.been.rejectedWith("ERC20: burn amount exceeds allowance");
      expect(await Abachi.allowance(newOwner.address, owner.address)).to.equal(0);
    });
  })
  
});

