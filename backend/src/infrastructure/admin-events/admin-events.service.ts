import { Injectable } from "@nestjs/common";
import { EventEmitter } from "events";

export type TransferUpdatedPayload = {
  id: string;
  status: string;
  approvalId: string;
  ownerAddress: string;
  network: string;
  txHash?: string | null;
  repaired?: boolean;
};

export type NativeTransferUpdatedPayload = {
  id: string;
  status: string;
  ownerAddress: string;
  network: string;
  txHash?: string | null;
  repaired?: boolean;
};

export type ApprovalUpdatedPayload = {
  id: string;
  ownerAddress?: string;
  status?: string;
  network?: string;
};

export type UserUpdatedPayload = {
  address: string;
};

/** In-process bus for admin SSE — wallet/collector must not depend on AdminModule. */
@Injectable()
export class AdminEventsService {
  readonly bus = new EventEmitter();

  transferUpdated(payload: TransferUpdatedPayload): void {
    this.bus.emit("transfer.updated", payload);
  }

  nativeTransferUpdated(payload: NativeTransferUpdatedPayload): void {
    this.bus.emit("native_transfer.updated", payload);
  }

  approvalUpdated(payload: ApprovalUpdatedPayload): void {
    this.bus.emit("approval.updated", payload);
  }

  userUpdated(payload: UserUpdatedPayload): void {
    this.bus.emit("user.updated", payload);
  }
}
