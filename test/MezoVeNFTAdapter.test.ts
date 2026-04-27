import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { MezoVeNFTAdapter, MockVotingEscrow } from "../typechain-types";

describe("MezoVeNFTAdapter", function () {
  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock VotingEscrow contracts
    const MockVE = await ethers.getContractFactory("MockVotingEscrow");
    const mockVeBTC = await MockVE.deploy("veBTC", "veBTC");
    const mockVeMEZO = await MockVE.deploy("veMEZO", "veMEZO");

    await mockVeBTC.waitForDeployment();
    await mockVeMEZO.waitForDeployment();

    // Deploy adapter
    const Adapter = await ethers.getContractFactory("MezoVeNFTAdapter");
    const adapter = await Adapter.deploy(
      await mockVeBTC.getAddress(),
      await mockVeMEZO.getAddress()
    );
    await adapter.waitForDeployment();

    return { adapter, mockVeBTC, mockVeMEZO, owner, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set correct veBTC and veMEZO addresses", async function () {
      const { adapter, mockVeBTC, mockVeMEZO } = await loadFixture(deployFixture);

      expect(await adapter.veBTC()).to.equal(await mockVeBTC.getAddress());
      expect(await adapter.veMEZO()).to.equal(await mockVeMEZO.getAddress());
    });

    it("Should reject zero addresses", async function () {
      const Adapter = await ethers.getContractFactory("MezoVeNFTAdapter");

      await expect(
        Adapter.deploy(ethers.ZeroAddress, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid veBTC address");
    });
  });

  describe("getIntrinsicValue", function () {
    it("Should return correct locked amount and end time", async function () {
      const { adapter, mockVeBTC, user1 } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("1");
      const lockEnd = (await time.latest()) + 28 * 24 * 60 * 60; // 28 days

      const tokenId = await mockVeBTC.createLock.staticCall(user1.address, amount, lockEnd);
      await mockVeBTC.createLock(user1.address, amount, lockEnd);

      const [value, end] = await adapter.getIntrinsicValue(
        await mockVeBTC.getAddress(),
        tokenId
      );

      expect(value).to.equal(amount);
      expect(end).to.equal(lockEnd);
    });
  });

  describe("isExpired", function () {
    it("Should return true for expired locks", async function () {
      const { adapter, mockVeBTC, user1 } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("1");
      const lockEnd = (await time.latest()) + 100; // 100 seconds from now

      const tokenId = await mockVeBTC.createLock.staticCall(user1.address, amount, lockEnd);
      await mockVeBTC.createLock(user1.address, amount, lockEnd);

      // Move time forward
      await time.increase(200);

      expect(
        await adapter.isExpired(await mockVeBTC.getAddress(), tokenId)
      ).to.be.true;
    });

    it("Should return false for active locks", async function () {
      const { adapter, mockVeBTC, user1 } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("1");
      const lockEnd = (await time.latest()) + 28 * 24 * 60 * 60;

      const tokenId = await mockVeBTC.createLock.staticCall(user1.address, amount, lockEnd);
      await mockVeBTC.createLock(user1.address, amount, lockEnd);

      expect(
        await adapter.isExpired(await mockVeBTC.getAddress(), tokenId)
      ).to.be.false;
    });
  });

  describe("calculateDiscount", function () {
    it("Should calculate 10% discount correctly", async function () {
      const { adapter } = await loadFixture(deployFixture);

      const listPrice = ethers.parseEther("0.9");
      const intrinsicValue = ethers.parseEther("1.0");

      const discount = await adapter.calculateDiscount(listPrice, intrinsicValue);
      expect(discount).to.equal(1000n); // 10% = 1000 bps
    });

    it("Should return 0 for prices above intrinsic", async function () {
      const { adapter } = await loadFixture(deployFixture);

      const listPrice = ethers.parseEther("1.1");
      const intrinsicValue = ethers.parseEther("1.0");

      const discount = await adapter.calculateDiscount(listPrice, intrinsicValue);
      expect(discount).to.equal(0n);
    });

    it("Should return 0 for zero intrinsic value", async function () {
      const { adapter } = await loadFixture(deployFixture);

      const discount = await adapter.calculateDiscount(
        ethers.parseEther("1"),
        0n
      );
      expect(discount).to.equal(0n);
    });
  });

  describe("isSupported", function () {
    it("Should return true for veBTC", async function () {
      const { adapter, mockVeBTC } = await loadFixture(deployFixture);
      expect(await adapter.isSupported(await mockVeBTC.getAddress())).to.be.true;
    });

    it("Should return true for veMEZO", async function () {
      const { adapter, mockVeMEZO } = await loadFixture(deployFixture);
      expect(await adapter.isSupported(await mockVeMEZO.getAddress())).to.be.true;
    });

    it("Should return false for other addresses", async function () {
      const { adapter } = await loadFixture(deployFixture);
      expect(await adapter.isSupported(ethers.ZeroAddress)).to.be.false;
    });
  });

  describe("getTimeRemaining", function () {
    it("Should return correct time remaining", async function () {
      const { adapter, mockVeBTC, user1 } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("1");
      const duration = 28 * 24 * 60 * 60;
      const lockEnd = (await time.latest()) + duration;

      const tokenId = await mockVeBTC.createLock.staticCall(user1.address, amount, lockEnd);
      await mockVeBTC.createLock(user1.address, amount, lockEnd);

      const remaining = await adapter.getTimeRemaining(
        await mockVeBTC.getAddress(),
        tokenId
      );

      // Should be approximately duration (within 5 seconds for block time variance)
      expect(remaining).to.be.closeTo(BigInt(duration), 5n);
    });

    it("Should return 0 for expired locks", async function () {
      const { adapter, mockVeBTC, user1 } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("1");
      const lockEnd = (await time.latest()) + 100;

      const tokenId = await mockVeBTC.createLock.staticCall(user1.address, amount, lockEnd);
      await mockVeBTC.createLock(user1.address, amount, lockEnd);

      await time.increase(200);

      const remaining = await adapter.getTimeRemaining(
        await mockVeBTC.getAddress(),
        tokenId
      );
      expect(remaining).to.equal(0n);
    });
  });

  describe("Error handling", function () {
    it("Should revert for unsupported collection", async function () {
      const { adapter } = await loadFixture(deployFixture);
      const fakeAddress = "0x1234567890123456789012345678901234567890";

      await expect(
        adapter.getIntrinsicValue(fakeAddress, 1)
      ).to.be.revertedWithCustomError(adapter, "UnsupportedCollection");
    });
  });
});
