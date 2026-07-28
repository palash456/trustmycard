import { Module } from "@nestjs/common";
import { ResourceManager } from "./resource-manager.service";
import { EvmResourceProvider } from "./providers/evm.resource-provider";
import { TronResourceProvider } from "./providers/tron.resource-provider";
import { RESOURCE_CHAIN_PROVIDERS } from "./resources.tokens";

@Module({
  providers: [
    TronResourceProvider,
    EvmResourceProvider,
    {
      provide: RESOURCE_CHAIN_PROVIDERS,
      useFactory: (tron: TronResourceProvider, evm: EvmResourceProvider) => [
        tron,
        evm,
      ],
      inject: [TronResourceProvider, EvmResourceProvider],
    },
    ResourceManager,
  ],
  exports: [ResourceManager],
})
export class ResourcesModule {}
