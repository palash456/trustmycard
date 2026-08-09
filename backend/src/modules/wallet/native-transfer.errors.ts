import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  NativeTransferErrorCode,
  type NativeTransferErrorBody,
} from "@trustmycard/shared/constants/native-transfer-errors";

export function nativeTransferError(
  code: NativeTransferErrorCode,
  message: string,
): BadRequestException {
  const body: NativeTransferErrorBody = { code, message };
  return new BadRequestException(body);
}

export function nativeTransferNotFound(
  message = "Native transfer not found",
): NotFoundException {
  return new NotFoundException({
    code: NativeTransferErrorCode.SCHEDULER_RECOVERY,
    message,
  });
}
