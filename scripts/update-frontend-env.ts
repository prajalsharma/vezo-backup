/**
 * After deploying contracts, run this script to automatically write the
 * deployed addresses into frontend/.env.local.
 *
 * Usage:
 *   npx ts-node scripts/update-frontend-env.ts testnet
 *   npx ts-node scripts/update-frontend-env.ts mainnet
 */

import * as fs from "fs";
import * as path from "path";

const network = process.argv[2] as "testnet" | "mainnet";
if (!network || !["testnet", "mainnet"].includes(network)) {
  console.error("Usage: npx ts-node scripts/update-frontend-env.ts <testnet|mainnet>");
  process.exit(1);
}

const deploymentFile = path.join(__dirname, `../deployments/${network}.json`);
if (!fs.existsSync(deploymentFile)) {
  console.error(`Deployment file not found: ${deploymentFile}`);
  console.error(`Run the deploy script first: npx hardhat run scripts/deploy-${network}.ts --network mezo${network}`);
  process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
const { contracts } = deployment;

const envFile = path.join(__dirname, "../frontend/.env.local");
const suffix = network.toUpperCase();

// Read existing env or start fresh
let envContent = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";

function setEnvVar(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (regex.test(content)) {
    return content.replace(regex, line);
  }
  return content + (content.endsWith("\n") || content === "" ? "" : "\n") + line + "\n";
}

envContent = setEnvVar(envContent, `NEXT_PUBLIC_MARKETPLACE_${suffix}`, contracts.VeNFTMarketplace);
envContent = setEnvVar(envContent, `NEXT_PUBLIC_ADAPTER_${suffix}`, contracts.MezoVeNFTAdapter);
envContent = setEnvVar(envContent, `NEXT_PUBLIC_ROUTER_${suffix}`, contracts.PaymentRouter);
envContent = setEnvVar(envContent, `NEXT_PUBLIC_ADMIN_${suffix}`, contracts.MarketplaceAdmin);

fs.writeFileSync(envFile, envContent);

console.log(`\n✅ Updated frontend/.env.local with ${network} addresses:`);
console.log(`   NEXT_PUBLIC_MARKETPLACE_${suffix} = ${contracts.VeNFTMarketplace}`);
console.log(`   NEXT_PUBLIC_ADAPTER_${suffix}     = ${contracts.MezoVeNFTAdapter}`);
console.log(`   NEXT_PUBLIC_ROUTER_${suffix}      = ${contracts.PaymentRouter}`);
console.log(`   NEXT_PUBLIC_ADMIN_${suffix}       = ${contracts.MarketplaceAdmin}`);
console.log(`\nRestart your frontend dev server to pick up the new addresses.`);
