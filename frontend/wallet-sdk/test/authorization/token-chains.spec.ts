import assert from "node:assert/strict";
import test from "node:test";
import {
  EVM_USDC,
  EVM_USDT,
  getToken,
  parseHumanToRaw,
  tokensForNetwork,
} from "../../src/core/chain-tokens";
import { balanceForToken } from "../../src/authorization/preferences";
import type { NetworkRow } from "../../src/types";

const EVM_CHAIN_KEYS = ["eth", "bsc", "pol", "avax", "arb", "base", "op"] as const;

test("every supported EVM chain exposes USDT and USDC with valid addresses", () => {
  for (const network of EVM_CHAIN_KEYS) {
    const tokens = tokensForNetwork(network);
    assert.equal(tokens.length, 2, `${network} should expose USDT + USDC`);
    assert.deepEqual(
      tokens.map((t) => t.symbol),
      ["USDT", "USDC"],
    );
    for (const token of tokens) {
      assert.match(
        token.address,
        /^0x[a-fA-F0-9]{40}$/,
        `${network} ${token.symbol} address`,
      );
      assert.ok(token.decimals > 0, `${network} ${token.symbol} decimals`);
    }
    assert.ok(getToken(network, "USDT"));
    assert.ok(getToken(network, "USDC"));
  }
});

test("EVM USDT/USDC registry matches getToken for all chains", () => {
  for (const network of EVM_CHAIN_KEYS) {
    assert.deepEqual(getToken(network, "USDT"), EVM_USDT[network]);
    assert.deepEqual(getToken(network, "USDC"), EVM_USDC[network]);
  }
});

test("transfer amount raw respects token decimals on every EVM chain", () => {
  for (const network of EVM_CHAIN_KEYS) {
    for (const symbol of ["USDT", "USDC"] as const) {
      const info = getToken(network, symbol)!;
      const row: NetworkRow = {
        key: network,
        name: network,
        standard: "ERC-20",
        color: "#000",
        letter: "X",
        balances: {
          native: "1",
          usdt: symbol === "USDT" ? "12.5" : "0",
          usdc: symbol === "USDC" ? "3.25" : "0",
        },
      };
      const human = balanceForToken(row, symbol);
      const raw = parseHumanToRaw(human, info.decimals);
      assert.ok(
        raw > BigInt(0),
        `${network} ${symbol} should parse positive raw`,
      );
    }
  }
});

test("tron exposes USDT and USDC with distinct token metadata", () => {
  const tokens = tokensForNetwork("tron");
  assert.deepEqual(
    tokens.map((t) => t.symbol),
    ["USDT", "USDC"],
  );
  assert.notEqual(tokens[0]?.address, tokens[1]?.address);
});
