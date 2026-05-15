import { ethers } from "hardhat";

// Testnet contract addresses
const VEBTC_TESTNET = "0x38E35d92E6Bfc6787272A62345856B13eA12130a";
const VEMEZO_TESTNET = "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b";
const MUSD_TESTNET = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";

async function waitForTx(txPromise: Promise<any>) {
  const tx = await txPromise;
  await tx.wait();
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "BTC");

  // Get admin/treasury from env or use deployer
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const adminAddress = process.env.ADMIN_ADDRESS || deployer.address;
  const initialFeeBps = parseInt(process.env.PROTOCOL_FEE_BPS || "100"); // 1%

  console.log("\n--- Deployment Configuration ---");
  console.log("Network: Mezo Testnet (31611)");
  console.log("Fee Recipient:", feeRecipient);
  console.log("Admin Address:", adminAddress);
  console.log("Initial Fee:", initialFeeBps, "bps");
  console.log("veBTC:", VEBTC_TESTNET);
  console.log("veMEZO:", VEMEZO_TESTNET);
  console.log("MUSD:", MUSD_TESTNET);

  // 1. Deploy MezoVeNFTAdapter
  console.log("\n1. Deploying MezoVeNFTAdapter...");
  const Adapter = await ethers.getContractFactory("MezoVeNFTAdapter");
  const adapter = await Adapter.deploy(VEBTC_TESTNET, VEMEZO_TESTNET);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("   MezoVeNFTAdapter deployed to:", adapterAddress);

  // 2. Deploy PaymentRouter
  console.log("\n2. Deploying PaymentRouter...");
  const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
  const router = await PaymentRouter.deploy(
    feeRecipient,
    adminAddress,
    MUSD_TESTNET,
    initialFeeBps
  );
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("   PaymentRouter deployed to:", routerAddress);

  // 3. Deploy MarketplaceAdmin
  console.log("\n3. Deploying MarketplaceAdmin...");
  const Admin = await ethers.getContractFactory("MarketplaceAdmin");
  const admin = await Admin.deploy(adminAddress, true); // true = testnet
  await admin.waitForDeployment();
  const adminContractAddress = await admin.getAddress();
  console.log("   MarketplaceAdmin deployed to:", adminContractAddress);

  // 4. Deploy VeNFTMarketplace
  console.log("\n4. Deploying VeNFTMarketplace...");
  const Marketplace = await ethers.getContractFactory("VeNFTMarketplace");
  const marketplace = await Marketplace.deploy(
    adapterAddress,
    routerAddress,
    adminContractAddress
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("   VeNFTMarketplace deployed to:", marketplaceAddress);

  // 5. Configure MarketplaceAdmin with PaymentRouter
  console.log("\n5. Configuring MarketplaceAdmin...");
  await waitForTx(admin.setPaymentRouter(routerAddress));
  console.log("   PaymentRouter set in MarketplaceAdmin");

  // 6. Authorize VeNFTMarketplace as sole caller of PaymentRouter
  console.log("\n6. Authorizing VeNFTMarketplace in PaymentRouter...");
  await waitForTx(router.setMarketplace(marketplaceAddress));
  console.log("   Marketplace authorized in PaymentRouter");

  // 7. Transfer PaymentRouter admin to MarketplaceAdmin (two-step)
  // This enforces the 48-hour fee change timelock on-chain.
  console.log("\n7. Transferring PaymentRouter admin to MarketplaceAdmin...");
  console.log("   Step 7a: Proposing admin transfer...");
  await waitForTx(router.transferAdmin(adminContractAddress));
  console.log("   Step 7b: Accepting admin transfer from MarketplaceAdmin...");
  await waitForTx(admin.acceptRouterAdmin());
  console.log("   PaymentRouter admin transferred to MarketplaceAdmin");

  // ── Phase 2: Deploy new additive modules ─────────────────────────────────

  // 8. Deploy VeNFTBidding
  console.log("\n8. Deploying VeNFTBidding...");
  const Bidding = await ethers.getContractFactory("VeNFTBidding");
  const bidding = await Bidding.deploy(routerAddress, adminContractAddress);
  await bidding.waitForDeployment();
  const biddingAddress = await bidding.getAddress();
  console.log("   VeNFTBidding deployed to:", biddingAddress);

  // 9. Deploy ListingSnapshotStore
  console.log("\n9. Deploying ListingSnapshotStore...");
  const SnapshotStore = await ethers.getContractFactory("ListingSnapshotStore");
  const snapshotStore = await SnapshotStore.deploy(adapterAddress, marketplaceAddress);
  await snapshotStore.waitForDeployment();
  const snapshotStoreAddress = await snapshotStore.getAddress();
  console.log("   ListingSnapshotStore deployed to:", snapshotStoreAddress);

  // 10. Deploy PriceOracleHub
  console.log("\n10. Deploying PriceOracleHub...");
  const OracleHub = await ethers.getContractFactory("PriceOracleHub");
  const oracleHub = await OracleHub.deploy(adminAddress);
  await oracleHub.waitForDeployment();
  const oracleHubAddress = await oracleHub.getAddress();
  console.log("   PriceOracleHub deployed to:", oracleHubAddress);

  // 11. Deploy MockPriceAdapters for BTC, MEZO, MUSD (testnet only — replace with Chainlink on mainnet)
  console.log("\n11. Deploying MockPriceAdapters (testnet)...");
  const MockAdapter = await ethers.getContractFactory("MockPriceAdapter");
  // Prices in USD with 18 decimals (approximate testnet values)
  const btcAdapter   = await MockAdapter.deploy(adminAddress, ethers.parseEther("97000")); // $97k BTC
  await btcAdapter.waitForDeployment();
  const btcAdapterAddress = await btcAdapter.getAddress();

  const mezoAdapter  = await MockAdapter.deploy(adminAddress, ethers.parseEther("0.15"));   // $0.15 MEZO
  await mezoAdapter.waitForDeployment();
  const mezoAdapterAddress = await mezoAdapter.getAddress();

  const musdAdapter  = await MockAdapter.deploy(adminAddress, ethers.parseEther("1.0"));    // $1 MUSD
  await musdAdapter.waitForDeployment();
  const musdAdapterAddress = await musdAdapter.getAddress();
  console.log("   MockPriceAdapter (BTC)  :", btcAdapterAddress);
  console.log("   MockPriceAdapter (MEZO) :", mezoAdapterAddress);
  console.log("   MockPriceAdapter (MUSD) :", musdAdapterAddress);

  // 12. Register feeds in PriceOracleHub (5-minute staleness on testnet)
  console.log("\n12. Registering price feeds...");
  const STALENESS = 5 * 60; // 5 minutes for testnet
  await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("BTC"),  btcAdapterAddress,  STALENESS));
  await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("MEZO"), mezoAdapterAddress, STALENESS));
  await waitForTx(oracleHub.registerFeed(ethers.encodeBytes32String("MUSD"), musdAdapterAddress, STALENESS));
  console.log("   Feeds registered: BTC, MEZO, MUSD");

  // 13. Deploy QuoteRouter (0.5% swap fee on testnet)
  console.log("\n13. Deploying QuoteRouter...");
  const QuoteRouterFactory = await ethers.getContractFactory("QuoteRouter");
  const quoteRouter = await QuoteRouterFactory.deploy(oracleHubAddress, adminAddress, 50); // 50bps = 0.5%
  await quoteRouter.waitForDeployment();
  const quoteRouterAddress = await quoteRouter.getAddress();
  console.log("   QuoteRouter deployed to:", quoteRouterAddress);

  // 14. Register token symbols in QuoteRouter
  console.log("\n14. Registering token symbols in QuoteRouter...");
  const BTC_ADDRESS  = "0x7b7C000000000000000000000000000000000000";
  const MEZO_ADDRESS = "0x7B7c000000000000000000000000000000000001";
  await waitForTx(quoteRouter.registerToken(BTC_ADDRESS,  ethers.encodeBytes32String("BTC")));
  await waitForTx(quoteRouter.registerToken(MEZO_ADDRESS, ethers.encodeBytes32String("MEZO")));
  await waitForTx(quoteRouter.registerToken(MUSD_TESTNET, ethers.encodeBytes32String("MUSD")));
  console.log("   Tokens registered: BTC, MEZO, MUSD");

  // 15. Deploy SwapRouter
  console.log("\n15. Deploying SwapRouter...");
  const SwapRouterFactory = await ethers.getContractFactory("SwapRouter");
  const swapRouter = await SwapRouterFactory.deploy(routerAddress, quoteRouterAddress, adminAddress);
  await swapRouter.waitForDeployment();
  const swapRouterAddress = await swapRouter.getAddress();
  console.log("   SwapRouter deployed to:", swapRouterAddress);

  // 16. Authorise VeNFTMarketplace as caller in SwapRouter
  console.log("\n16. Authorising marketplace in SwapRouter...");
  await waitForTx(swapRouter.setAuthorisedCaller(marketplaceAddress, true));
  console.log("   VeNFTMarketplace authorised in SwapRouter");

  // 17. Register SnapshotStore in VeNFTMarketplace (optional — deployer must hold DEFAULT_ADMIN_ROLE)
  console.log("\n17. Registering SnapshotStore in VeNFTMarketplace...");
  const marketplaceContract = await ethers.getContractAt("VeNFTMarketplace", marketplaceAddress);
  await waitForTx(marketplaceContract.setSnapshotStore(snapshotStoreAddress));
  console.log("   SnapshotStore registered");

  // Output deployment summary
  console.log("\n=== TESTNET DEPLOYMENT COMPLETE ===");
  console.log("Network: Mezo Testnet (Chain ID: 31611)");
  console.log("Explorer: https://explorer.test.mezo.org");
  console.log("");
  console.log("Contract Addresses:");
  console.log("-------------------");
  console.log("MezoVeNFTAdapter:     ", adapterAddress);
  console.log("PaymentRouter:        ", routerAddress);
  console.log("MarketplaceAdmin:     ", adminContractAddress);
  console.log("VeNFTMarketplace:     ", marketplaceAddress);
  console.log("--- New Modules ---");
  console.log("VeNFTBidding:         ", biddingAddress);
  console.log("ListingSnapshotStore: ", snapshotStoreAddress);
  console.log("PriceOracleHub:       ", oracleHubAddress);
  console.log("QuoteRouter:          ", quoteRouterAddress);
  console.log("SwapRouter:           ", swapRouterAddress);
  console.log("MockAdapter (BTC):    ", btcAdapterAddress);
  console.log("MockAdapter (MEZO):   ", mezoAdapterAddress);
  console.log("MockAdapter (MUSD):   ", musdAdapterAddress);
  console.log("");
  console.log("Verify contracts:");
  console.log(`npx hardhat verify --network mezotestnet ${adapterAddress} ${VEBTC_TESTNET} ${VEMEZO_TESTNET}`);
  console.log(`npx hardhat verify --network mezotestnet ${routerAddress} ${feeRecipient} ${adminAddress} ${MUSD_TESTNET} ${initialFeeBps}`);
  console.log(`npx hardhat verify --network mezotestnet ${adminContractAddress} ${adminAddress} true`);
  console.log(`npx hardhat verify --network mezotestnet ${marketplaceAddress} ${adapterAddress} ${routerAddress} ${adminContractAddress}`);
  console.log(`npx hardhat verify --network mezotestnet ${biddingAddress} ${routerAddress} ${adminContractAddress}`);
  console.log(`npx hardhat verify --network mezotestnet ${snapshotStoreAddress} ${adapterAddress} ${marketplaceAddress}`);
  console.log(`npx hardhat verify --network mezotestnet ${oracleHubAddress} ${adminAddress}`);
  console.log(`npx hardhat verify --network mezotestnet ${quoteRouterAddress} ${oracleHubAddress} ${adminAddress} 50`);
  console.log(`npx hardhat verify --network mezotestnet ${swapRouterAddress} ${routerAddress} ${quoteRouterAddress} ${adminAddress}`);

  // Save deployment info
  const fs = await import("fs");
  const deploymentInfo = {
    network: "mezotestnet",
    chainId: 31611,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MezoVeNFTAdapter: adapterAddress,
      PaymentRouter: routerAddress,
      MarketplaceAdmin: adminContractAddress,
      VeNFTMarketplace: marketplaceAddress,
      VeNFTBidding: biddingAddress,
      ListingSnapshotStore: snapshotStoreAddress,
      PriceOracleHub: oracleHubAddress,
      QuoteRouter: quoteRouterAddress,
      SwapRouter: swapRouterAddress,
      MockPriceAdapterBTC: btcAdapterAddress,
      MockPriceAdapterMEZO: mezoAdapterAddress,
      MockPriceAdapterMUSD: musdAdapterAddress,
    },
    config: {
      veBTC: VEBTC_TESTNET,
      veMEZO: VEMEZO_TESTNET,
      MUSD: MUSD_TESTNET,
      feeRecipient,
      adminAddress,
      initialFeeBps,
    },
  };

  const deploymentsDir = "./deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    `${deploymentsDir}/testnet.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployments/testnet.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
