# Vezo Subgraph (Goldsky)

Indexes the Vezo marketplace so the frontend can list active listings and the
activity feed **without scanning every listing slot over RPC** (the root cause of
the slow loads / inconsistent count). Same pattern Goldsky-on-Mezo apps use.

Indexed entities (see `schema.graphql`):
- **Listing** — one per `listingId`, with `active` flipped to false on cancel/sale.
- **Bid** — one per `bidId`, `active` flipped on cancel/accept.
- **ActivityEvent** — append-only log powering the Activity feed.

## Deploy

Prereqs: a [Goldsky](https://goldsky.com) account + CLI (`npm i -g @goldskycom/cli`),
and the Graph CLI is pulled in via `npm install` here.

```bash
cd subgraph
npm install

# 1. Set the right values in subgraph.yaml FIRST:
#    - network: the Goldsky slug for Mezo mainnet (confirm in the Goldsky dashboard)
#    - VeNFTMarketplace startBlock = the marketplace's deploy block
#    - VeNFTBidding address  = the REDEPLOYED bidding address (the fixed one) + its startBlock
#    Setting startBlock avoids syncing from genesis (much faster).

npm run codegen      # generate AssemblyScript types from the ABIs + schema
npm run build        # compile the mappings to wasm

goldsky login
npm run deploy       # deploys vezo-marketplace/1.0.0 to Goldsky
```

Goldsky returns a **GraphQL query URL**. Put it in the frontend env:

```
# frontend/.env.local  (and Vercel env)
NEXT_PUBLIC_SUBGRAPH_URL=https://api.goldsky.com/api/public/<project>/subgraphs/vezo-marketplace/1.0.0/gn
SUBGRAPH_URL=<same url>   # server-side, used by /api/listings
```

The frontend auto-detects these: when set, `/api/listings` and the activity feed
read from the subgraph (fast, consistent); when unset, they fall back to the
current on-chain method. So nothing breaks before the subgraph is live.

## Finding the marketplace deploy block
Use the explorer (https://explorer.mezo.org) → the marketplace address → its
contract-creation transaction → block number. Set that as `startBlock`.

## Notes
- After you **redeploy VeNFTBidding** (the acceptBid fix), update its address +
  startBlock in `subgraph.yaml` and re-deploy the subgraph.
- The subgraph stores listing fields from events; the frontend still reads
  `ownerOf` + `getIntrinsicValue` live per listing (those change over time), so
  stale/burned positions are still filtered exactly as today — just without the
  194-slot scan to find them.
