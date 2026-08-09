import { BadRequestException, Injectable } from "@nestjs/common";
import { ethers } from "ethers";
import { TronWeb } from "tronweb";
import type { CollectionSigner } from "./signer";

@Injectable()
export class DisabledCollectionSignerService implements CollectionSigner {
  async evmWallet(_provider: ethers.providers.Provider): Promise<ethers.Wallet> {
    throw new BadRequestException(
      "Collection signing is disabled on this process (set SERVICE_ROLE=all or worker with COLLECTION_SIGNING_ENABLED=true)"
    );
  }

  async tronSigner(): Promise<{ tron: TronWeb; address: string; privateKey: string }> {
    throw new BadRequestException(
      "Collection signing is disabled on this process (set SERVICE_ROLE=all or worker with COLLECTION_SIGNING_ENABLED=true)"
    );
  }
}
