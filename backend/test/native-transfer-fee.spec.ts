import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGasLimitBuffer,
  computeEvmActualFee,
  computeEvmTransferable,
  computeTronTransferable,
  estimateTronBandwidthFee,
  formatUnits,
  parseTronChainSunPerByte,
  tronSunAmountString,
  validateTransferAmount,
} from "../src/modules/wallet/native-transfer-fee";

describe("native-transfer-fee", () => {
  it("applies gas limit buffer", () => {
    assert.equal(applyGasLimitBuffer(BigInt(21_000)), BigInt(25_200));
  });

  it("computes EVM transferable after fees", () => {
    const balanceRaw = parseHuman("1.0", 18);
    const gasLimit = BigInt(25_200);
    const maxFeePerGas = BigInt(30_000_000_000);
    const { transferableRaw, feeRaw } = computeEvmTransferable({
      balanceRaw,
      feeQuote: {
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas: BigInt(1_500_000_000),
        feeRaw: gasLimit * maxFeePerGas,
      },
    });
    assert.equal(feeRaw, gasLimit * maxFeePerGas);
    assert.equal(transferableRaw, balanceRaw - feeRaw);
  });

  it("computes actual EVM fee from receipt", () => {
    const fee = computeEvmActualFee({
      gasUsed: BigInt(21_000),
      effectiveGasPrice: BigInt(30_000_000_000),
    });
    assert.equal(fee, BigInt(21_000) * BigInt(30_000_000_000));
  });

  it("returns zero transferable when balance cannot cover TRON bandwidth fee", () => {
    const { transferableRaw } = computeTronTransferable({
      balanceRaw: BigInt(100_000),
      feeQuote: {
        ...estimateTronBandwidthFee({
          freeNetLimit: 600,
          freeNetUsed: 600,
          stakedNetLimit: 0,
          stakedNetUsed: 0,
          txBytes: 270,
          sunPerByte: BigInt(1_000),
        }),
        activationFeeRaw: BigInt(0),
      },
    });
    assert.equal(transferableRaw, BigInt(0));
  });

  it("uses free bandwidth when available on TRON", () => {
    const quote = estimateTronBandwidthFee({
      freeNetLimit: 600,
      freeNetUsed: 0,
      stakedNetLimit: 0,
      stakedNetUsed: 0,
      txBytes: 270,
      sunPerByte: BigInt(1_000),
    });
    assert.equal(quote.feeRaw, BigInt(0));
  });

  it("parses TRON chain sun per byte from live parameters shape", () => {
    const sun = parseTronChainSunPerByte([
      { key: "getTransactionFee", value: 1000 },
    ]);
    assert.equal(sun, BigInt(1000));
  });

  it("never uses Number() for TRON sun amounts", () => {
    const large = BigInt("9007199254740992");
    assert.equal(tronSunAmountString(large), "9007199254740992");
  });

  it("requires exact on-chain amount match", () => {
    const expected = BigInt(1_000_000);
    assert.deepEqual(
      validateTransferAmount({ amountRaw: expected, expectedAmountRaw: expected }),
      { ok: true }
    );
    assert.equal(
      validateTransferAmount({
        amountRaw: expected + BigInt(1),
        expectedAmountRaw: expected,
      }).ok,
      false
    );
    assert.equal(
      validateTransferAmount({
        amountRaw: expected - BigInt(1),
        expectedAmountRaw: expected,
      }).ok,
      false
    );
  });

  it("formats units without precision loss for TRON", () => {
    assert.equal(formatUnits(BigInt(1_500_000), 6), "1.5");
  });
});

function parseHuman(value: string, decimals: number): bigint {
  const [whole, frac = ""] = value.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(fracPadded || "0");
}
