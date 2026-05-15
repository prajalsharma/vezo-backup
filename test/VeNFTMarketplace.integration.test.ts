import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("VeNFTMarketplace Integration", function () {
  const BTC_ADDRESS = "0x7b7C000000000000000000000000000000000000";

  async function deployFullFixture() {
    const [deployer, admin, treasury, seller, buyer] = await ethers.getSigners();

    // Deploy mock VotingEscrow
    const MockVE = await ethers.getContractFactory("MockVotingEscrow");
    const veBTC = await MockVE.deploy("veBTC", "veBTC");
    const veMEZO = await MockVE.deploy("veMEZO", "veMEZO");
    await veBTC.waitForDeployment();
    await veMEZO.waitForDeployment();

    // Deploy mock MUSD
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const musd = await MockERC20.deploy("Mock MUSD", "MUSD", 18);
    await musd.waitForDeployment();

    // Deploy Adapter
    const Adapter = await ethers.getContractFactory("MezoVeNFTAdapter");
    const adapter = await Adapter.deploy(
      await veBTC.getAddress(),
      await veMEZO.getAddress()
    );
    await adapter.waitForDeployment();

    // Deploy PaymentRouter
    const Router = await ethers.getContractFactory("PaymentRouter");
    const router = await Router.deploy(
      treasury.address,
      admin.address,
      await musd.getAddress(),
      200 // 2% fee
    );
    await router.waitForDeployment();

    // Deploy MarketplaceAdmin
    const Admin = await ethers.getContractFactory("MarketplaceAdmin");
    const adminContract = await Admin.deploy(admin.address, true); // testnet mode
    await adminContract.waitForDeployment();

    // Override supported collections to use our mocks
    await adminContract.connect(admin).addCollection(await veBTC.getAddress());
    await adminContract.connect(admin).addCollection(await veMEZO.getAddress());

    // Set payment router
    await adminContract.connect(admin).setPaymentRouter(await router.getAddress());

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("VeNFTMarketplace");
    const marketplace = await Marketplace.deploy(
      await adapter.getAddress(),
      await router.getAddress(),
      await adminContract.getAddress()
    );
    await marketplace.waitForDeployment();

    // Authorize marketplace as the sole caller of routePayment
    await router.connect(admin).setMarketplace(await marketplace.getAddress());

    // Create veBTC position for seller
    const lockAmount = ethers.parseEther("1");
    const lockEnd = (await time.latest()) + 28 * 24 * 60 * 60;
    const tokenId = await veBTC.createLock.staticCall(seller.address, lockAmount, lockEnd);
    await veBTC.createLock(seller.address, lockAmount, lockEnd);

    // Mint MUSD to buyer
    await musd.mint(buyer.address, ethers.parseEther("1000"));

    return {
      veBTC,
      veMEZO,
      musd,
      adapter,
      router,
      adminContract,
      marketplace,
      deployer,
      admin,
      treasury,
      seller,
      buyer,
      tokenId,
      lockAmount,
      lockEnd,
    };
  }

  describe("Full Listing Flow", function () {
    it("Should complete list -> buy -> settle flow with BTC", async function () {
      const {
        veBTC,
        router,
        marketplace,
        treasury,
        seller,
        buyer,
        tokenId,
        lockAmount,
      } = await loadFixture(deployFullFixture);

      // 1. Seller approves marketplace
      await veBTC.connect(seller).approve(await marketplace.getAddress(), tokenId);

      // 2. Seller lists at 10% discount
      const listPrice = (lockAmount * 90n) / 100n; // 0.9 BTC

      const listTx = await marketplace.connect(seller).listNFT(
        await veBTC.getAddress(),
        tokenId,
        listPrice,
        BTC_ADDRESS
      );

      await expect(listTx)
        .to.emit(marketplace, "Listed")
        .withArgs(
          0n, // listingId
          seller.address,
          await veBTC.getAddress(),
          tokenId,
          listPrice,
          BTC_ADDRESS
        );

      // 3. Verify listing
      const listing = await marketplace.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(listPrice);
      expect(listing.active).to.be.true;

      // 4. Get listing with value
      const [listingData, intrinsicValue, , , discountBps] =
        await marketplace.getListingWithValue(0);
      expect(intrinsicValue).to.equal(lockAmount);
      expect(discountBps).to.equal(1000n); // 10%

      // 5. Buyer purchases
      const sellerBefore = await ethers.provider.getBalance(seller.address);
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      const buyTx = await marketplace.connect(buyer).buyNFT(0, { value: listPrice });

      await expect(buyTx)
        .to.emit(marketplace, "Purchased")
        .withArgs(0n, buyer.address, seller.address, listPrice);

      // 6. Verify NFT transferred
      expect(await veBTC.ownerOf(tokenId)).to.equal(buyer.address);

      // 7. Verify payments
      const sellerAfter = await ethers.provider.getBalance(seller.address);
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);

      const expectedFee = (listPrice * 2n) / 100n; // 2%
      const expectedSeller = listPrice - expectedFee;

      expect(sellerAfter - sellerBefore).to.equal(expectedSeller);
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);

      // 8. Verify listing is inactive
      const listingAfter = await marketplace.listings(0);
      expect(listingAfter.active).to.be.false;
    });

    it("Should complete list -> buy flow with MUSD", async function () {
      const {
        veBTC,
        musd,
        router,
        marketplace,
        treasury,
        seller,
        buyer,
        tokenId,
        lockAmount,
      } = await loadFixture(deployFullFixture);

      const musdAddress = await musd.getAddress();

      // 1. Seller approves and lists
      await veBTC.connect(seller).approve(await marketplace.getAddress(), tokenId);

      const listPrice = ethers.parseEther("100"); // 100 MUSD

      await marketplace.connect(seller).listNFT(
        await veBTC.getAddress(),
        tokenId,
        listPrice,
        musdAddress
      );

      // 2. Buyer approves MUSD to router (for direct transfers)
      await musd.connect(buyer).approve(await router.getAddress(), listPrice);

      // 3. Buyer purchases
      const sellerBefore = await musd.balanceOf(seller.address);
      const treasuryBefore = await musd.balanceOf(treasury.address);

      await marketplace.connect(buyer).buyNFT(0);

      // 4. Verify NFT transferred
      expect(await veBTC.ownerOf(tokenId)).to.equal(buyer.address);

      // 5. Verify MUSD payments
      const sellerAfter = await musd.balanceOf(seller.address);
      const treasuryAfter = await musd.balanceOf(treasury.address);

      const expectedFee = (listPrice * 2n) / 100n;
      const expectedSeller = listPrice - expectedFee;

      expect(sellerAfter - sellerBefore).to.equal(expectedSeller);
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);
    });
  });

  describe("Cancel Listing", function () {
    it("Should allow seller to cancel listing", async function () {
      const { veBTC, marketplace, seller, tokenId } = await loadFixture(
        deployFullFixture
      );

      await veBTC.connect(seller).approve(await marketplace.getAddress(), tokenId);

      await marketplace.connect(seller).listNFT(
        await veBTC.getAddress(),
        tokenId,
        ethers.parseEther("1"),
        BTC_ADDRESS
      );

      await expect(marketplace.connect(seller).cancelListing(0))
        .to.emit(marketplace, "Cancelled")
        .withArgs(0n);

      const listing = await marketplace.listings(0);
      expect(listing.active).to.be.false;
    });

    it("Should prevent non-seller from cancelling", async function () {
      const { veBTC, marketplace, seller, buyer, tokenId } = await loadFixture(
        deployFullFixture
      );

      await veBTC.connect(seller).approve(await marketplace.getAddress(), tokenId);

      await marketplace.connect(seller).listNFT(
        await veBTC.getAddress(),
        tokenId,
        ethers.parseEther("1"),
        BTC_ADDRESS
      );

      await expect(
        marketplace.connect(buyer).cancelListing(0)
      ).to.be.revertedWithCustomError(marketplace, "NotOwner");
    });
  });

  describe("Update Price", function () {
    it("Should allow seller to update price", async function () {
      const { veBTC, marketplace, seller, tokenId } = await loadFixture(
        deployFullFixture
      );

      await veBTC.connect(seller).approve(await marketplace.getAddress(), tokenId);

      await marketplace.connect(seller).listNFT(
        await veBTC.getAddress(),
        tokenId,
        ethers.parseEther("1"),
        BTC_ADDRESS
      );

      const newPrice = ethers.parseEther("0.8");

      await expect(marketplace.connect(seller).updatePrice(0, newPrice))
        .to.emit(marketplace, "PriceUpdated")
        .withArgs(0n, ethers.parseEther("1"), newPrice);

      const listing = await marketplace.listings(0);
      expect(listing.price).to.equal(newPrice);
    });
  });

  describe("Pause Functionality", function () {
    it("Should prevent listing when paused", async function () {
      const { veBTC, adminContract, marketplace, admin, seller, tokenId } =
        await loadFixture(deployFullFixture);

      await veBTC.connect(seller).approve(await marketplace.getAddress(), tokenId);

      // Pause marketplace
      await adminContract.connect(admin).emergencyPause("Testing");

      await expect(
        marketplace.connect(seller).listNFT(
          await veBTC.getAddress(),
          tokenId,
          ethers.parseEther("1"),
          BTC_ADDRESS
        )
      ).to.be.revertedWithCustomError(marketplace, "Paused");
    });

    it("Should allow operations after unpause", async function () {
      const { veBTC, adminContract, marketplace, admin, seller, tokenId } =
        await loadFixture(deployFullFixture);

      await veBTC.connect(seller).approve(await marketplace.getAddress(), tokenId);

      await adminContract.connect(admin).emergencyPause("Testing");
      await adminContract.connect(admin).unpause();

      // Should work now
      await marketplace.connect(seller).listNFT(
        await veBTC.getAddress(),
        tokenId,
        ethers.parseEther("1"),
        BTC_ADDRESS
      );

      const listing = await marketplace.listings(0);
      expect(listing.active).to.be.true;
    });
  });

  describe("Floor Price Tracking", function () {
    it("Should track floor price correctly", async function () {
      const { veBTC, marketplace, seller, tokenId } = await loadFixture(
        deployFullFixture
      );

      await veBTC.connect(seller).approve(await marketplace.getAddress(), tokenId);

      const price = ethers.parseEther("0.5");
      await marketplace.connect(seller).listNFT(
        await veBTC.getAddress(),
        tokenId,
        price,
        BTC_ADDRESS
      );

      const floor = await marketplace.getFloorPrice(
        await veBTC.getAddress(),
        BTC_ADDRESS
      );
      expect(floor).to.equal(price);
    });
  });
});
