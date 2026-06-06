import { NextRequest, NextResponse } from "next/server";

// Server-side listings fetcher — reads all active listings directly from the
// Mezo RPC (no browser CORS restriction) and returns them as JSON.
// This bypasses wagmi's Multicall3 path which can silently fail if the
// transport or ABI encoding has edge-case issues.

const RPC: Record<string, string> = {
  mainnet: process.env.RPC_MAINNET || "https://mainnet.mezo.public.validationcloud.io",
  testnet: process.env.RPC_TESTNET || "https://rpc.test.mezo.org",
};

const MARKETPLACE: Record<string, string> = {
  mainnet: process.env.NEXT_PUBLIC_MARKETPLACE_MAINNET || "0x293ba099c5Cf32af54013F00fEe8D2EA1cad8570",
  testnet: process.env.NEXT_PUBLIC_MARKETPLACE_TESTNET || "0xF18016FbadfA732c58814b6341054484FcDBF26f",
};

const VEMEZO: Record<string, string> = {
  mainnet: "0xb90fdAd3DFD180458D62Cc6acedc983D78E20122",
  testnet: "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b",
};

const VEBTC: Record<string, string> = {
  mainnet: "0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279",
  testnet: "0x38E35d92E6Bfc6787272A62345856B13eA12130a",
};

async function ethCall(rpc: string, to: string, data: string) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to, data }, "latest"],
      id: 1,
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result as string;
}

function decodeUint256(hex: string): bigint {
  return BigInt(hex);
}

function decodeAddress(slot: string): string {
  // last 20 bytes (40 hex chars) of a 32-byte slot
  return "0x" + slot.slice(-40);
}

function parseListing(raw: string, slotIndex: number) {
  // strip 0x, each field is 64 hex chars (32 bytes)
  const r = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (r.length < 448) return null;

  const seller     = decodeAddress(r.slice(0, 64));
  const collection = decodeAddress(r.slice(64, 128));
  const tokenId    = parseInt(r.slice(128, 192), 16);
  const price      = BigInt("0x" + r.slice(192, 256)).toString();
  const paymentToken = decodeAddress(r.slice(256, 320));
  const createdAt  = parseInt(r.slice(320, 384), 16);
  const active     = parseInt(r.slice(384, 448), 16) === 1;

  return { slot: slotIndex, seller, collection, tokenId, price, paymentToken, createdAt, active };
}

export async function GET(req: NextRequest) {
  const network = req.nextUrl.searchParams.get("network") === "testnet" ? "testnet" : "mainnet";
  const rpc = RPC[network];
  const marketplace = MARKETPLACE[network];
  const veMEZO = VEMEZO[network].toLowerCase();
  const veBTC  = VEBTC[network].toLowerCase();

  try {
    // 1. Get nextListingId
    const nextIdHex = await ethCall(rpc, marketplace, "0xaaccf1ec");
    const total = Number(decodeUint256(nextIdHex));

    // 2. Fetch all listing slots in parallel (batched 50 at a time)
    const BATCH = 50;
    const allSlots = Array.from({ length: total }, (_, i) => i);
    const results: ReturnType<typeof parseListing>[] = [];

    for (let b = 0; b < allSlots.length; b += BATCH) {
      const batch = allSlots.slice(b, b + BATCH);
      const fetched = await Promise.all(
        batch.map(async (i) => {
          const arg = i.toString(16).padStart(64, "0");
          try {
            const raw = await ethCall(rpc, marketplace, "0xde74e57b" + arg);
            return parseListing(raw, i);
          } catch {
            return null;
          }
        })
      );
      results.push(...fetched);
    }

    // 3. Filter: active + known collection
    const active = results.filter(
      (l) => l && l.active && (l.collection.toLowerCase() === veMEZO || l.collection.toLowerCase() === veBTC)
    );

    return NextResponse.json(
      { total, activeCount: active.length, listings: active, network },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
