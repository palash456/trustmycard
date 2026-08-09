import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { WalletSessionGuard } from "../auth/wallet-session.guard";
import { CollectionIntentService } from "./collection-intent.service";

@Controller("api/collection-intents")
export class CollectionsController {
  constructor(private readonly intents: CollectionIntentService) {}

  @Get(":id")
  @UseGuards(WalletSessionGuard)
  get(
    @Param("id") id: string,
    @Req() request: { walletSession?: { address: string } },
  ) {
    return this.intents.getForOwner(id, request.walletSession!.address);
  }
}
