import { ethers } from "hardhat";

// ── Mainnet token/NFT addresses ───────────────────────────────────────────────
const VEBTC_MAINNET  = "0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279";
const VEMEZO_MAINNET = "0xb90fdAd3DFD180458D62Cc6acedc983D78E20122";
const MUSD_MAINNET   = "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186";

// Native BTC + MEZO token addresses on Mezo mainnet (used in QuoteRouter)
const BTC_TOKEN_MAINNET  = "0x7b7C000000000000000000000000000000000000";
const MEZO_TOKEN_MAINNET = "0x7B7c000000000000000000000000000000000001";

async function waitForTx(txPromise: Promise<any>) {
  const tx = await txPromise;
  await tx.wait();
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BTC");

  // Require explicit configuration — no fallback on mainnet
  if (!process.env.FEE_RECIPIENT || !process.env.ADMIN_ADDRESS) {
    throw new Error("MAINNET: FEE_RECIPIENT and ADMIN_ADDRESS must be set in .env");
  }

  const feeRecipient  = process.env.FEE_RECIPIENT;
  const adminAddress  = process.env.ADMIN_ADDRESS;
  const initialFeeBps = parseInt(process.env.PROTOCOL_FEE_BPS || "100"); // 1% default

  // Optional: Chainlink/Pyth adapter addresses for mainnet oracles.
  // If not provided, falls back to NO oracle (oracle features disabled until set post-deploy).
  const btcOracleAdapter  = process.env.BTC_ORACLE_ADAPTER  || "";
  const mezoOracleAdapter = process.env.MEZO_ORACLE_ADAPTER || "";
  const musdOracleAdapter = process.env.MUSD_ORACLE_ADAPTER || "";

  const swapFeeBps = parseInt(process.env.SWAP_FEE_BPS || "50"); // 0.5% default

  console.log("\n=== MEZO MAINNET DEPLOYMENT ===");
  console.log("WARNING: This deploys to mainnet — real BTC required for gas.");
  console.log("Network:        Mezo Mainnet (31612)");
  console.log("Fee Recipient:  ", feeRecipient);
  console.log("Admin Address:  ", adminAddress);
  console.log("Protocol Fee:   ", initialFeeBps, "bps (", initialFeeBps / 100, "%)");
  console.log("Swap Fee:       ", swapFeeBps, "bps (", swapFeeBps / 100, "%)");
  console.log("veBTC:          ", VEBTC_MAINNET);
  console.log("veMEZO:         ", VEMEZO_MAINNET);
  console.log("MUSD:           ", MUSD_MAINNET);
  if (btcOracleAdapter)  console.log("BTC Oracle:     ", btcOracleAdapter);
  if (mezoOracleAdapter) console.log("MEZO Oracle:    ", mezoOracleAdapter);
  if (musdOracleAdapter) console.log("MUSD Oracle:    ", musdOracleAdapter);
  if (!btcOracleAdapter) console.log("NOTE: No oracle adapters provided — oracle feeds can be registered post-deploy.");

  console.log("\nProceeding in 5 seconds...");
  await new Promise((r) => setTimeout(r, 5000));

  // ── Phase 1: Core marketplace (same as before) ──────────────────────────────

  console.log("\n1. Deploying MezoVeNFTAdapter...");
  const Adapter  = await ethers.getContractFactory("MezoVeNFTAdapter");
  const adapter  = await Adapter.deploy(VEBTC_MAINNET, VEMEZO_MAINNET);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("   MezoVeNFTAdapter:", adapterAddress);

  console.log("\n2. Deploying PaymentRouter...");
  const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
  const router = await PaymentRouter.deploy(feeRecipient, adminAddress, MUSD_MAINNET, initialFeeBps);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("   PaymentRouter:", routerAddress);

  console.log("\n3. Deploying MarketplaceAdmin...");
  const Admin = await ethers.getContractFactory("MarketplaceAdmin");
  const admin = await Admin.deploy(adminAddress, false); // false = mainnet
  await admin.waitForDeployment();
  const adminContractAddress = await admin.getAddress();
  console.log("   MarketplaceAdmin:", adminContractAddress);

  console.log("\n4. Deploying VeNFTMarketplace...");
  const Marketplace = await ethers.getContractFactory("VeNFTMarketplace");
  const marketplace = await Marketplace.deploy(adapterAddress, routerAddress, adminContractAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("   VeNFTMarketplace:", marketplaceAddress);

  console.log("\n5. Configuring MarketplaceAdmin...");
  await waitForTx(admin.setPaymentRouter(routerAddress));
  console.log("   PaymentRouter set in MarketplaceAdmin");

  console.log("\n6. Authorizing VeNFTMarketplace in PaymentRouter...");
  await waitForTx(router.setMarketplace(marketplaceAddress));
  console.log("   Marketplace authorized");

  console.log("\n7. Transferring PaymentRouter admin to MarketplaceAdmin (48h timelock)...");
  await waitForTx(router.transferAdmin(adminContractAddress));
  await waitForTx(admin.acceptRouterAdmin());
  console.log("   Admin transferred");

  // ── Phase 2: New v2 modules ─────────────────────────────────────────────────

  console.log("\n8. Deploying VeNFTBidding...");
  const Bidding = await ethers.getContractFactory("VeNFTBidding");
  const bidding = await Bidding.deploy(routerAddress, adminContractAddress);
  await bidding.waitForDeployment();
  const biddingAddress = await bidding.getAddress();
  console.log("   VeNFTBidding:", biddingAddress);

  console.log("\n9. Deploying ListingSnapshotStore...");
  const SnapshotStore = await ethers.getContractFactory("ListingSnapshotStore");
  const snapshotStore = await SnapshotStore.deploy(adapterAddress, marketplaceAddress);
  await snapshotStore.waitForDeployment();
  const snapshotStoreAddress = await snapshotStore.getAddress();
  console.log("   ListingSnapshotStore:", snapshotStoreAddress);

  console.log("\n10. Deploying PriceOracleHub...");
  const OracleHub = await ethers.getContractFactory("PriceOracleHub");
  const oracleHub = await OracleHub.deploy(adminAddress);
  await oracleHub.waitForDeployment();
  const oracleHubAddress = await oracleHub.getAddress();
  console.log("   PriceOracleHub:", oracleHubAddress);

  // Register oracle feeds only if adapters are provided.
  // On mainnet these should be Chainlink/Pyth adapters, not mocks.
  // If not set, feed registration is skipped — register post-deploy via admin.
  if (btcOracleAdapter && mezoOracleAdapter && musdOracleAdapter) {
    console.log("\n11. Registering mainnet oracle feeds...");
    // 1-hour staleness window for mainnet (3600s)
    const STALENESS_MAINNET = 3600;
    await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("BTC"),  btcOracleAdapter,  STALENESS_MAINNET));
    await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("MEZO"), mezoOracleAdapter, STALENESS_MAINNET));
    await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("MUSD"), musdOracleAdapter, STALENESS_MAINNET));
    console.log("   Feeds registered: BTC, MEZO, MUSD (1h staleness)");
  } else {
    console.log("\n11. Skipping oracle feed registration — set BTC_ORACLE_ADAPTER, MEZO_ORACLE_ADAPTER, MUSD_ORACLE_ADAPTER in .env to register.");
  }

  console.log("\n12. Deploying QuoteRouter...");
  const QuoteRouterFactory = await ethers.getContractFactory("QuoteRouter");
  const quoteRouter = await QuoteRouterFactory.deploy(oracleHubAddress, adminAddress, swapFeeBps);
  await quoteRouter.waitForDeployment();
  const quoteRouterAddress = await quoteRouter.getAddress();
  console.log("   QuoteRouter:", quoteRouterAddress);

  console.log("\n13. Registering token symbols in QuoteRouter...");
  await waitForTx(quoteRouter.registerToken(BTC_TOKEN_MAINNET,  ethers.encodeBytes32String("BTC")));
  await waitForTx(quoteRouter.registerToken(MEZO_TOKEN_MAINNET, ethers.encodeBytes32String("MEZO")));
  await waitForTx(quoteRouter.registerToken(MUSD_MAINNET,       ethers.encodeBytes32String("MUSD")));
  console.log("   Tokens registered: BTC, MEZO, MUSD");

  console.log("\n14. Deploying SwapRouter...");
  const SwapRouterFactory = await ethers.getContractFactory("SwapRouter");
  const swapRouter = await SwapRouterFactory.deploy(routerAddress, quoteRouterAddress, adminAddress);
  await swapRouter.waitForDeployment();
  const swapRouterAddress = await swapRouter.getAddress();
  console.log("   SwapRouter:", swapRouterAddress);

  console.log("\n15. Authorising VeNFTMarketplace in SwapRouter...");
  await waitForTx(swapRouter.setAuthorisedCaller(marketplaceAddress, true));
  console.log("   Marketplace authorised");

  console.log("\n16. Registering SnapshotStore in VeNFTMarketplace...");
  const marketplaceContract = await ethers.getContractAt("VeNFTMarketplace", marketplaceAddress);
  await waitForTx(marketplaceContract.setSnapshotStore(snapshotStoreAddress));
  console.log("   SnapshotStore registered");

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║         MEZO MAINNET DEPLOYMENT COMPLETE                  ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("Network: Mezo Mainnet (Chain ID: 31612)");
  console.log("Explorer: https://explorer.mezo.org\n");
  console.log("── Core contracts ──────────────────────────────────────────");
  console.log("MezoVeNFTAdapter:     ", adapterAddress);
  console.log("PaymentRouter:        ", routerAddress);
  console.log("MarketplaceAdmin:     ", adminContractAddress);
  console.log("VeNFTMarketplace:     ", marketplaceAddress);
  console.log("── v2 modules ──────────────────────────────────────────────");
  console.log("VeNFTBidding:         ", biddingAddress);
  console.log("ListingSnapshotStore: ", snapshotStoreAddress);
  console.log("PriceOracleHub:       ", oracleHubAddress);
  console.log("QuoteRouter:          ", quoteRouterAddress);
  console.log("SwapRouter:           ", swapRouterAddress);
  if (!btcOracleAdapter) {
    console.log("\n⚠  Oracle feeds NOT registered. Register post-deploy:");
    console.log("   Set BTC_ORACLE_ADAPTER, MEZO_ORACLE_ADAPTER, MUSD_ORACLE_ADAPTER");
    console.log("   then call oracleHub.registerFeed() from the admin address.");
  }
  console.log("\n── Verification commands ───────────────────────────────────");
  console.log(`npx hardhat verify --network mezomainnet ${adapterAddress} "${VEBTC_MAINNET}" "${VEMEZO_MAINNET}"`);
  console.log(`npx hardhat verify --network mezomainnet ${routerAddress} "${feeRecipient}" "${adminAddress}" "${MUSD_MAINNET}" ${initialFeeBps}`);
  console.log(`npx hardhat verify --network mezomainnet ${adminContractAddress} "${adminAddress}" false`);
  console.log(`npx hardhat verify --network mezomainnet ${marketplaceAddress} "${adapterAddress}" "${routerAddress}" "${adminContractAddress}"`);
  console.log(`npx hardhat verify --network mezomainnet ${biddingAddress} "${routerAddress}" "${adminContractAddress}"`);
  console.log(`npx hardhat verify --network mezomainnet ${snapshotStoreAddress} "${adapterAddress}" "${marketplaceAddress}"`);
  console.log(`npx hardhat verify --network mezomainnet ${oracleHubAddress} "${adminAddress}"`);
  console.log(`npx hardhat verify --network mezomainnet ${quoteRouterAddress} "${oracleHubAddress}" "${adminAddress}" ${swapFeeBps}`);
  console.log(`npx hardhat verify --network mezomainnet ${swapRouterAddress} "${routerAddress}" "${quoteRouterAddress}" "${adminAddress}"`);

  // ── Save deployment JSON ───────────────────────────────────────────────────
  const fs = await import("fs");
  const deploymentInfo = {
    network: "mezomainnet",
    chainId: 31612,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MezoVeNFTAdapter:     adapterAddress,
      PaymentRouter:        routerAddress,
      MarketplaceAdmin:     adminContractAddress,
      VeNFTMarketplace:     marketplaceAddress,
      VeNFTBidding:         biddingAddress,
      ListingSnapshotStore: snapshotStoreAddress,
      PriceOracleHub:       oracleHubAddress,
      QuoteRouter:          quoteRouterAddress,
      SwapRouter:           swapRouterAddress,
    },
    config: {
      veBTC:          VEBTC_MAINNET,
      veMEZO:         VEMEZO_MAINNET,
      MUSD:           MUSD_MAINNET,
      BTC_TOKEN:      BTC_TOKEN_MAINNET,
      MEZO_TOKEN:     MEZO_TOKEN_MAINNET,
      feeRecipient,
      adminAddress,
      initialFeeBps,
      swapFeeBps,
      oracleAdapters: { BTC: btcOracleAdapter, MEZO: mezoOracleAdapter, MUSD: musdOracleAdapter },
    },
  };

  const deploymentsDir = "./deployments";
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(`${deploymentsDir}/mainnet.json`, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to deployments/mainnet.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
