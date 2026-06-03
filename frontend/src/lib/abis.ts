// Contract ABIs for Mezo veNFT Marketplace

export const VeNFTMarketplaceABI = [
  {
    inputs: [
      { internalType: "address", name: "collection", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
      { internalType: "uint256", name: "price", type: "uint256" },
      { internalType: "address", name: "paymentToken", type: "address" },
    ],
    name: "listNFT",
    outputs: [{ internalType: "uint256", name: "listingId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "listingId", type: "uint256" }],
    name: "buyNFT",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "listingId", type: "uint256" }],
    name: "cancelListing",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "listingId", type: "uint256" },
      { internalType: "uint256", name: "newPrice", type: "uint256" },
    ],
    name: "updatePrice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "listingId", type: "uint256" }],
    name: "getListingWithValue",
    outputs: [
      {
        components: [
          { internalType: "address", name: "seller", type: "address" },
          { internalType: "address", name: "collection", type: "address" },
          { internalType: "uint256", name: "tokenId", type: "uint256" },
          { internalType: "uint256", name: "price", type: "uint256" },
          { internalType: "address", name: "paymentToken", type: "address" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "bool", name: "active", type: "bool" },
        ],
        internalType: "struct VeNFTMarketplace.Listing",
        name: "listing",
        type: "tuple",
      },
      { internalType: "uint256", name: "intrinsicValue", type: "uint256" },
      { internalType: "uint256", name: "lockEnd", type: "uint256" },
      { internalType: "uint256", name: "votingPower", type: "uint256" },
      { internalType: "uint256", name: "discountBps", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "collection", type: "address" },
      { internalType: "uint256", name: "offset", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "getActiveListings",
    outputs: [
      {
        components: [
          { internalType: "address", name: "seller", type: "address" },
          { internalType: "address", name: "collection", type: "address" },
          { internalType: "uint256", name: "tokenId", type: "uint256" },
          { internalType: "uint256", name: "price", type: "uint256" },
          { internalType: "address", name: "paymentToken", type: "address" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "bool", name: "active", type: "bool" },
        ],
        internalType: "struct VeNFTMarketplace.Listing[]",
        name: "result",
        type: "tuple[]",
      },
      { internalType: "uint256", name: "total", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "listings",
    outputs: [
      { internalType: "address", name: "seller", type: "address" },
      { internalType: "address", name: "collection", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
      { internalType: "uint256", name: "price", type: "uint256" },
      { internalType: "address", name: "paymentToken", type: "address" },
      { internalType: "uint256", name: "createdAt", type: "uint256" },
      { internalType: "bool", name: "active", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextListingId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "collection", type: "address" },
      { internalType: "address", name: "paymentToken", type: "address" },
    ],
    name: "getFloorPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "listingId", type: "uint256" },
      { indexed: true, internalType: "address", name: "seller", type: "address" },
      { indexed: true, internalType: "address", name: "collection", type: "address" },
      { indexed: false, internalType: "uint256", name: "tokenId", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "price", type: "uint256" },
      { indexed: false, internalType: "address", name: "paymentToken", type: "address" },
    ],
    name: "Listed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "listingId", type: "uint256" },
      { indexed: true, internalType: "address", name: "buyer", type: "address" },
      { indexed: true, internalType: "address", name: "seller", type: "address" },
      { indexed: false, internalType: "uint256", name: "price", type: "uint256" },
    ],
    name: "Purchased",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "uint256", name: "listingId", type: "uint256" }],
    name: "Cancelled",
    type: "event",
  },
] as const;

export const MezoVeNFTAdapterABI = [
  {
    inputs: [
      { internalType: "address", name: "collection", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
    ],
    name: "getIntrinsicValue",
    outputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "lockEnd", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "collection", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
    ],
    name: "getVotingPower",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "collection", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
    ],
    name: "isExpired",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "listPrice", type: "uint256" },
      { internalType: "uint256", name: "intrinsicValue", type: "uint256" },
    ],
    name: "calculateDiscount",
    outputs: [{ internalType: "uint256", name: "discountBps", type: "uint256" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "collection", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
    ],
    name: "getTimeRemaining",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "collection", type: "address" }],
    name: "isSupported",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const ERC721ABI = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "getApproved",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "operator", type: "address" },
    ],
    name: "isApprovedForAll",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ── SwapPaymentRouter ABI ─────────────────────────────────────────────────────
export const SwapPaymentRouterABI = [
  { inputs: [{ name: "listingId", type: "uint256" }, { name: "buyToken", type: "address" }, { name: "maxAmountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "maxSlippageBps", type: "uint256" }], name: "swapAndBuy", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [], name: "platformFeeSwapBps", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "dexRouter", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { anonymous: false, inputs: [{ indexed: true, name: "listingId", type: "uint256" }, { indexed: true, name: "buyer", type: "address" }, { indexed: false, name: "payToken", type: "address" }, { indexed: false, name: "amountIn", type: "uint256" }, { indexed: false, name: "quoteToken", type: "address" }, { indexed: false, name: "amountOut", type: "uint256" }, { indexed: false, name: "swapFee", type: "uint256" }], name: "SwapAndPurchase", type: "event" },
] as const;

// ── BidRegistry ABI ───────────────────────────────────────────────────────────
export const BidRegistryABI = [
  { inputs: [{ name: "collection", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "bidToken", type: "address" }, { name: "bidAmount", type: "uint256" }, { name: "duration", type: "uint256" }], name: "placeBid", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "collection", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "bidIndex", type: "uint256" }], name: "cancelBid", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "collection", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "bidIndex", type: "uint256" }], name: "acceptBid", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "collection", type: "address" }, { name: "tokenId", type: "uint256" }], name: "getBidsForToken", outputs: [{ components: [{ name: "bidder", type: "address" }, { name: "bidToken", type: "address" }, { name: "bidAmount", type: "uint256" }, { name: "expiry", type: "uint256" }, { name: "active", type: "bool" }], name: "", type: "tuple[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "collection", type: "address" }, { name: "tokenId", type: "uint256" }], name: "activeBidCount", outputs: [{ name: "count", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "platformFeeBidBps", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { anonymous: false, inputs: [{ indexed: true, name: "collection", type: "address" }, { indexed: true, name: "tokenId", type: "uint256" }, { indexed: true, name: "bidIndex", type: "uint256" }, { indexed: false, name: "bidder", type: "address" }, { indexed: false, name: "bidToken", type: "address" }, { indexed: false, name: "bidAmount", type: "uint256" }, { indexed: false, name: "expiry", type: "uint256" }], name: "BidPlaced", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "collection", type: "address" }, { indexed: true, name: "tokenId", type: "uint256" }, { indexed: true, name: "bidIndex", type: "uint256" }, { indexed: false, name: "bidder", type: "address" }], name: "BidCancelled", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "collection", type: "address" }, { indexed: true, name: "tokenId", type: "uint256" }, { indexed: true, name: "bidIndex", type: "uint256" }, { indexed: false, name: "bidder", type: "address" }, { indexed: false, name: "seller", type: "address" }, { indexed: false, name: "bidToken", type: "address" }, { indexed: false, name: "bidAmount", type: "uint256" }, { indexed: false, name: "fee", type: "uint256" }], name: "BidAccepted", type: "event" },
] as const;
