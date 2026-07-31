import { BadRequestException, Injectable } from "@nestjs/common";
import { ethers } from "ethers";
import { TronWeb } from "tronweb";
import { COLLECTION_SIGNER, type CollectionSigner } from "./signer";

@Injectable()
export class EnvCollectionSignerService implements CollectionSigner {
  async evmWallet(provider: ethers.providers.Provider): Promise<ethers.Wallet> {
    const privateKey = (process.env.ADMIN_EVM_PRIVATE_KEY ?? "").trim();
    if (!privateKey) throw new BadRequestException("EVM collection signer is not configured");
    return new ethers.Wallet(privateKey, provider);
  }

  async tronSigner(): Promise<{ tron: TronWeb; address: string; privateKey: string }> {
    const privateKey = (process.env.ADMIN_TRON_PRIVATE_KEY ?? "").trim();
    if (!privateKey) throw new BadRequestException("TRON collection signer is not configured");
    const tron = new TronWeb({
      fullHost: process.env.TRON_FULL_HOST ?? "https://api.trongrid.io",
      privateKey,
    });
    const address = tron.address.fromPrivateKey(privateKey);
    if (!address) throw new BadRequestException("TRON collection signer key is invalid");
    return { tron, address, privateKey };
  }
}

export const collectionSignerProvider = {
  provide: COLLECTION_SIGNER,
  useExisting: EnvCollectionSignerService,
};
