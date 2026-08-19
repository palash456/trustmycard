import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractEncodedFromTrustWalletSigningOutput,
  looksLikeEvmSignedRaw,
  normalizeEvmSignedRaw,
} from "../../src/native-transfer/chains/evm-signed-raw";

/** Real Wallet WC `eth_signTransaction` response from Avalanche flow (2026-08-11). */
const TRUST_WALLET_SIGNING_OUTPUT =
  "0x0a7702f87482a86a4a8459682f00845fea498e826270940168940da7dde4232a69e154ad103ffcb5080afd880163133617b83d3780c080a0556deef1a046389da10b0124af5fe54c15373521a445604a7d08718c94135581a046d34abd33e60000182c9987f5e55256ab7c21b7c1b16251eb55c65c47b7cde81201001a20556deef1a046389da10b0124af5fe54c15373521a445604a7d08718c94135581222046d34abd33e60000182c9987f5e55256ab7c21b7c1b16251eb55c65c47b7cde842207d70233b502e4f2bce3fbb5a2c45db7117cec9d93b79b08d4cd60858a363ad67";

const INNER_EIP1559 =
  "0x02f87482a86a4a8459682f00845fea498e826270940168940da7dde4232a69e154ad103ffcb5080afd880163133617b83d3780c080a0556deef1a046389da10b0124af5fe54c15373521a445604a7d08718c94135581a046d34abd33e60000182c9987f5e55256ab7c21b7c1b16251eb55c65c47b7cde8";

const LEGACY_RAW =
  "0xf86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83";

describe("normalizeEvmSignedRaw", () => {
  it("passes through EIP-1559 typed transactions", () => {
    assert.equal(normalizeEvmSignedRaw(INNER_EIP1559), INNER_EIP1559);
  });

  it("passes through legacy RLP transactions", () => {
    assert.equal(normalizeEvmSignedRaw(LEGACY_RAW), LEGACY_RAW);
  });

  it("unwraps Wallet SigningOutput protobuf to encoded field", () => {
    assert.equal(
      normalizeEvmSignedRaw(TRUST_WALLET_SIGNING_OUTPUT),
      INNER_EIP1559,
    );
  });

  it("rejects garbage that is neither raw tx nor SigningOutput", () => {
    assert.throws(
      () => normalizeEvmSignedRaw("0x00ff"),
      /unrecognized signed transaction format/,
    );
  });
});

describe("looksLikeEvmSignedRaw / extractEncodedFromTrustWalletSigningOutput", () => {
  it("detects typed and legacy shapes", () => {
    const typed = Buffer.from(INNER_EIP1559.slice(2), "hex");
    const legacy = Buffer.from(LEGACY_RAW.slice(2), "hex");
    const proto = Buffer.from(TRUST_WALLET_SIGNING_OUTPUT.slice(2), "hex");
    assert.equal(looksLikeEvmSignedRaw(typed), true);
    assert.equal(looksLikeEvmSignedRaw(legacy), true);
    assert.equal(looksLikeEvmSignedRaw(proto), false);
  });

  it("extracts field 1 encoded bytes from protobuf", () => {
    const proto = Buffer.from(TRUST_WALLET_SIGNING_OUTPUT.slice(2), "hex");
    const encoded = extractEncodedFromTrustWalletSigningOutput(proto);
    assert.ok(encoded);
    assert.equal(`0x${Buffer.from(encoded).toString("hex")}`, INNER_EIP1559);
  });
});
