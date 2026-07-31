import { Module } from "@nestjs/common";
import {
  collectionSignerProvider,
  EnvCollectionSignerService,
} from "./env-collection-signer.service";
import { COLLECTION_SIGNER } from "./signer";

/**
 * Custody — key management, vault, signers, and spending policies.
 * Isolate and tightly permission everything in this module.
 */
@Module({
  providers: [EnvCollectionSignerService, collectionSignerProvider],
  exports: [COLLECTION_SIGNER],
})
export class CustodyModule {}
