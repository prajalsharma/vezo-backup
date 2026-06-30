import { ethereum } from "@graphprotocol/graph-ts";
import {
  BidCreated,
  BidCancelled,
  BidAccepted,
} from "../generated/VeNFTBidding/VeNFTBidding";
import { Bid, ActivityEvent } from "../generated/schema";

function activityId(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
}

export function handleBidCreated(event: BidCreated): void {
  const id = event.params.bidId.toString();
  const b = new Bid(id);
  b.bidId = event.params.bidId;
  b.bidder = event.params.bidder;
  b.collection = event.params.collection;
  b.tokenId = event.params.tokenId;
  b.paymentToken = event.params.paymentToken;
  b.amount = event.params.amount;
  b.expiry = event.params.expiry;
  b.active = true;
  b.accepted = false;
  b.cancelled = false;
  b.createdAt = event.block.timestamp;
  b.save();

  const a = new ActivityEvent(activityId(event));
  a.type = "bid";
  a.bidId = event.params.bidId;
  a.collection = event.params.collection;
  a.tokenId = event.params.tokenId;
  a.price = event.params.amount;
  a.paymentToken = event.params.paymentToken;
  a.from = event.params.bidder;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.save();
}

export function handleBidCancelled(event: BidCancelled): void {
  const id = event.params.bidId.toString();
  const b = Bid.load(id);
  if (b != null) {
    b.active = false;
    b.cancelled = true;
    b.save();
  }

  const a = new ActivityEvent(activityId(event));
  a.type = "bidCancelled";
  a.bidId = event.params.bidId;
  if (b != null) {
    a.collection = b.collection;
    a.tokenId = b.tokenId;
  }
  a.from = event.params.bidder;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.save();
}

export function handleBidAccepted(event: BidAccepted): void {
  const id = event.params.bidId.toString();
  const b = Bid.load(id);
  if (b != null) {
    b.active = false;
    b.accepted = true;
    b.save();
  }

  const a = new ActivityEvent(activityId(event));
  a.type = "bidAccepted";
  a.bidId = event.params.bidId;
  a.collection = event.params.collection;
  a.tokenId = event.params.tokenId;
  a.price = event.params.amount;
  a.from = event.params.seller;
  a.to = event.params.bidder;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.save();
}
