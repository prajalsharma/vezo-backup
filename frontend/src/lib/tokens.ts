const BTC_ADDRESS = "0x7b7c000000000000000000000000000000000000";
const MEZO_ADDRESS = "0x7b7c000000000000000000000000000000000001";

export function getPaymentTokenSymbol(tokenAddress: string): "BTC" | "MEZO" | "MUSD" {
  const token = tokenAddress.toLowerCase();
  if (token === BTC_ADDRESS) return "BTC";
  if (token === MEZO_ADDRESS) return "MEZO";
  return "MUSD";
}

