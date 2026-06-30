import { ethereum } from "@graphprotocol/graph-ts";
import {
  Listed,
  Cancelled,
  Purchased,
  PriceUpdated,
} from "../generated/VeNFTMarketplace/VeNFTMarketplace";
import { Listing, ActivityEvent } from "../generated/schema";

function activityId(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
}

export function handleListed(event: Listed): void {
  const id = event.params.listingId.toString();
  const l = new Listing(id);
  l.listingId = event.params.listingId;
  l.seller = event.params.seller;
  l.collection = event.params.collection;
  l.tokenId = event.params.tokenId;
  l.price = event.params.price;
  l.paymentToken = event.params.paymentToken;
  l.active = true;
  l.cancelled = false;
  l.sold = false;
  l.createdAt = event.block.timestamp;
  l.createdAtBlock = event.block.number;
  l.updatedAt = event.block.timestamp;
  l.save();

  const a = new ActivityEvent(activityId(event));
  a.type = "listed";
  a.listingId = event.params.listingId;
  a.collection = event.params.collection;
  a.tokenId = event.params.tokenId;
  a.price = event.params.price;
  a.paymentToken = event.params.paymentToken;
  a.from = event.params.seller;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.save();
}

export function handleCancelled(event: Cancelled): void {
  const id = event.params.listingId.toString();
  const l = Listing.load(id);
  if (l != null) {
    l.active = false;
    l.cancelled = true;
    l.updatedAt = event.block.timestamp;
    l.save();
  }

  const a = new ActivityEvent(activityId(event));
  a.type = "cancelled";
  a.listingId = event.params.listingId;
  if (l != null) {
    a.collection = l.collection;
    a.tokenId = l.tokenId;
    a.from = l.seller;
  }
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.save();
}

export function handlePurchased(event: Purchased): void {
  const id = event.params.listingId.toString();
  const l = Listing.load(id);
  if (l != null) {
    l.active = false;
    l.sold = true;
    l.buyer = event.params.buyer;
    l.updatedAt = event.block.timestamp;
    l.save();
  }

  const a = new ActivityEvent(activityId(event));
  a.type = "sale";
  a.listingId = event.params.listingId;
  a.price = event.params.price;
  if (l != null) {
    a.collection = l.collection;
    a.tokenId = l.tokenId;
    a.paymentToken = l.paymentToken;
  }
  a.from = event.params.seller;
  a.to = event.params.buyer;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.save();
}

export function handlePriceUpdated(event: PriceUpdated): void {
  const id = event.params.listingId.toString();
  const l = Listing.load(id);
  if (l != null) {
    l.price = event.params.newPrice;
    l.updatedAt = event.block.timestamp;
    l.save();
  }
}
