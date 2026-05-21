# Mezo veNFT Marketplace

[![Built on Mezo](https://img.shields.io/badge/Network-Mezo-orange.svg)](https://mezo.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Security Audited](https://img.shields.io/badge/Security-4%20Issues%20Fixed-success.svg)](#security--audit-diff)

> An escrowless, peer-to-peer secondary marketplace for trading **veBTC** and **veMEZO** vote-escrowed NFTs on the Mezo Network. Sellers retain full custody until atomic purchase.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Contract Addresses](#contract-addresses)
4. [Quick Start](#quick-start)
5. [Deployment Guide](#deployment-guide)
6. [Environment Variables](#environment-variables)
7. [Security & Audit Diff](#security--audit-diff)
8. [Bounty Compliance](#bounty-compliance)
9. [Maintenance Plan](#maintenance-plan)

---

## Overview

The Mezo veNFT Marketplace provides a secondary liquidity layer for locked Bitcoin and MEZO governance positions. Users can:

- **List** veBTC and veMEZO positions for sale at any price in BTC, MEZO, or MUSD
- **Browse** all active listings with real-time intrinsic value, voting power, lock expiry, and discount percentage
- **Buy** listed positions with a single atomic transaction — NFT and payment swap simultaneously
- **Cancel** listings at any time with no penalty
- **View** full position details: locked amount, voting weight (with decay), time remaining, price-to-value ratio

### Key Design Properties

| Property | Detail |
|---|---|
| **Escrowless** | NFT stays in seller's wallet until purchase — no custodial risk |
| **Atomic swap** | NFT transfer happens before payment — buyer cannot lose funds if NFT moved |
| **Multi-token** | Native BTC, MEZO governance token, MUSD stablecoin |
| **Protocol fee** | Default 2%, hardcapped at 5%, 48-hour timelock on changes |
| **Emergency pause** | Admin can halt marketplace instantly |

---

## Architecture

Four modular smart contracts — adapted from the OpenXSwap audited pattern for Mezo's dual-token system:

| Contract | Role | Source |
|:---|:---|:---|
| **`VeNFTMarketplace`** | Core listing and trading logic | [contracts/core/VeNFTMarketplace.sol](./contracts/core/VeNFTMarketplace.sol) |
| **`MezoVeNFTAdapter`** | Read-only veNFT value queries (locked amount, decay, voting power) | [contracts/adapters/MezoVeNFTAdapter.sol](./contracts/adapters/MezoVeNFTAdapter.sol) |
| **`PaymentRouter`** | BTC/MEZO/MUSD payment routing with fee split | [contracts/core/PaymentRouter.sol](./contracts/core/PaymentRouter.sol) |
| **`MarketplaceAdmin`** | Governance, emergency pause, timelocked fee management | [contracts/core/MarketplaceAdmin.sol](./contracts/core/MarketplaceAdmin.sol) |

### Deployment Order

```
1. MezoVeNFTAdapter(veBTC, veMEZO)
2. PaymentRouter(feeRecipient, admin, MUSD, feeBps)
3. MarketplaceAdmin(admin, isTestnet)
4. VeNFTMarketplace(adapter, router, admin)
5. router.setMarketplace(marketplace)    ← security: restrict routePayment caller (one-time)
6. admin.setPaymentRouter(router)        ← governance: link fee control
7. router.transferAdmin(adminContract)   ← propose admin transfer to MarketplaceAdmin
8. admin.acceptRouterAdmin()             ← accept: enforce 48h timelock on fee changes
```

---

## Contract Addresses

### Mezo Testnet (Chain ID: 31611)

| Contract | Address |
|---|---|
| BTC (native) | `0x7b7c000000000000000000000000000000000000` |
| MEZO | `0x7b7c000000000000000000000000000000000001` |
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| veBTC (ERC-721) | `0x38E35d92E6Bfc6787272A62345856B13eA12130a` |
| veMEZO (ERC-721) | `0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b` |
| **VeNFTMarketplace** | **`0x293ba099c5Cf32af54013F00fEe8D2EA1cad8570`** |
| **MezoVeNFTAdapter** | **`0x8EC595099030aB282511c87cAF104E734418Eff5`** |
| **PaymentRouter** | **`0xA4098F23aA2883DA13A714982d89BFB403718fb9`** |
| **MarketplaceAdmin** | **`0x5bBc2d83D0786Bf2Bc56096d832e6B7cfcca9396`** |
| RPC | `https://rpc.test.mezo.org` |
| Explorer | `https://explorer.test.mezo.org` |
| Faucet | `https://faucet.test.mezo.org` |

### Mezo Mainnet (Chain ID: 31612)

| Contract | Address |
|---|---|
| BTC (native) | `0x7b7c000000000000000000000000000000000000` |
| MEZO | `0x7b7c000000000000000000000000000000000001` |
| MUSD | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` |
| veBTC (ERC-721) | `0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279` |
| veMEZO (ERC-721) | `0xb90fdAd3DFD180458D62Cc6acedc983D78E20122` |
| **VeNFTMarketplace** | **`0x293ba099c5Cf32af54013F00fEe8D2EA1cad8570`** |
| **MezoVeNFTAdapter** | **`0x8EC595099030aB282511c87cAF104E734418Eff5`** |
| **PaymentRouter** | **`0xA4098F23aA2883DA13A714982d89BFB403718fb9`** |
| **MarketplaceAdmin** | **`0x5bBc2d83D0786Bf2Bc56096d832e6B7cfcca9396`** |
| RPC | `https://rpc.mezo.org` |
| Explorer | `https://explorer.mezo.org` |

---

## Quick Start

### Prerequisites

- Node.js >= 20
- npm or bun
- MetaMask with Mezo Testnet added
- Testnet BTC from [faucet.test.mezo.org](https://faucet.test.mezo.org)

### Add Mezo Testnet to MetaMask

```
Network Name:   Mezo Testnet
RPC URL:        https://rpc.test.mezo.org
Chain ID:       31611
Currency:       BTC
Explorer:       https://explorer.test.mezo.org
```

### Install and Run

```bash
git clone https://github.com/prajalsharma/veNFT-marketplace.git
cd veNFT-marketplace

# Install root dependencies (contracts + hardhat)
npm install

# Compile contracts
npm run compile

# Copy and fill environment variables
cp .env.example .env

# Install and run frontend
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Deployment Guide

### 1. Configure `.env`

```bash
cp .env.example .env
```

Fill in at minimum:
```env
DEPLOYER_PRIVATE_KEY=0x...        # wallet with testnet BTC for gas
FEE_RECIPIENT=0x...               # address to receive protocol fees
ADMIN_ADDRESS=0x...               # address to hold all admin roles
PROTOCOL_FEE_BPS=200              # 200 = 2%
NEXT_PUBLIC_WALLETCONNECT_ID=...  # from cloud.walletconnect.com
```

### 2. Deploy to Testnet

```bash
npx hardhat run scripts/deploy-testnet.ts --network mezotestnet
```

This script:
- Deploys all 4 contracts in the correct order
- Calls `router.setMarketplace(marketplace)` to restrict payment routing
- Calls `admin.setPaymentRouter(router)` for fee governance
- Saves deployment addresses to `deployments/testnet.json`
- Prints `npx hardhat verify` commands for each contract

### 3. Update Frontend `.env`

After deployment, copy addresses from `deployments/testnet.json` into `frontend/.env.local`.

The testnet deployment is already live — use these values directly:

```env
NEXT_PUBLIC_WALLETCONNECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_MARKETPLACE_TESTNET=0x293ba099c5Cf32af54013F00fEe8D2EA1cad8570
NEXT_PUBLIC_ADAPTER_TESTNET=0x8EC595099030aB282511c87cAF104E734418Eff5
NEXT_PUBLIC_ROUTER_TESTNET=0xA4098F23aA2883DA13A714982d89BFB403718fb9
NEXT_PUBLIC_ADMIN_TESTNET=0x5bBc2d83D0786Bf2Bc56096d832e6B7cfcca9396
```

### 4. Deploy to Mainnet

```bash
# Requires FEE_RECIPIENT and ADMIN_ADDRESS set in .env
npx hardhat run scripts/deploy-mainnet.ts --network mezomainnet
```

### 5. Verify Contracts

The deploy script prints the exact verify commands. Example:

```bash
npx hardhat verify --network mezotestnet <ADAPTER_ADDRESS> <VEBTC> <VEMEZO>
npx hardhat verify --network mezotestnet <ROUTER_ADDRESS> <FEE_RECIPIENT> <ADMIN> <MUSD> 200
npx hardhat verify --network mezotestnet <ADMIN_ADDRESS> <ADMIN> true
npx hardhat verify --network mezotestnet <MARKETPLACE_ADDRESS> <ADAPTER> <ROUTER> <ADMIN_CONTRACT>
```

### 6. Run Tests

```bash
npm test
```

---

## Environment Variables

### Root (contracts + deploy)

| Variable | Description | Required |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | Private key of deployer wallet | Yes |
| `FEE_RECIPIENT` | Address receiving protocol fees | Mainnet only |
| `ADMIN_ADDRESS` | Address receiving all admin roles | Mainnet only |
| `PROTOCOL_FEE_BPS` | Initial fee in basis points (default: 200 = 2%) | No |
| `REPORT_GAS` | Enable Hardhat gas reporter | No |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_ID` | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_MARKETPLACE_TESTNET` | Deployed VeNFTMarketplace on testnet |
| `NEXT_PUBLIC_ADAPTER_TESTNET` | Deployed MezoVeNFTAdapter on testnet |
| `NEXT_PUBLIC_ROUTER_TESTNET` | Deployed PaymentRouter on testnet |
| `NEXT_PUBLIC_ADMIN_TESTNET` | Deployed MarketplaceAdmin on testnet |
| `NEXT_PUBLIC_MARKETPLACE_MAINNET` | Deployed VeNFTMarketplace on mainnet |
| `NEXT_PUBLIC_ADAPTER_MAINNET` | Deployed MezoVeNFTAdapter on mainnet |
| `NEXT_PUBLIC_ROUTER_MAINNET` | Deployed PaymentRouter on mainnet |
| `NEXT_PUBLIC_ADMIN_MAINNET` | Deployed MarketplaceAdmin on mainnet |

---

## Security & Audit Diff

Per the bounty requirement, all modifications from the audited OpenXSwap base pattern are documented here.

### Modifications Made

#### 1. `MezoVeNFTAdapter` — New Contract
Introduced a read-only adapter that queries Mezo's `IVotingEscrow` interface (veBTC and veMEZO) for locked amounts, decay-adjusted voting power, and lock expiry. This isolates all Mezo-specific logic from the core marketplace without modifying core trading functions.

#### 2. `PaymentRouter` — Native BTC Support + Access Restriction
- Added native BTC payment path (value-based transfer) alongside ERC-20
- **[Security Fix]** Added `onlyMarketplace` modifier to `routePayment` — only the deployed `VeNFTMarketplace` contract can trigger payment routing, preventing any external address from exploiting user token approvals

#### 3. `VeNFTMarketplace` — Security Patches Applied

| Issue | Severity | Fix |
|---|---|---|
| Payment sent before NFT transfer — buyer loses funds if NFT moved away between list and buy | **Critical** | NFT transferred first, then payment routed |
| `routePayment` open to any caller — ERC-20 approval drain vector | **High** | `onlyMarketplace` modifier added to `PaymentRouter` |
| `whenNotPaused` fail-open — emergency pause has no effect if admin staticcall fails | **High** | Fail-closed: reverts with `PauseCheckFailed` if staticcall fails |
| ERC-20 allowance not validated before NFT transfer in `buyNFT` | **High** | Allowance pre-check added before `safeTransferFrom` |
| Expired veNFTs (zero value) purchasable | **Medium** | `adapter.isExpired()` check in `buyNFT` |
| Seller could buy own listing | **Medium** | `SelfPurchase` guard added |
| Ownership not re-validated at buy time | **Medium** | `ownerOf` check before state mutation in `buyNFT` |
| `proposeFeeChange` silently overwrites pending proposal | **Medium** | Reverts with `PendingChangeExists` if proposal already pending |
| `executeFeeChange` emits event without updating fee when router is zero | **Medium** | Reverts with `RouterNotSet` if `paymentRouter == address(0)` |
| `floorPrices` never decremented — stale and manipulable | **Medium** | NatSpec warning added; view-only, not used as price oracle |

#### 4. `IVotingEscrow` Interface — Velodrome v2 Compatibility

The deployed veBTC and veMEZO contracts are EIP-1967 proxies over a Velodrome v2 fork. Two interface differences from Velodrome v1 (which OpenXSwap targets) required frontend-level workarounds rather than adapter changes:

| Function | v1 / OpenXSwap | Deployed Mezo contracts | Resolution |
|---|---|---|---|
| Token enumeration | `tokensOfOwner(address)` | Not present | Use `balanceOf(address)` + `ownerToNFTokenIdList(address,uint256)` |
| Per-NFT voting power | `balanceOfNFT(uint256)` | Not present | Compute from `locked()` data: `amount × (end − now) / MAXTIME` |
| Lock struct | `(int128 amount, uint256 end)` | `(int128 amount, uint256 end, bool isPermanent, int128 delegatedBalance)` | Adapter reads only words 0–1; frontend handles `isPermanent` (end=0) |

`getIntrinsicValue`, `isExpired`, `isSupported`, and all ERC-721 functions (`approve`, `safeTransferFrom`, `ownerOf`, `getApproved`) are present and work correctly.

#### 5. `MarketplaceAdmin` — Role Segregation + Governance Hardening
Enhanced access control to separate `PAUSER_ROLE`, `FEE_MANAGER_ROLE`, and `COLLECTION_MANAGER_ROLE` for operational security. Added 48-hour timelock on all fee changes. Added `acceptRouterAdmin()` to complete two-step PaymentRouter admin transfer.

#### 6. `PaymentRouter` — Admin Hardening
- **[Security Fix]** Two-step admin transfer (`transferAdmin` + `acceptAdmin`) prevents irreversible loss from typo
- **[Security Fix]** `setMarketplace` is one-time only (`AlreadySet` guard) — prevents silent deauthorization
- **[Recovery]** Added `sweepBTC()` for admin recovery of accidentally sent native BTC
- **[CRIT-01 Fix]** Deploy scripts now transfer PaymentRouter admin to MarketplaceAdmin, enforcing the 48-hour fee timelock

### Security Checklist

```
[✓] CEI pattern enforced in buyNFT (state → NFT transfer → payment)
[✓] ReentrancyGuard on all state-mutating functions
[✓] SafeERC20 for all ERC-20 transfers
[✓] safeTransferFrom for all NFT transfers
[✓] Ownership validated at listNFT AND re-validated at buyNFT
[✓] Approval validated at listNFT time AND ERC-20 allowance pre-checked at buyNFT
[✓] routePayment restricted to marketplace contract only
[✓] setMarketplace is one-time only (AlreadySet guard)
[✓] Self-purchase blocked
[✓] Expired veNFT purchase blocked
[✓] Zero-address guards on all constructors
[✓] Protocol fee hardcapped at 5% (500 bps)
[✓] Fee changes require 48-hour timelock (enforced via two-step admin transfer to MarketplaceAdmin)
[✓] proposeFeeChange reverts if a pending proposal already exists
[✓] executeFeeChange reverts if PaymentRouter not configured
[✓] Emergency pause is fail-closed (reverts if admin contract call fails)
[✓] Emergency pause available to PAUSER_ROLE
[✓] Two-step admin transfer on PaymentRouter (propose + accept)
[✓] BTC sweep function for accidentally sent native BTC
[✓] Integer overflow protected (Solidity ^0.8.28)
```

---

## Bounty Compliance

| Requirement | Status |
|---|---|
| List veNFTs (BTC / MEZO / MUSD price) | ✅ |
| Browse listings with metadata | ✅ |
| Purchase veNFTs (atomic swap) | ✅ |
| Cancel listings | ✅ |
| View intrinsic value, voting power, lock expiry, discount % | ✅ |
| Emergency pause | ✅ |
| Protocol fee with governance | ✅ |
| ERC-721 support (veBTC + veMEZO) | ✅ |
| Escrowless design | ✅ |
| Multi-token payments (BTC/MEZO/MUSD) | ✅ |
| MetaMask + EVM wallets | ✅ |
| Bitcoin wallets via @mezo-org/passport (Unisat, OKX, Xverse) | ✅ |
| Testnet/Mainnet network selector | ✅ |
| Responsive design (desktop + mobile) | ✅ |
| GitHub repo | ✅ |
| README | ✅ |
| Testnet deploy script | ✅ |
| Mainnet deploy script | ✅ |
| Tests (3 test suites) | ✅ |
| Maintenance plan (MAINTENANCE.md) | ✅ |
| Transaction/Sale history | ✅ Bonus |
| Analytics (floor prices, discount stats) | ✅ Bonus |

---

## Maintenance Plan

See [MAINTENANCE.md](./MAINTENANCE.md) for the full 6-month post-launch support commitment including planned features:
- Subgraph / event indexer integration
- Batch list/buy operations
- Governance integration (vote buttons on listed veNFTs)
- Historical price charts and volume analytics
