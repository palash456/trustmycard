import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeTronSignMessageResponse,
  signTronWalletChallenge,
} from "../../src/authorization/wallet-session-token";

describe("wallet-session-token tron signing", () => {
  it("normalizes bare and wrapped Tron signatures", () => {
    assert.equal(
      normalizeTronSignMessageResponse("0xabc123"),
      "0xabc123",
    );
    assert.equal(
      normalizeTronSignMessageResponse({ signature: "0xdef456" }),
      "0xdef456",
    );
  });

  it("falls back from tron_signMessageV2 to tron_signMessage", async () => {
    const calls: string[] = [];
    const provider = {
      request: async (args: { method: string }) => {
        calls.push(args.method);
        if (args.method === "tron_signMessageV2") {
          throw new Error(
            "Missing or invalid. request() method: tron_signMessageV2",
          );
        }
        return { signature: "0xtronmessage" };
      },
    };

    const signature = await signTronWalletChallenge({
      provider: provider as never,
      owner: "TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB",
      challenge: "TrustMyCard wallet session\nNonce: test",
    });

    assert.equal(signature, "0xtronmessage");
    assert.deepEqual(calls, ["tron_signMessageV2", "tron_signMessage"]);
  });

  it("does not fall back on user rejection", async () => {
    const provider = {
      request: async () => {
        throw Object.assign(new Error("User rejected the request"), {
          code: 4001,
        });
      },
    };

    await assert.rejects(
      () =>
        signTronWalletChallenge({
          provider: provider as never,
          owner: "TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB",
          challenge: "challenge",
        }),
      /User rejected/,
    );
  });
});
