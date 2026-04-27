import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { PaymentRouter, MockERC20 } from "../typechain-types";

describe("PaymentRouter", function () {
  const BTC_ADDRESS = "0x7b7C000000000000000000000000000000000000";
  const INITIAL_FEE_BPS = 200; // 2%

  async function deployFixture() {
    const [owner, admin, treasury, seller, buyer] = await ethers.getSigners();

    // Deploy mock MUSD
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const musd = await MockERC20.deploy("Mock MUSD", "MUSD", 18);
    await musd.waitForDeployment();

    // Deploy PaymentRouter
    const Router = await ethers.getContractFactory("PaymentRouter");
    const router = await Router.deploy(
      treasury.address,
      admin.address,
      await musd.getAddress(),
      INITIAL_FEE_BPS
    );
    await router.waitForDeployment();

    // Authorize buyer as the marketplace caller so routePayment tests work.
    // In production this is the VeNFTMarketplace contract address.
    await router.connect(admin).setMarketplace(buyer.address);

    // Mint MUSD to buyer
    await musd.mint(buyer.address, ethers.parseEther("1000"));

    return { router, musd, owner, admin, treasury, seller, buyer };
  }

  describe("Deployment", function () {
    it("Should set correct initial values", async function () {
      const { router, musd, admin, treasury } = await loadFixture(deployFixture);

      expect(await router.admin()).to.equal(admin.address);
      expect(await router.feeRecipient()).to.equal(treasury.address);
      expect(await router.protocolFeeBps()).to.equal(INITIAL_FEE_BPS);
      expect(await router.MUSD()).to.equal(await musd.getAddress());
    });

    it("Should have BTC, MEZO, MUSD as supported tokens", async function () {
      const { router, musd } = await loadFixture(deployFixture);

      expect(await router.supportedTokens(BTC_ADDRESS)).to.be.true;
      expect(await router.supportedTokens("0x7B7c000000000000000000000000000000000001")).to.be.true;
      expect(await router.supportedTokens(await musd.getAddress())).to.be.true;
    });
  });

  describe("calculateFee", function () {
    it("Should calculate 2% fee correctly", async function () {
      const { router } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("1");
      const [fee, sellerAmount] = await router.calculateFee(amount);

      expect(fee).to.equal(ethers.parseEther("0.02"));
      expect(sellerAmount).to.equal(ethers.parseEther("0.98"));
      expect(fee + sellerAmount).to.equal(amount);
    });

    it("Should work with different fee levels", async function () {
      const { router, admin } = await loadFixture(deployFixture);

      // Set 5% fee
      await router.connect(admin).setProtocolFee(500);

      const amount = ethers.parseEther("10");
      const [fee, sellerAmount] = await router.calculateFee(amount);

      expect(fee).to.equal(ethers.parseEther("0.5"));
      expect(sellerAmount).to.equal(ethers.parseEther("9.5"));
    });
  });

  describe("routePayment - ERC20", function () {
    it("Should correctly route MUSD payment with fee", async function () {
      const { router, musd, treasury, seller, buyer } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("100");
      const expectedFee = ethers.parseEther("2"); // 2%
      const expectedSeller = ethers.parseEther("98");

      // Approve router
      await musd.connect(buyer).approve(await router.getAddress(), amount);

      const sellerBefore = await musd.balanceOf(seller.address);
      const treasuryBefore = await musd.balanceOf(treasury.address);

      await router.connect(buyer).routePayment(
        buyer.address,
        seller.address,
        await musd.getAddress(),
        amount
      );

      const sellerAfter = await musd.balanceOf(seller.address);
      const treasuryAfter = await musd.balanceOf(treasury.address);

      expect(sellerAfter - sellerBefore).to.equal(expectedSeller);
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);
    });

    it("Should emit PaymentRouted event", async function () {
      const { router, musd, seller, buyer } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("100");
      await musd.connect(buyer).approve(await router.getAddress(), amount);

      await expect(
        router.connect(buyer).routePayment(
          buyer.address,
          seller.address,
          await musd.getAddress(),
          amount
        )
      )
        .to.emit(router, "PaymentRouted")
        .withArgs(
          buyer.address,
          seller.address,
          await musd.getAddress(),
          amount,
          ethers.parseEther("2")
        );
    });
  });

  describe("routePayment - Native BTC", function () {
    it("Should correctly route BTC payment with fee", async function () {
      const { router, treasury, seller, buyer } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("1");
      const expectedFee = ethers.parseEther("0.02");
      const expectedSeller = ethers.parseEther("0.98");

      const sellerBefore = await ethers.provider.getBalance(seller.address);
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await router.connect(buyer).routePayment(
        buyer.address,
        seller.address,
        BTC_ADDRESS,
        amount,
        { value: amount }
      );

      const sellerAfter = await ethers.provider.getBalance(seller.address);
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);

      expect(sellerAfter - sellerBefore).to.equal(expectedSeller);
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);
    });

    it("Should revert on insufficient BTC", async function () {
      const { router, seller, buyer } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("1");

      await expect(
        router.connect(buyer).routePayment(
          buyer.address,
          seller.address,
          BTC_ADDRESS,
          amount,
          { value: ethers.parseEther("0.5") }
        )
      ).to.be.revertedWithCustomError(router, "InsufficientPayment");
    });
  });

  describe("Admin functions", function () {
    it("Should allow admin to update fee", async function () {
      const { router, admin } = await loadFixture(deployFixture);

      await expect(router.connect(admin).setProtocolFee(200))
        .to.emit(router, "ProtocolFeeUpdated")
        .withArgs(200, 200);

      expect(await router.protocolFeeBps()).to.equal(200);
    });

    it("Should reject fee above 5%", async function () {
      const { router, admin } = await loadFixture(deployFixture);

      await expect(
        router.connect(admin).setProtocolFee(501)
      ).to.be.revertedWithCustomError(router, "FeeTooHigh");
    });

    it("Should reject non-admin fee update", async function () {
      const { router, buyer } = await loadFixture(deployFixture);

      await expect(
        router.connect(buyer).setProtocolFee(200)
      ).to.be.revertedWithCustomError(router, "Unauthorized");
    });

    it("Should allow admin to update fee recipient", async function () {
      const { router, admin, buyer } = await loadFixture(deployFixture);

      await router.connect(admin).setFeeRecipient(buyer.address);
      expect(await router.feeRecipient()).to.equal(buyer.address);
    });

    it("Should allow admin to add/remove token support", async function () {
      const { router, admin } = await loadFixture(deployFixture);

      const newToken = "0x1234567890123456789012345678901234567890";

      await router.connect(admin).setTokenSupport(newToken, true);
      expect(await router.supportedTokens(newToken)).to.be.true;

      await router.connect(admin).setTokenSupport(newToken, false);
      expect(await router.supportedTokens(newToken)).to.be.false;
    });
  });

  describe("Error cases", function () {
    it("Should reject unsupported token", async function () {
      const { router, seller, buyer } = await loadFixture(deployFixture);

      const unsupportedToken = "0x1234567890123456789012345678901234567890";

      await expect(
        router.connect(buyer).routePayment(buyer.address, seller.address, unsupportedToken, 1000)
      ).to.be.revertedWithCustomError(router, "UnsupportedToken");
    });

    it("Should reject zero amount", async function () {
      const { router, musd, seller, buyer } = await loadFixture(deployFixture);

      await expect(
        router.connect(buyer).routePayment(
          buyer.address,
          seller.address,
          await musd.getAddress(),
          0
        )
      ).to.be.revertedWithCustomError(router, "InvalidAmount");
    });

    it("Should reject zero address seller", async function () {
      const { router, musd, buyer } = await loadFixture(deployFixture);

      await expect(
        router.connect(buyer).routePayment(
          buyer.address,
          ethers.ZeroAddress,
          await musd.getAddress(),
          1000
        )
      ).to.be.revertedWithCustomError(router, "InvalidAddress");
    });

    it("Should reject caller that is not the authorized marketplace", async function () {
      const { router, musd, seller, owner } = await loadFixture(deployFixture);

      // owner is not set as marketplace, so this should revert
      await expect(
        router.connect(owner).routePayment(
          owner.address,
          seller.address,
          await musd.getAddress(),
          ethers.parseEther("1")
        )
      ).to.be.revertedWithCustomError(router, "Unauthorized");
    });
  });
});
