"use client";

import { useReadContract, useReadContracts, useWriteContract, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { useNetwork } from "./useNetwork";
import { computeDiscountBps } from "@/lib/computeDiscount";

// ─── Discount logic ───────────────────────────────────────────────────────────
// Discount percentages are only shown when the listing currency matches the
// locked asset denomination. Cross-token listings intentionally render no %
// until a reliable oracle-backed comparison exists.

// ─── Marketplace ABI ──────────────────────────────────────────────────────────

const MARKETPLACE_ABI = [
  {
    name: "nextListingId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "listings",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "collection", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "paymentToken", type: "address" },
      { name: "createdAt", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "listNFT",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "paymentToken", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "buyNFT",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getUserListings",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  // ── Custom errors — needed for wagmi to decode revert reasons ──────────────
  { name: "Paused",                  type: "error", inputs: [] },
  { name: "NotOwner",                type: "error", inputs: [] },
  { name: "NotApproved",             type: "error", inputs: [] },
  { name: "UnsupportedCollection",   type: "error", inputs: [] },
  { name: "UnsupportedPaymentToken", type: "error", inputs: [] },
  { name: "ListingNotActive",        type: "error", inputs: [] },
  { name: "InvalidPrice",            type: "error", inputs: [] },
  { name: "TransferFailed",          type: "error", inputs: [] },
  { name: "ExpiredVeNFT",            type: "error", inputs: [] },
  { name: "SelfPurchase",            type: "error", inputs: [] },
  { name: "InvalidAddress",          type: "error", inputs: [] },
  { name: "InvalidAmount",           type: "error", inputs: [] },
  { name: "Unauthorized",            type: "error", inputs: [] },
  {
    name: "InsufficientPayment",
    type: "error",
    inputs: [
      { name: "sent",     type: "uint256" },
      { name: "required", type: "uint256" },
    ],
  },
  {
    name: "UnsupportedToken",
    type: "error",
    inputs: [{ name: "token", type: "address" }],
  },
] as const;

// ─── Adapter ABI ──────────────────────────────────────────────────────────────
// getVotingPower is intentionally omitted — it calls balanceOfNFT which does not
// exist on the deployed veBTC/veMEZO contracts (Velodrome v2 fork).
// Voting power is computed in the frontend from locked() data instead.

const ADAPTER_ABI = [
  {
    name: "getIntrinsicValue",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "collection", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "lockEnd", type: "uint256" },
    ],
  },
] as const;

// ─── ERC-721 ABI ──────────────────────────────────────────────────────────────

const ERC721_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getApproved",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    // Standard ERC-721 balanceOf — returns token count for an address
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ─── VotingEscrow enumeration ABI ─────────────────────────────────────────────
// The deployed veBTC/veMEZO contracts are Velodrome v2 forks.
// They do NOT have tokensOfOwner(address). Instead they expose:
//   balanceOf(address)                    → token count
//   ownerToNFTokenIdList(address,uint256) → tokenId at index

const VOTING_ESCROW_ENUM_ABI = [
  {
    // Returns number of NFTs owned by address (ERC-721 standard)
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    // Returns tokenId at index i for owner (Velodrome v2 enumeration)
    name: "ownerToNFTokenIdList",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ─── ERC-20 ABI ───────────────────────────────────────────────────────────────

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ─── Grant NFT detection ABI ──────────────────────────────────────────────────
// Grant veNFTs are identified by two storage slots on the VotingEscrow contract:
//   grantManager[tokenId] != address(0)  → token was distributed as a grant
//   vestingEnd[tokenId]   != 0           → token has a non-zero vesting end
// Both conditions must be true for a token to be classified as a Grant NFT.
// Grant NFTs CANNOT be merged or split.  They CAN be listed and purchased.

const GRANT_NFT_ABI = [
  {
    name: "grantManager",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "vestingEnd",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ─── Voting power computation ─────────────────────────────────────────────────
// Derived from locked() data returned by getIntrinsicValue.
// Velodrome v2: VP = amount * (end - now) / MAXTIME  (for timed locks)
//               VP = amount                           (for permanent locks, end=0)
// veBTC MAXTIME = 28 days, veMEZO MAXTIME = 4 years (1456 days)

const VEBTC_MAXTIME  = BigInt(28 * 24 * 60 * 60);   // 28 days in seconds
const VEMEZO_MAXTIME = BigInt(1456 * 24 * 60 * 60);  // 4 years in seconds

export function computeVotingPower(
  amount: bigint,
  lockEnd: bigint,
  isVeBTC: boolean
): bigint {
  if (amount === 0n) return 0n;
  // Permanent lock (end=0): full voting power equals locked amount
  if (lockEnd === 0n) return amount;
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (lockEnd <= now) return 0n; // expired
  const remaining = lockEnd - now;
  const maxTime = isVeBTC ? VEBTC_MAXTIME : VEMEZO_MAXTIME;
  // Cap at maxTime to avoid > 100% for locks longer than max
  const capped = remaining > maxTime ? maxTime : remaining;
  return (amount * capped) / maxTime;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Listing {
  listingId: number;
  seller: string;
  nftContract: string;
  collection: "veBTC" | "veMEZO";
  tokenId: bigint;
  price: bigint;
  paymentToken: string;
  active: boolean;
  createdAt: bigint;
  intrinsicValue: bigint;
  votingPower: bigint;
  lockEnd: bigint;
  discountBps: bigint | null;
  /** True if this veNFT is a grant NFT (grantManager != 0x0 AND vestingEnd != 0).
   *  Grant NFTs cannot be merged or split, but CAN be listed and purchased. */
  isGrant: boolean;
}

interface ListingTuple {
  seller: `0x${string}`;
  collection: `0x${string}`;
  tokenId: bigint;
  price: bigint;
  paymentToken: `0x${string}`;
  createdAt: bigint;
  active: boolean;
}

export interface WalletVeNFT {
  tokenId: bigint;
  collection: "veBTC" | "veMEZO";
  nftContract: string;
  intrinsicValue: bigint;
  votingPower: bigint;
  lockEnd: bigint;
  /** True if this is a grant NFT — cannot be merged or split. */
  isGrant: boolean;
}

// ─── useMarketplace ───────────────────────────────────────────────────────────

export function useMarketplace() {
  const { contracts, chainId } = useNetwork();
  const { address } = useAccount();
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const ZERO = "0x0000000000000000000000000000000000000000";
  const marketplaceAddress = contracts.marketplace as `0x${string}`;
  const adapterAddress = contracts.adapter as `0x${string}`;
  const isMarketplaceReady = !!marketplaceAddress && marketplaceAddress !== ZERO;

  const { data: nextListingId, refetch: refetchCount } = useReadContract({
    address: marketplaceAddress,
    abi: MARKETPLACE_ABI,
    functionName: "nextListingId",
    chainId,
    query: {
      enabled: isMarketplaceReady,
    },
  });

  const createListing = async (
    collection: string,
    tokenId: bigint,
    price: bigint,
    paymentToken: string
  ) => {
    if (!isMarketplaceReady) throw new Error("Marketplace not deployed");
    writeContract({
      address: marketplaceAddress,
      abi: MARKETPLACE_ABI,
      functionName: "listNFT",
      args: [collection as `0x${string}`, tokenId, price, paymentToken as `0x${string}`],
    });
  };

  // Buy with native BTC (single tx, attach msg.value) — returns tx hash
  const buyListing = async (listingId: number, price: bigint, isNativePayment: boolean): Promise<`0x${string}`> => {
    if (!isMarketplaceReady) throw new Error("Marketplace not deployed");
    return writeContractAsync({
      address: marketplaceAddress,
      abi: MARKETPLACE_ABI,
      functionName: "buyNFT",
      args: [BigInt(listingId)],
      value: isNativePayment ? price : 0n,
    });
  };

  // Step 1 of ERC-20 buy: approve the PaymentRouter — returns tx hash
  const approveTokenForBuy = async (tokenAddress: string, amount: bigint): Promise<`0x${string}`> => {
    const routerAddress = contracts.router as `0x${string}`;
    if (!routerAddress || routerAddress === "0x0000000000000000000000000000000000000000")
      throw new Error("Router not deployed");
    return writeContractAsync({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [routerAddress, amount],
    });
  };

  // Step 2 of ERC-20 buy: call buyNFT after approval is confirmed — returns tx hash
  const executeBuy = async (listingId: number): Promise<`0x${string}`> => {
    if (!isMarketplaceReady) throw new Error("Marketplace not deployed");
    return writeContractAsync({
      address: marketplaceAddress,
      abi: MARKETPLACE_ABI,
      functionName: "buyNFT",
      args: [BigInt(listingId)],
      value: 0n,
    });
  };

  const cancelListing = async (listingId: number) => {
    if (!isMarketplaceReady) throw new Error("Marketplace not deployed");
    writeContract({
      address: marketplaceAddress,
      abi: MARKETPLACE_ABI,
      functionName: "cancelListing",
      args: [BigInt(listingId)],
    });
  };

  const approveNFT = async (collection: string, tokenId: bigint) => {
    if (!isMarketplaceReady) throw new Error("Marketplace not deployed");
    writeContract({
      address: collection as `0x${string}`,
      abi: ERC721_ABI,
      functionName: "approve",
      args: [marketplaceAddress, tokenId],
    });
  };

  const approveToken = async (tokenAddress: string, amount: bigint) => {
    const routerAddress = contracts.router as `0x${string}`;
    if (!routerAddress || routerAddress === "0x0000000000000000000000000000000000000000")
      throw new Error("Router not deployed");
    writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [routerAddress, amount],
    });
  };

  const { data: userListingIds, refetch: refetchUserListings } = useReadContract({
    address: marketplaceAddress,
    abi: MARKETPLACE_ABI,
    functionName: "getUserListings",
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: isMarketplaceReady && !!address,
    },
  });

  return {
    marketplaceAddress,
    adapterAddress,
    nextListingId: nextListingId ? Number(nextListingId) : 0,
    userListingIds: userListingIds as bigint[] | undefined,
    createListing,
    buyListing,
    approveTokenForBuy,
    executeBuy,
    cancelListing,
    approveNFT,
    approveToken,
    refetchCount,
    refetchUserListings,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

// ─── useListing ───────────────────────────────────────────────────────────────

export function useListing(listingId: number) {
  const { contracts, chainId } = useNetwork();

  const ZERO = "0x0000000000000000000000000000000000000000";
  const marketplaceAddress = contracts.marketplace as `0x${string}`;
  const adapterAddress = contracts.adapter as `0x${string}`;
  const isMarketplaceReady = !!marketplaceAddress && marketplaceAddress !== ZERO;
  const isAdapterReady = !!adapterAddress && adapterAddress !== ZERO;

  const { data: listingData, isLoading } = useReadContract({
    address: marketplaceAddress,
    abi: MARKETPLACE_ABI,
    functionName: "listings",
    args: [BigInt(listingId)],
    chainId,
    query: {
      enabled: isMarketplaceReady,
      // Re-fetch on every mount so post-purchase the sold listing is marked inactive
      staleTime: 0,
    },
  });

  const listingArray = listingData as any[] | undefined;
  const listing: ListingTuple | undefined = listingArray
    ? {
        seller: listingArray[0],
        collection: listingArray[1],
        tokenId: listingArray[2],
        price: listingArray[3],
        paymentToken: listingArray[4],
        createdAt: listingArray[5],
        active: listingArray[6],
      }
    : undefined;

  const collection = listing?.collection;
  const tokenId = listing?.tokenId;

  // Cross-check: verify seller still owns the NFT. If they transferred it out without
  // cancelling the listing (possible in escrowless design), the listing is stale.
  // We only run this check when the listing reports active=true to save RPC calls.
  const { data: currentOwner } = useReadContract({
    address: collection as `0x${string}`,
    abi: ERC721_ABI,
    functionName: "ownerOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    chainId,
    query: {
      enabled: isMarketplaceReady && !!collection && tokenId !== undefined && listing?.active === true,
      staleTime: 0,
    },
  });

  // getIntrinsicValue returns (amount, lockEnd) — works correctly on deployed contracts
  const { data: adapterData } = useReadContract({
    address: adapterAddress,
    abi: ADAPTER_ABI,
    functionName: "getIntrinsicValue",
    args: collection && tokenId !== undefined ? [collection, tokenId] : undefined,
    chainId,
    query: {
      enabled: isAdapterReady && !!collection && tokenId !== undefined,
    },
  });

  // ── Grant NFT detection ────────────────────────────────────────────────────
  // A veNFT is a Grant NFT if grantManager[tokenId] != address(0) AND vestingEnd[tokenId] != 0.
  // Grant NFTs cannot be merged or split but CAN be listed and purchased.
  const { data: grantManagerAddr } = useReadContract({
    address: collection as `0x${string}`,
    abi: GRANT_NFT_ABI,
    functionName: "grantManager",
    args: tokenId !== undefined ? [tokenId] : undefined,
    chainId,
    query: { enabled: !!collection && tokenId !== undefined },
  });

  const { data: vestingEndVal } = useReadContract({
    address: collection as `0x${string}`,
    abi: GRANT_NFT_ABI,
    functionName: "vestingEnd",
    args: tokenId !== undefined ? [tokenId] : undefined,
    chainId,
    query: { enabled: !!collection && tokenId !== undefined },
  });

  const [intrinsicValue, lockEnd] = (adapterData as [bigint, bigint] | undefined) ?? [0n, 0n];

  // Derive Grant flag — defaults to false while data is loading (no UI flicker)
  const grantMgr = (grantManagerAddr as string | undefined) ?? ZERO_ADDRESS;
  const vestingEndTs = (vestingEndVal as bigint | undefined) ?? 0n;
  const isGrant = grantMgr.toLowerCase() !== ZERO_ADDRESS && vestingEndTs !== 0n;

  if (!listing) return { listing: null, isLoading };

  const price = listing.price;
  const iv = intrinsicValue ?? 0n;
  const isVeBTC = collection?.toLowerCase() === contracts.veBTC.toLowerCase();

  // Locked token address: veBTC locks BTC, veMEZO locks MEZO
  const BTC_TOKEN_ADDR  = "0x7b7c000000000000000000000000000000000000";
  const MEZO_TOKEN_ADDR = "0x7b7c000000000000000000000000000000000001";
  const nftLockedTokenAddr = isVeBTC ? BTC_TOKEN_ADDR : MEZO_TOKEN_ADDR;

  // Only same-token listings get a discount percentage. Cross-token listings
  // intentionally render "unknown" instead of a guessed percentage.
  const discountBps = computeDiscountBps(
    iv,
    nftLockedTokenAddr,
    price,
    listing.paymentToken,
  );

  // Compute voting power from locked() data — avoids calling balanceOfNFT which
  // does not exist on the deployed Velodrome v2 veBTC/veMEZO contracts
  const votingPower = computeVotingPower(iv, lockEnd, isVeBTC ?? true);

  // A listing is only truly active if:
  //   1. The contract marks it active, AND
  //   2. The seller still owns the NFT (ownerOf cross-check)
  // If currentOwner is not yet loaded we default to contract's active flag to
  // avoid a flash of "inactive" while the RPC call is in-flight.
  const sellerStillOwns =
    currentOwner == null || // not yet loaded — optimistically trust contract
    (currentOwner as string).toLowerCase() === listing.seller.toLowerCase();
  const isActive = listing.active && sellerStillOwns;

  const fullListing: Listing = {
    listingId,
    seller: listing.seller,
    nftContract: listing.collection,
    collection: isVeBTC ? "veBTC" : "veMEZO",
    tokenId: listing.tokenId,
    price: listing.price,
    paymentToken: listing.paymentToken,
    active: isActive,
    createdAt: listing.createdAt,
    intrinsicValue: iv,
    votingPower,
    lockEnd,
    discountBps,
    isGrant,
  };

  return { listing: fullListing, isLoading };
}

// ─── useUserVeNFTs ────────────────────────────────────────────────────────────
// Enumerates the connected wallet's veBTC and veMEZO positions.
//
// The deployed contracts are Velodrome v2 forks and do NOT have tokensOfOwner().
// Enumeration uses: balanceOf(address) → count, then ownerToNFTokenIdList(address,i)
// for each index. We cap at 50 tokens per collection to bound multicall size.

const MAX_TOKENS_PER_COLLECTION = 50;

export function useUserVeNFTs() {
  const { address } = useAccount();
  const { contracts, chainId } = useNetwork();

  const ZERO = "0x0000000000000000000000000000000000000000";
  const veBTCAddress   = contracts.veBTC   as `0x${string}`;
  const veMEZOAddress  = contracts.veMEZO  as `0x${string}`;
  const adapterAddress = contracts.adapter as `0x${string}`;
  const isAdapterDeployed = !!adapterAddress && adapterAddress !== ZERO;

  // Step 1: get token counts via ERC-721 balanceOf
  // Explicitly pass chainId so reads always target the correct network regardless
  // of which chain the wallet is currently connected to.
  const { data: veBTCCount, isLoading: veBTCCountLoading } = useReadContract({
    address: veBTCAddress,
    abi: VOTING_ESCROW_ENUM_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address },
  });

  const { data: veMEZOCount, isLoading: veMEZOCountLoading } = useReadContract({
    address: veMEZOAddress,
    abi: VOTING_ESCROW_ENUM_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address },
  });

  const veBTCCountNum  = Math.min(Number(veBTCCount  ?? 0n), MAX_TOKENS_PER_COLLECTION);
  const veMEZOCountNum = Math.min(Number(veMEZOCount ?? 0n), MAX_TOKENS_PER_COLLECTION);

  // Step 2: fetch each tokenId via ownerToNFTokenIdList(address, index)
  const enumCalls = [
    ...Array.from({ length: veBTCCountNum }, (_, i) => ({
      address: veBTCAddress,
      abi: VOTING_ESCROW_ENUM_ABI,
      functionName: "ownerToNFTokenIdList" as const,
      args: [address!, BigInt(i)] as const,
      chainId,
    })),
    ...Array.from({ length: veMEZOCountNum }, (_, i) => ({
      address: veMEZOAddress,
      abi: VOTING_ESCROW_ENUM_ABI,
      functionName: "ownerToNFTokenIdList" as const,
      args: [address!, BigInt(i)] as const,
      chainId,
    })),
  ];

  const { data: enumResults, isLoading: enumLoading } = useReadContracts({
    contracts: enumCalls,
    query: { enabled: !!address && (veBTCCountNum + veMEZOCountNum) > 0 },
  });

  // Build token pairs from enumeration results
  const tokenPairs: { collection: "veBTC" | "veMEZO"; nftContract: `0x${string}`; tokenId: bigint }[] = [];

  if (enumResults) {
    for (let i = 0; i < veBTCCountNum; i++) {
      const tid = enumResults[i]?.result as bigint | undefined;
      if (tid != null && tid > 0n) {
        tokenPairs.push({ collection: "veBTC", nftContract: veBTCAddress, tokenId: tid });
      }
    }
    for (let i = 0; i < veMEZOCountNum; i++) {
      const tid = enumResults[veBTCCountNum + i]?.result as bigint | undefined;
      if (tid != null && tid > 0n) {
        tokenPairs.push({ collection: "veMEZO", nftContract: veMEZOAddress, tokenId: tid });
      }
    }
  }

  // Step 3: fetch intrinsicValue + lockEnd for each token via adapter.getIntrinsicValue
  // (getVotingPower is intentionally skipped — it reverts on deployed contracts)
  const intrinsicCalls = tokenPairs.map((pair) => ({
    address: adapterAddress,
    abi: ADAPTER_ABI,
    functionName: "getIntrinsicValue" as const,
    args: [pair.nftContract, pair.tokenId] as const,
    chainId,
  }));

  const { data: intrinsicResults, isLoading: intrinsicLoading } = useReadContracts({
    contracts: intrinsicCalls,
    query: { enabled: isAdapterDeployed && tokenPairs.length > 0 },
  });

  // Step 4: Grant NFT detection — batch-read grantManager and vestingEnd for every token.
  // If either call reverts (contract doesn't implement the function) the result is ignored
  // and isGrant defaults to false — safe fallback with no UI impact.
  const grantManagerCalls = tokenPairs.map((pair) => ({
    address: pair.nftContract,
    abi: GRANT_NFT_ABI,
    functionName: "grantManager" as const,
    args: [pair.tokenId] as const,
    chainId,
  }));
  const vestingEndCalls = tokenPairs.map((pair) => ({
    address: pair.nftContract,
    abi: GRANT_NFT_ABI,
    functionName: "vestingEnd" as const,
    args: [pair.tokenId] as const,
    chainId,
  }));

  const { data: grantManagerResults } = useReadContracts({
    contracts: grantManagerCalls,
    query: { enabled: tokenPairs.length > 0 },
  });
  const { data: vestingEndResults } = useReadContracts({
    contracts: vestingEndCalls,
    query: { enabled: tokenPairs.length > 0 },
  });

  const isLoading = veBTCCountLoading || veMEZOCountLoading || enumLoading || intrinsicLoading;

  const veNFTs: WalletVeNFT[] = tokenPairs.map((pair, i) => {
    const raw = intrinsicResults?.[i]?.result as [bigint, bigint] | undefined;
    const [intrinsicValue, lockEnd] = raw ?? [0n, 0n];
    const isVeBTC = pair.collection === "veBTC";
    const votingPower = computeVotingPower(intrinsicValue, lockEnd, isVeBTC);

    const grantMgr  = (grantManagerResults?.[i]?.result as string | undefined) ?? ZERO_ADDRESS;
    const vestingTs = (vestingEndResults?.[i]?.result  as bigint | undefined) ?? 0n;
    const isGrant   = grantMgr.toLowerCase() !== ZERO_ADDRESS && vestingTs !== 0n;

    return {
      tokenId: pair.tokenId,
      collection: pair.collection,
      nftContract: pair.nftContract,
      intrinsicValue,
      votingPower,
      lockEnd,
      isGrant,
    };
  });

  return {
    veNFTs,
    isLoading,
    veBTCCount: veBTCCountNum,
    veMEZOCount: veMEZOCountNum,
    totalVeNFTs: tokenPairs.length,
  };
}
