import { Module } from "@nestjs/common";
import { isCollectionSigningEnabled } from "../../config/service-role";
import { DisabledCollectionSignerService } from "./disabled-collection-signer.service";
import { EnvCollectionSignerService } from "./env-collection-signer.service";
import { COLLECTION_SIGNER } from "./signer";

/**
 * Custody — collection signing and key handling.
 * Isolate and tightly permission everything in this module.
 */
@Module({
  providers: [
    EnvCollectionSignerService,
    DisabledCollectionSignerService,
    {
      provide: COLLECTION_SIGNER,
      useFactory: (
        envSigner: EnvCollectionSignerService,
        disabled: DisabledCollectionSignerService,
      ) => (isCollectionSigningEnabled() ? envSigner : disabled),
      inject: [EnvCollectionSignerService, DisabledCollectionSignerService],
    },
  ],
  exports: [COLLECTION_SIGNER],
})
export class CustodyModule {}
