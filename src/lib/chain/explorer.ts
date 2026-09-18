import { COOKIESCAN_BASE } from "./config";

export function txUrl(sig: string): string {
  return `${COOKIESCAN_BASE}/tx/${sig}`;
}

export function addressUrl(addr: string): string {
  return `${COOKIESCAN_BASE}/address/${addr}`;
}

export function tokenUrl(mint: string): string {
  return `${COOKIESCAN_BASE}/token/${mint}`;
}
