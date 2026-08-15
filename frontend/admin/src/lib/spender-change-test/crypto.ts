import { Wallet } from "ethers";
import { TronWeb } from "tronweb";

export function deriveEvmAddress(privateKey: string): string | null {
  const key = privateKey.trim();
  if (!key) return null;
  try {
    return new Wallet(key).address;
  } catch {
    return null;
  }
}

export function deriveTronAddress(privateKey: string): string | null {
  const key = privateKey.trim();
  if (!key) return null;
  try {
    const tron = new TronWeb({
      fullHost: "https://api.trongrid.io",
      privateKey: key,
    });
    const address = tron.address.fromPrivateKey(key);
    return typeof address === "string" ? address : null;
  } catch {
    return null;
  }
}
