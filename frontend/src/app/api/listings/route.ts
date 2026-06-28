import { NextRequest, NextResponse } from "next/server";
import { computeDiscountBps } from "@/lib/computeDiscount";

// Authoritative, fully-filtered active-listings endpoint.
//
// Why this exists: doing the listing scan + ownerOf/intrinsic-value filtering
// client-side across several dependent multicall batches produced an INCONSISTENT
// count on every reload (e.g. 0 → 16 → 5) because the grid rendered optimistic
// intermediate states before the ownerOf/intrinsic batches resolved, and the
// public RPC returns slightly different partial results per call.
//
// This route does the ENTIRE pipeline server-side in one deterministic pass —
// scan slots, drop inactive/unknown-collection, then drop stale (seller no longer
// owns / token burned) and empty (zero intrinsic value) positions — and returns
// the FINAL list. A short CDN cache makes every reload within the window return
// the identical snapshot, so the count is stable.

const RPC: Record<string, string> = {
  mainnet: process.env.RPC_MAINNET || "https://mainnet.mezo.public.validationcloud.io",
  testnet: process.env.RPC_TESTNET || "https://rpc.test.mezo.org",
};

const MARKETPLACE: Record<string, string> = {
  mainnet: process.env.NEXT_PUBLIC_MARKETPLACE_MAINNET || "0x293ba099c5Cf32af54013F00fEe8D2EA1cad8570",
  testnet: process.env.NEXT_PUBLIC_MARKETPLACE_TESTNET || "0xF18016FbadfA732c58814b6341054484FcDBF26f",
};
const ADAPTER: Record<string, string> = {
  mainnet: process.env.NEXT_PUBLIC_ADAPTER_MAINNET || "0x8EC595099030aB282511c87cAF104E734418Eff5",
  testnet: process.env.NEXT_PUBLIC_ADAPTER_TESTNET || "0x526A542F7B2809376391CD7f884Daf4967fFEb14",
};
const VEMEZO: Record<string, string> = {
  mainnet: "0xb90fdAd3DFD180458D62Cc6acedc983D78E20122",
  testnet: "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b",
};
const VEBTC: Record<string, string> = {
  mainnet: "0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279",
  testnet: "0x38E35d92E6Bfc6787272A62345856B13eA12130a",
};

const BTC_TOKEN = "0x7b7c000000000000000000000000000000000000";
const MEZO_TOKEN = "0x7b7c000000000000000000000000000000000001";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const VEBTC_MAXTIME = BigInt(28 * 24 * 60 * 60);
const VEMEZO_MAXTIME = BigInt(1456 * 24 * 60 * 60);

// ── low-level eth_call with retry; distinguishes a contract REVERT (returns
// `revert`) from a transport error (throws, so the caller can retry/fail) ──
async function ethCall(rpc: string, to: string, data: string, retries = 2): Promise<string | "revert"> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to, data }, "latest"], id: 1 }),
      });
      const json = await res.json();
      if (json.error) {
        // execution reverted = deterministic on-chain answer (e.g. ownerOf of a
        // burned token). Do NOT retry — it will always revert.
        const msg = String(json.error.message || "").toLowerCase();
        if (msg.includes("revert") || msg.includes("execution")) return "revert";
        throw new Error(json.error.message);
      }
      return json.result as string;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
  throw lastErr;
}

const decodeAddr = (slot: string) => "0x" + slot.slice(-40);
const toBig = (hex: string) => BigInt(hex.startsWith("0x") ? hex : "0x" + hex);

function parseListing(raw: string) {
  const r = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (r.length < 448) return null;
  return {
    seller: decodeAddr(r.slice(0, 64)),
    collection: decodeAddr(r.slice(64, 128)),
    tokenId: toBig(r.slice(128, 192)),
    price: toBig(r.slice(192, 256)),
    paymentToken: decodeAddr(r.slice(256, 320)),
    createdAt: toBig(r.slice(320, 384)),
    active: parseInt(r.slice(384, 448), 16) === 1,
  };
}

function computeVotingPower(amount: bigint, lockEnd: bigint, isVeBTC: boolean, nowSec: bigint): bigint {
  if (amount === 0n) return 0n;
  if (lockEnd === 0n) return amount; // permanent lock
  if (lockEnd <= nowSec) return 0n;
  const remaining = lockEnd - nowSec;
  const maxTime = isVeBTC ? VEBTC_MAXTIME : VEMEZO_MAXTIME;
  const capped = remaining > maxTime ? maxTime : remaining;
  return (amount * capped) / maxTime;
}

export async function GET(req: NextRequest) {
  const network = req.nextUrl.searchParams.get("network") === "testnet" ? "testnet" : "mainnet";
  const rpc = RPC[network];
  const marketplace = MARKETPLACE[network];
  const adapter = ADAPTER[network];
  const veMEZO = VEMEZO[network].toLowerCase();
  const veBTC = VEBTC[network].toLowerCase();
  const nowSec = BigInt(Math.floor(Date.now() / 1000));

  try {
    // 1. nextListingId — a transport failure here is fatal (client keeps prev data)
    const nextIdHex = await ethCall(rpc, marketplace, "0xaaccf1ec");
    if (nextIdHex === "revert") throw new Error("nextListingId reverted");
    const total = Number(toBig(nextIdHex));

    // 2. scan every slot (batched), keep active listings on a known collection
    const BATCH = 40;
    type Raw = NonNullable<ReturnType<typeof parseListing>> & { slot: number; collKey: "veBTC" | "veMEZO" };
    const rawActive: Raw[] = [];
    for (let b = 0; b < total; b += BATCH) {
      const batch = Array.from({ length: Math.min(BATCH, total - b) }, (_, k) => b + k);
      const parsed = await Promise.all(
        batch.map(async (i) => {
          const arg = i.toString(16).padStart(64, "0");
          const res = await ethCall(rpc, marketplace, "0xde74e57b" + arg);
          if (res === "revert") return null;
          const l = parseListing(res);
          return l ? { ...l, slot: i } : null;
        })
      );
      for (const l of parsed) {
        if (!l || !l.active) continue;
        const c = l.collection.toLowerCase();
        if (c === veBTC) rawActive.push({ ...l, collKey: "veBTC" });
        else if (c === veMEZO) rawActive.push({ ...l, collKey: "veMEZO" });
      }
    }

    // 3. enrich + filter each active listing: ownerOf (stale check) + intrinsic
    //    value (empty check) + grant flags. A listing survives only when the
    //    seller still owns it AND it has non-zero value — fully resolved here, so
    //    the client never sees an optimistic intermediate count.
    const enriched = await Promise.all(
      rawActive.map(async (l) => {
        const collection = l.collKey === "veBTC" ? VEBTC[network] : VEMEZO[network];
        const tokenArg = l.tokenId.toString(16).padStart(64, "0");
        const ivArg = collection.slice(2).toLowerCase().padStart(64, "0") + tokenArg;

        const [ownerRes, ivRes, grantRes, vestRes] = await Promise.all([
          ethCall(rpc, collection, "0x6352211e" + tokenArg).catch(() => "err" as const),
          ethCall(rpc, adapter, "0x67423c2b" + ivArg).catch(() => "err" as const),
          ethCall(rpc, collection, "0xb6fc5ba0" + tokenArg).catch(() => "err" as const),
          ethCall(rpc, collection, "0x2804ad0d" + tokenArg).catch(() => "err" as const),
        ]);

        // ownerOf reverted/zero/err or seller no longer owns → stale, drop it
        if (ownerRes === "revert" || ownerRes === "err") return null;
        const owner = decodeAddr(ownerRes.slice(2)).toLowerCase();
        if (owner === ZERO_ADDR || owner !== l.seller.toLowerCase()) return null;

        // intrinsic value — only trust a successful read; (0,0) = empty veNFT → drop
        let intrinsicValue = 0n;
        let lockEnd = 0n;
        let ivKnown = false;
        if (ivRes !== "revert" && ivRes !== "err" && ivRes.length >= 130) {
          intrinsicValue = toBig(ivRes.slice(2, 66));
          lockEnd = toBig(ivRes.slice(66, 130));
          ivKnown = true;
        }
        if (ivKnown && intrinsicValue === 0n && lockEnd === 0n) return null;

        const isVeBTC = l.collKey === "veBTC";
        const votingPower = computeVotingPower(intrinsicValue, lockEnd, isVeBTC, nowSec);
        const nftLockedToken = isVeBTC ? BTC_TOKEN : MEZO_TOKEN;
        const discountBps = computeDiscountBps(intrinsicValue, nftLockedToken, l.price, l.paymentToken, lockEnd);

        let isGrant = false;
        if (grantRes !== "revert" && grantRes !== "err" && vestRes !== "revert" && vestRes !== "err") {
          const grantMgr = decodeAddr(grantRes.slice(2)).toLowerCase();
          const vestingEnd = vestRes.length >= 66 ? toBig(vestRes.slice(0, 66)) : 0n;
          isGrant = grantMgr !== ZERO_ADDR && vestingEnd !== 0n;
        }

        return {
          listingId: l.slot,
          seller: l.seller,
          nftContract: collection,
          collection: l.collKey,
          tokenId: l.tokenId.toString(),
          price: l.price.toString(),
          paymentToken: l.paymentToken,
          active: true,
          createdAt: l.createdAt.toString(),
          intrinsicValue: intrinsicValue.toString(),
          votingPower: votingPower.toString(),
          lockEnd: lockEnd.toString(),
          discountBps: discountBps === null ? null : discountBps.toString(),
          isGrant,
        };
      })
    );

    const listings = enriched.filter(Boolean);
    // Stable order so the list never re-shuffles between reloads.
    listings.sort((a, b) => (a!.listingId - b!.listingId));

    return NextResponse.json(
      { total, activeCount: listings.length, listings, network },
      {
        headers: {
          // Identical snapshot for ~15s → consistent count across reloads, while
          // staying reasonably fresh; SWR serves instantly while revalidating.
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
