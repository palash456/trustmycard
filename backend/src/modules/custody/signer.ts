import { ethers } from "ethers";
import { TronWeb } from "tronweb";

export interface CollectionSigner {
  evmWallet(provider: ethers.providers.Provider): Promise<ethers.Wallet>;
  tronSigner(): Promise<{ tron: TronWeb; address: string; privateKey: string }>;
}

export const COLLECTION_SIGNER = Symbol("COLLECTION_SIGNER");
