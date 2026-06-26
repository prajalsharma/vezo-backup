import { ethers } from "hardhat";

/**
 * deploy-v2-modules.ts
 *
 * Deploys ONLY the 5 new v2 modules on top of already-deployed core contracts.
 * Run this when the 4 core contracts (Adapter, PaymentRouter, Admin, Marketplace)
 * are already live and you only need:
 *
 *   1. VeNFTBidding
 *   2. ListingSnapshotStore
 *   3. PriceOracleHub
 *   4. QuoteRouter
 *   5. SwapRouter
 *
 * Required env vars (in root .env):
 *   DEPLOYER_PRIVATE_KEY         — deployer wallet
 *   ADMIN_ADDRESS                — admin / multisig address
 *   FEE_RECIPIENT                — address that receives swap fees
 *
 *   EXISTING_MARKETPLACE         — already-deployed VeNFTMarketplace address
 *   EXISTING_ADAPTER             — already-deployed MezoVeNFTAdapter address
 *   EXISTING_ROUTER              — already-deployed PaymentRouter address
 *   EXISTING_ADMIN_CONTRACT      — already-deployed MarketplaceAdmin address
 *
 * Optional:
 *   SWAP_FEE_BPS                 — swap fee in bps (default 50 = 0.5%)
 *   BTC_ORACLE_ADAPTER           — Chainlink/Pyth adapter for BTC price
 *   MEZO_ORACLE_ADAPTER          — adapter for MEZO price
 *   MUSD_ORACLE_ADAPTER          — adapter for MUSD price
 *   ORACLE_STALENESS_SECS        — max oracle age in seconds (default 300)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-v2-modules.ts --network mezomainnet
 *   npx hardhat run scripts/deploy-v2-modules.ts --network mezotestnet
 */

const MUSD: Record<string, string> = {
  mezomainnet: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
  mezotestnet: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
};

const BTC_TOKEN  = "0x7b7C000000000000000000000000000000000000";
const MEZO_TOKEN = "0x7B7c000000000000000000000000000000000001";

async function waitForTx(txPromise: Promise<any>) {
  const tx = await txPromise;
  await tx.wait();
  return tx;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();
  const networkName = network.chainId === 31612n ? "mezomainnet" : "mezotestnet";

  console.log("\n=== V2 MODULES DEPLOYMENT ===");
  console.log("Network:  ", networkName, `(Chain ID: ${network.chainId})`);
  console.log("Deployer: ", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:  ", ethers.formatEther(balance), "BTC");

  // ── Load existing contract addresses ───────────────────────────────────────

  const marketplaceAddress    = process.env.EXISTING_MARKETPLACE;
  const adapterAddress        = process.env.EXISTING_ADAPTER;
  const routerAddress         = process.env.EXISTING_ROUTER;
  const adminContractAddress  = process.env.EXISTING_ADMIN_CONTRACT;
  const adminAddress          = process.env.ADMIN_ADDRESS;
  const feeRecipient          = process.env.FEE_RECIPIENT;

  if (!marketplaceAddress || !adapterAddress || !routerAddress || !adminContractAddress) {
    throw new Error(
      "Missing existing contract addresses.\n" +
      "Set EXISTING_MARKETPLACE, EXISTING_ADAPTER, EXISTING_ROUTER, EXISTING_ADMIN_CONTRACT in .env"
    );
  }
  if (!adminAddress || !feeRecipient) {
    throw new Error("Set ADMIN_ADDRESS and FEE_RECIPIENT in .env");
  }

  const swapFeeBps        = parseInt(process.env.SWAP_FEE_BPS       || "50");
  const stalenessSecs     = parseInt(process.env.ORACLE_STALENESS_SECS || "300");
  const btcOracleAdapter  = process.env.BTC_ORACLE_ADAPTER  || "";
  const mezoOracleAdapter = process.env.MEZO_ORACLE_ADAPTER || "";
  const musdOracleAdapter = process.env.MUSD_ORACLE_ADAPTER || "";
  const musdAddress       = MUSD[networkName];

  console.log("\n── Reusing existing contracts ──────────────────────────");
  console.log("VeNFTMarketplace:    ", marketplaceAddress);
  console.log("MezoVeNFTAdapter:    ", adapterAddress);
  console.log("PaymentRouter:       ", routerAddress);
  console.log("MarketplaceAdmin:    ", adminContractAddress);
  console.log("\n── Deploying 5 new modules ─────────────────────────────");
  console.log("Swap fee:            ", swapFeeBps, "bps");
  console.log("Oracle staleness:    ", stalenessSecs, "s");

  if (networkName === "mezomainnet") {
    console.log("\n⚠️  MAINNET — deploying in 5 seconds. Ctrl+C to abort.");
    await new Promise((r) => setTimeout(r, 5000));
  }

  // ── 1. VeNFTBidding ────────────────────────────────────────────────────────
  // If already deployed, pass EXISTING_BIDDING in .env to skip redeployment
  let biddingAddress = process.env.EXISTING_BIDDING || "";
  if (biddingAddress) {
    console.log("\n1. Reusing existing VeNFTBidding:", biddingAddress);
  } else {
    console.log("\n1. Deploying VeNFTBidding...");
    const Bidding = await ethers.getContractFactory("VeNFTBidding");
    const bidding = await Bidding.deploy(routerAddress, adminContractAddress);
    await bidding.waitForDeployment();
    biddingAddress = await bidding.getAddress();
    console.log("   ✅ VeNFTBidding:", biddingAddress);
  }

  // ── 2. ListingSnapshotStore ────────────────────────────────────────────────
  // If already deployed, pass EXISTING_SNAPSHOT_STORE in .env to skip redeployment
  let snapshotAddress = process.env.EXISTING_SNAPSHOT_STORE || "";
  if (snapshotAddress) {
    console.log("\n2. Reusing existing ListingSnapshotStore:", snapshotAddress);
  } else {
    console.log("\n2. Deploying ListingSnapshotStore...");
    const SnapshotStore = await ethers.getContractFactory("ListingSnapshotStore");
    const snapshotStore = await SnapshotStore.deploy(adapterAddress, marketplaceAddress);
    await snapshotStore.waitForDeployment();
    snapshotAddress = await snapshotStore.getAddress();
    console.log("   ✅ ListingSnapshotStore:", snapshotAddress);
  }

  // Wire SnapshotStore into Marketplace (requires DEFAULT_ADMIN_ROLE — skip if not admin)
  try {
    const marketplace = await ethers.getContractAt("VeNFTMarketplace", marketplaceAddress);
    await waitForTx(marketplace.setSnapshotStore(snapshotAddress));
    console.log("   ✅ SnapshotStore registered in VeNFTMarketplace");
  } catch {
    console.log("   ⚠️  Could not register SnapshotStore (deployer lacks admin role).");
    console.log("      Ask the marketplace admin to call setSnapshotStore(" + snapshotAddress + ")");
  }

  // ── 3. PriceOracleHub ─────────────────────────────────────────────────────
  let oracleAddress = process.env.EXISTING_ORACLE_HUB || "";
  if (oracleAddress) {
    console.log("\n3. Reusing existing PriceOracleHub:", oracleAddress);
  } else {
    console.log("\n3. Deploying PriceOracleHub...");
    const OracleHub = await ethers.getContractFactory("PriceOracleHub");
    const oracleHub = await OracleHub.deploy(adminAddress);
    await oracleHub.waitForDeployment();
    oracleAddress = await oracleHub.getAddress();
    console.log("   ✅ PriceOracleHub:", oracleAddress);
  }
  const oracleHub = await ethers.getContractAt("PriceOracleHub", oracleAddress);

  // Register oracle feeds if adapters were provided
  if (btcOracleAdapter || mezoOracleAdapter || musdOracleAdapter) {
    console.log("   Registering oracle feeds...");
    if (btcOracleAdapter)  await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("BTC"),  btcOracleAdapter,  stalenessSecs));
    if (mezoOracleAdapter) await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("MEZO"), mezoOracleAdapter, stalenessSecs));
    if (musdOracleAdapter) await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("MUSD"), musdOracleAdapter, stalenessSecs));
    console.log("   ✅ Oracle feeds registered");
  } else {
    console.log("   ⚠️  No oracle adapters provided — register feeds manually after deploy");
    console.log("      using: oracleHub.registerFeed(symbol, adapterAddress, stalenessSecs)");

    // On testnet only: deploy mock price adapters so the app works immediately
    if (networkName === "mezotestnet") {
      console.log("   Deploying MockPriceAdapters for testnet...");
      const MockAdapter = await ethers.getContractFactory("MockPriceAdapter");
      const btcMock  = await MockAdapter.deploy(adminAddress, ethers.parseEther("97000"));
      await btcMock.waitForDeployment();
      const mezoMock = await MockAdapter.deploy(adminAddress, ethers.parseEther("0.15"));
      await mezoMock.waitForDeployment();
      const musdMock = await MockAdapter.deploy(adminAddress, ethers.parseEther("1.0"));
      await musdMock.waitForDeployment();
      await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("BTC"),  await btcMock.getAddress(),  stalenessSecs));
      await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("MEZO"), await mezoMock.getAddress(), stalenessSecs));
      await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("MUSD"), await musdMock.getAddress(), stalenessSecs));
      console.log("   ✅ Mock feeds registered (testnet)");
    }
  }

  // ── 4. QuoteRouter ─────────────────────────────────────────────────────────
  let quoteAddress = process.env.EXISTING_QUOTE_ROUTER || "";
  if (quoteAddress) {
    console.log("\n4. Reusing existing QuoteRouter:", quoteAddress);
  } else {
    console.log("\n4. Deploying QuoteRouter...");
    const QuoteRouterFactory = await ethers.getContractFactory("QuoteRouter");
    const quoteRouter        = await QuoteRouterFactory.deploy(oracleAddress, adminAddress, swapFeeBps);
    await quoteRouter.waitForDeployment();
    quoteAddress = await quoteRouter.getAddress();
    console.log("   ✅ QuoteRouter:", quoteAddress);
  }
  const quoteRouter = await ethers.getContractAt("QuoteRouter", quoteAddress);

  // Register tokens in QuoteRouter (requires deployer == ADMIN_ADDRESS)
  try {
    console.log("   Registering tokens in QuoteRouter...");
    await waitForTx(quoteRouter.registerToken(BTC_TOKEN,   ethers.encodeBytes32String("BTC")));
    await waitForTx(quoteRouter.registerToken(MEZO_TOKEN,  ethers.encodeBytes32String("MEZO")));
    await waitForTx(quoteRouter.registerToken(musdAddress, ethers.encodeBytes32String("MUSD")));
    console.log("   ✅ BTC, MEZO, MUSD registered");
  } catch {
    console.log("   ⚠️  Could not register tokens (deployer is not QuoteRouter owner).");
    console.log("      From the ADMIN wallet, call registerToken() for each token:");
    console.log(`      registerToken(${BTC_TOKEN},   bytes32("BTC"))`);
    console.log(`      registerToken(${MEZO_TOKEN},  bytes32("MEZO"))`);
    console.log(`      registerToken(${musdAddress}, bytes32("MUSD"))`);
  }

  // ── 5. SwapRouter ──────────────────────────────────────────────────────────
  console.log("\n5. Deploying SwapRouter...");
  const SwapRouterFactory = await ethers.getContractFactory("SwapRouter");
  const swapRouter        = await SwapRouterFactory.deploy(routerAddress, quoteAddress, adminAddress);
  await swapRouter.waitForDeployment();
  const swapAddress = await swapRouter.getAddress();
  console.log("   ✅ SwapRouter:", swapAddress);

  // Authorise VeNFTMarketplace to call SwapRouter (requires deployer == ADMIN_ADDRESS)
  try {
    console.log("   Authorising VeNFTMarketplace in SwapRouter...");
    await waitForTx(swapRouter.setAuthorisedCaller(marketplaceAddress, true));
    console.log("   ✅ Marketplace authorised");
  } catch {
    console.log("   ⚠️  Could not authorise marketplace (deployer is not SwapRouter owner).");
    console.log(`      From the ADMIN wallet, call: setAuthorisedCaller(${marketplaceAddress}, true)`);
  }

  // ── 6. SwapPaymentRouter (pay-with-any-token via Velodrome + buyNFT) ─────────
  // Works with the EXISTING marketplace: the buyer calls swapAndBuy(), it swaps
  // their token → the listing's ERC-20 quote token (e.g. MUSD) pool-direct through
  // Mezo's Velodrome-v2 DEX, then calls buyNFT and forwards the NFT. No routePayment
  // auth wiring needed. Mezo mainnet PoolFactory: 0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248
  // (has a liquid BTC/MUSD pool; MEZO has no pool and cannot be swapped).
  console.log("\n6. Deploying SwapPaymentRouter (Velodrome)...");
  const sprFeeBps   = parseInt(process.env.SWAP_PLATFORM_FEE_BPS || "50"); // <= 100 (1%)
  const poolFactory = process.env.POOL_FACTORY
    || (networkName === "mezomainnet" ? "0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248" : "");
  if (!poolFactory) {
    console.log("   ⚠️  POOL_FACTORY not set for this network — pass the Velodrome PoolFactory address.");
  }
  const SPRFactory = await ethers.getContractFactory("SwapPaymentRouter");
  const spr        = await SPRFactory.deploy(
    adminAddress, feeRecipient, marketplaceAddress,
    poolFactory || "0x0000000000000000000000000000000000000000", sprFeeBps
  );
  await spr.waitForDeployment();
  const sprAddress = await spr.getAddress();
  console.log("   ✅ SwapPaymentRouter:", sprAddress);
  console.log("   Velodrome PoolFactory:", poolFactory || "(unset — call setPoolFactory before swaps work)");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("\nNew contract addresses:");
  console.log(`NEXT_PUBLIC_BIDDING_${networkName === "mezomainnet" ? "MAINNET" : "TESTNET"}=${biddingAddress}`);
  console.log(`NEXT_PUBLIC_SNAPSHOT_STORE_${networkName === "mezomainnet" ? "MAINNET" : "TESTNET"}=${snapshotAddress}`);
  console.log(`NEXT_PUBLIC_ORACLE_HUB_${networkName === "mezomainnet" ? "MAINNET" : "TESTNET"}=${oracleAddress}`);
  console.log(`NEXT_PUBLIC_QUOTE_ROUTER_${networkName === "mezomainnet" ? "MAINNET" : "TESTNET"}=${quoteAddress}`);
  console.log(`NEXT_PUBLIC_SWAP_ROUTER_${networkName === "mezomainnet" ? "MAINNET" : "TESTNET"}=${swapAddress}`);
  console.log(`NEXT_PUBLIC_SWAP_PAYMENT_ROUTER_${networkName === "mezomainnet" ? "MAINNET" : "TESTNET"}=${sprAddress}`);

  console.log("\nVerify commands:");
  console.log(`npx hardhat verify --network ${networkName} ${biddingAddress} ${routerAddress} ${adminContractAddress}`);
  console.log(`npx hardhat verify --network ${networkName} ${snapshotAddress} ${adapterAddress} ${marketplaceAddress}`);
  console.log(`npx hardhat verify --network ${networkName} ${oracleAddress} ${adminAddress}`);
  console.log(`npx hardhat verify --network ${networkName} ${quoteAddress} ${oracleAddress} ${adminAddress} ${swapFeeBps}`);
  console.log(`npx hardhat verify --network ${networkName} ${swapAddress} ${routerAddress} ${quoteAddress} ${adminAddress}`);
  console.log(`npx hardhat verify --network ${networkName} ${sprAddress} ${adminAddress} ${feeRecipient} ${marketplaceAddress} ${poolFactory || "0x0000000000000000000000000000000000000000"} ${sprFeeBps}`);

  // Save to deployments/
  const fs = await import("fs");
  const dir = "./deployments";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = `${dir}/${networkName}-v2-modules.json`;
  fs.writeFileSync(file, JSON.stringify({
    network: networkName,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    reusedContracts: { marketplaceAddress, adapterAddress, routerAddress, adminContractAddress },
    newContracts: {
      VeNFTBidding: biddingAddress,
      ListingSnapshotStore: snapshotAddress,
      PriceOracleHub: oracleAddress,
      QuoteRouter: quoteAddress,
      SwapRouter: swapAddress,
      SwapPaymentRouter: sprAddress,
    },
  }, null, 2));
  console.log(`\nSaved to ${file}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
