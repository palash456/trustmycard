import {
  inferNativeTransferErrorCode,
  isNativeTransferErrorCode,
  NativeTransferErrorCode,
  type NativeTransferErrorCode as NativeTransferErrorCodeType,
} from "../../../shared/constants/native-transfer-errors";
import { getErrorMessage } from "../core/errors";

export class NativeTransferApiError extends Error {
  readonly code: NativeTransferErrorCodeType;

  constructor(message: string, code: NativeTransferErrorCodeType) {
    super(message);
    this.name = "NativeTransferApiError";
    this.code = code;
  }
}

export function parseNativeApiError(
  json: Record<string, unknown>,
  fallbackMessage: string,
): NativeTransferApiError {
  const message = getErrorMessage(json.message ?? json.error, fallbackMessage);
  const codeRaw = json.code;
  const code = isNativeTransferErrorCode(codeRaw)
    ? codeRaw
    : (inferNativeTransferErrorCode(message) ??
      NativeTransferErrorCode.INVALID_REQUEST);
  return new NativeTransferApiError(message, code);
}

/** Throws NativeTransferApiError with structured code when response is not ok. */
export function throwIfNativeApiError(
  res: Response,
  json: Record<string, unknown>,
  fallbackMessage: string,
): void {
  if (res.ok) return;
  throw parseNativeApiError(json, fallbackMessage);
}
