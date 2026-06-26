import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

// ── SwapRouter (oracle-quoted path) ──────────────────────────────────────────
// Verifies the three hardening fixes:
//   S-1  executeSwap re-derives the quote on-chain and rejects forged quotes
//   S-2  settlement is paid directly (NOT via the onlyMarketplace routePayment)
//   S-3  the no-DEX-adapter stub path reverts instead of phantom-settling
describe("SwapRouter (hardened)", function () {
  // ethers returns getQuote() as a read-only Result; rebuild a plain named
  // object so it can be passed back into executeSwap as a struct arg.
  const toQuote = (q: any) => ({
    paymentToken: q.paymentToken,
    settlementToken: q.settlementToken,
    paymentAmount: q.paymentAmount,
    settlementAmount: q.settlementAmount,
    swapFeeBps: q.swapFeeBps,
    swapFeeAmount: q.swapFeeAmount,
    expiry: q.expiry,
    valid: q.valid,
  });

  async function fx() {
    const [deployer, admin, treasury, caller, buyer, seller] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const payTok = await MockERC20.deploy("Pay", "PAY", 18);
    const settTok = await MockERC20.deploy("Sett", "SETT", 18);
    await payTok.waitForDeployment();
    await settTok.waitForDeployment();

    // Oracle + feeds (both $1, 18-dec)
    const Oracle = await ethers.getContractFactory("PriceOracleHub");
    const oracle = await Oracle.deploy(admin.address);
    await oracle.waitForDeployment();
    const MockPrice = await ethers.getContractFactory("MockPriceAdapter");
    const payFeed = await MockPrice.deploy(admin.address, ethers.parseEther("1"));
    const settFeed = await MockPrice.deploy(admin.address, ethers.parseEther("1"));
    await oracle.connect(admin).registerFeed(ethers.encodeBytes32String("PAY"), await payFeed.getAddress(), 0);
    await oracle.connect(admin).registerFeed(ethers.encodeBytes32String("SETT"), await settFeed.getAddress(), 0);

    // QuoteRouter (0.5% swap fee) with token→symbol mapping
    const Quote = await ethers.getContractFactory("QuoteRouter");
    const quote = await Quote.deploy(await oracle.getAddress(), admin.address, 50);
    await quote.waitForDeployment();
    await quote.connect(admin).registerToken(await payTok.getAddress(), ethers.encodeBytes32String("PAY"));
    await quote.connect(admin).registerToken(await settTok.getAddress(), ethers.encodeBytes32String("SETT"));

    // PaymentRouter only used for its fee config views (calculateFee + feeRecipient)
    const Router = await ethers.getContractFactory("PaymentRouter");
    const router = await Router.deploy(treasury.address, admin.address, await settTok.getAddress(), 200); // 2%
    await router.waitForDeployment();

    const Swap = await ethers.getContractFactory("SwapRouter");
    const swap = await Swap.deploy(await router.getAddress(), await quote.getAddress(), admin.address);
    await swap.waitForDeployment();
    await swap.connect(admin).setAuthorisedCaller(caller.address, true);

    // Mock DEX adapter, funded with settTok so it can pay out 1:1
    const MockDex = await ethers.getContractFactory("MockDexAdapter");
    const dex = await MockDex.deploy();
    await dex.waitForDeployment();
    await settTok.mint(await dex.getAddress(), ethers.parseEther("1000"));
    await swap.connect(admin).setDexAdapter(await dex.getAddress());

    // Buyer funded with payTok and approves the SwapRouter
    await payTok.mint(buyer.address, ethers.parseEther("1000"));

    return { swap, quote, router, payTok, settTok, admin, treasury, caller, buyer, seller };
  }

  it("settles a valid quote directly without routePayment authorization", async function () {
    const { swap, quote, payTok, settTok, treasury, caller, buyer, seller } = await loadFixture(fx);

    const settAmt = ethers.parseEther("100");
    const q = await quote.getQuote(await settTok.getAddress(), settAmt, await payTok.getAddress());
    // payAmount = 100 + 0.5% fee = 100.5
    expect(q.paymentAmount).to.equal(ethers.parseEther("100.5"));

    await payTok.connect(buyer).approve(await swap.getAddress(), q.paymentAmount);

    await expect(
      swap.connect(caller).executeSwap(1, buyer.address, seller.address, toQuote(q), q.paymentAmount)
    ).to.not.be.reverted;

    // 2% protocol fee on the 100 settToken received → seller 98, treasury 2
    expect(await settTok.balanceOf(seller.address)).to.equal(ethers.parseEther("98"));
    expect(await settTok.balanceOf(treasury.address)).to.equal(ethers.parseEther("2"));
    // swap fee (0.5 payTok) accumulated for sweep; nothing else stranded
    expect(await swap.accumulatedFees(await payTok.getAddress())).to.equal(ethers.parseEther("0.5"));
    expect(await settTok.balanceOf(await swap.getAddress())).to.equal(0n);
  });

  it("rejects a forged quote (S-1)", async function () {
    const { swap, quote, payTok, settTok, caller, buyer, seller } = await loadFixture(fx);
    const settAmt = ethers.parseEther("100");
    const q = await quote.getQuote(await settTok.getAddress(), settAmt, await payTok.getAddress());
    // Forge: claim a tiny payment for the same settlement
    const forged = { ...toQuote(q), paymentAmount: 1n };
    await payTok.connect(buyer).approve(await swap.getAddress(), q.paymentAmount);
    await expect(
      swap.connect(caller).executeSwap(1, buyer.address, seller.address, forged, ethers.parseEther("1000"))
    ).to.be.revertedWithCustomError(swap, "SwapFailed");
  });

  it("reverts when no DEX adapter is registered (S-3)", async function () {
    const { swap, quote, payTok, settTok, admin, caller, buyer, seller } = await loadFixture(fx);
    await swap.connect(admin).setDexAdapter(ethers.ZeroAddress);
    const settAmt = ethers.parseEther("100");
    const q = await quote.getQuote(await settTok.getAddress(), settAmt, await payTok.getAddress());
    await payTok.connect(buyer).approve(await swap.getAddress(), q.paymentAmount);
    await expect(
      swap.connect(caller).executeSwap(1, buyer.address, seller.address, toQuote(q), q.paymentAmount)
    ).to.be.revertedWithCustomError(swap, "SwapFailed");
  });
});

// ── SwapPaymentRouter (DEX swap-and-buy via existing marketplace) ─────────────
describe("SwapPaymentRouter (swap-and-buy)", function () {
  async function fx() {
    const [deployer, admin, treasury, swapFeeRecipient, seller, buyer] = await ethers.getSigners();

    const MockVE = await ethers.getContractFactory("MockVotingEscrow");
    const veBTC = await MockVE.deploy("veBTC", "veBTC");
    await veBTC.waitForDeployment();
    const veMEZO = await MockVE.deploy("veMEZO", "veMEZO");
    await veMEZO.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const musd = await MockERC20.deploy("Mock MUSD", "MUSD", 18);
    await musd.waitForDeployment();
    const payTok = await MockERC20.deploy("Pay", "PAY", 18);
    await payTok.waitForDeployment();

    const Adapter = await ethers.getContractFactory("MezoVeNFTAdapter");
    const adapter = await Adapter.deploy(await veBTC.getAddress(), await veMEZO.getAddress());
    await adapter.waitForDeployment();

    const Router = await ethers.getContractFactory("PaymentRouter");
    const router = await Router.deploy(treasury.address, admin.address, await musd.getAddress(), 200);
    await router.waitForDeployment();

    const Admin = await ethers.getContractFactory("MarketplaceAdmin");
    const adminContract = await Admin.deploy(admin.address, true);
    await adminContract.waitForDeployment();
    await adminContract.connect(admin).addCollection(await veBTC.getAddress());
    await adminContract.connect(admin).setPaymentRouter(await router.getAddress());

    const Marketplace = await ethers.getContractFactory("VeNFTMarketplace");
    const marketplace = await Marketplace.deploy(
      await adapter.getAddress(),
      await router.getAddress(),
      await adminContract.getAddress()
    );
    await marketplace.waitForDeployment();
    await router.connect(admin).setMarketplace(await marketplace.getAddress());

    // Seller lists a veBTC priced in MUSD
    const lockAmount = ethers.parseEther("1");
    const lockEnd = (await time.latest()) + 28 * 24 * 60 * 60;
    const tokenId = await veBTC.createLock.staticCall(seller.address, lockAmount, lockEnd);
    await veBTC.createLock(seller.address, lockAmount, lockEnd);
    const price = ethers.parseEther("50");
    await veBTC.connect(seller).approve(await marketplace.getAddress(), tokenId);
    await marketplace.connect(seller).listNFT(await veBTC.getAddress(), tokenId, price, await musd.getAddress());

    // SwapPaymentRouter wired to a mock Uniswap-V2 router (1% swap fee)
    const SPR = await ethers.getContractFactory("SwapPaymentRouter");
    const spr = await SPR.deploy(admin.address, swapFeeRecipient.address, await marketplace.getAddress(), 100);
    await spr.waitForDeployment();
    const MockUni = await ethers.getContractFactory("MockUniV2Router");
    const uni = await MockUni.deploy();
    await uni.waitForDeployment();
    await musd.mint(await uni.getAddress(), ethers.parseEther("1000")); // DEX liquidity
    await spr.connect(admin).setDexRouter(await uni.getAddress());

    await payTok.mint(buyer.address, ethers.parseEther("1000"));

    return { spr, marketplace, veBTC, musd, payTok, treasury, swapFeeRecipient, seller, buyer, tokenId, price };
  }

  it("swaps payTok→MUSD, buys the NFT, forwards it, and refunds surplus", async function () {
    const { spr, veBTC, musd, payTok, treasury, swapFeeRecipient, seller, buyer, tokenId, price } =
      await loadFixture(fx);

    const maxAmountIn = ethers.parseEther("60");
    await payTok.connect(buyer).approve(await spr.getAddress(), maxAmountIn);

    // fee = 1% of 60 = 0.6 payTok; netIn = 59.4 → 59.4 MUSD (1:1); amountOutMin >= price
    await expect(
      spr.connect(buyer).swapAndBuy(0, await payTok.getAddress(), maxAmountIn, price, 0)
    ).to.not.be.reverted;

    // NFT forwarded to the real buyer
    expect(await veBTC.ownerOf(tokenId)).to.equal(buyer.address);

    // Marketplace 2% fee on the 50 MUSD price → seller 49, treasury 1
    expect(await musd.balanceOf(seller.address)).to.equal(ethers.parseEther("49"));
    expect(await musd.balanceOf(treasury.address)).to.equal(ethers.parseEther("1"));

    // Swap fee (0.6 payTok) to the swap fee recipient
    expect(await payTok.balanceOf(swapFeeRecipient.address)).to.equal(ethers.parseEther("0.6"));

    // Surplus MUSD (59.4 - 50 = 9.4) refunded to buyer; nothing stranded in the router
    expect(await musd.balanceOf(buyer.address)).to.equal(ethers.parseEther("9.4"));
    expect(await musd.balanceOf(await spr.getAddress())).to.equal(0n);
    expect(await payTok.balanceOf(await spr.getAddress())).to.equal(0n);
  });

  it("rejects amountOutMin below the listing price (S-9 floor)", async function () {
    const { spr, payTok, buyer, price } = await loadFixture(fx);
    const maxAmountIn = ethers.parseEther("60");
    await payTok.connect(buyer).approve(await spr.getAddress(), maxAmountIn);
    await expect(
      spr.connect(buyer).swapAndBuy(0, await payTok.getAddress(), maxAmountIn, price - 1n, 0)
    ).to.be.revertedWithCustomError(spr, "InsufficientOutput");
  });
});
