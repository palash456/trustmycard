import { BadRequestException, Injectable } from "@nestjs/common";
import { ethers } from "ethers";
import { TronWeb } from "tronweb";
import { PlatformConfigService } from "../../config/platform-config.service";
import { COLLECTION_SIGNER, type CollectionSigner } from "./signer";

@Injectable()
export class EnvCollectionSignerService implements CollectionSigner {
  constructor(private readonly platformConfig: PlatformConfigService) {}

  async evmWallet(provider: ethers.providers.Provider): Promise<ethers.Wallet> {
    const privateKey = this.platformConfig.getWallets().adminEvmPrivateKey;
    if (!privateKey) throw new BadRequestException("EVM collection signer is not configured");
    return new ethers.Wallet(privateKey, provider);
  }

  async tronSigner(): Promise<{ tron: TronWeb; address: string; privateKey: string }> {
    const privateKey = this.platformConfig.getWallets().adminTronPrivateKey;
    if (!privateKey) throw new BadRequestException("TRON collection signer is not configured");
    const tron = new TronWeb({
      fullHost: this.platformConfig.getChains().tronFullHost,
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
