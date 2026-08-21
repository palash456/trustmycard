import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveWalletConnectIconUrl,
  resolveWalletConnectMetadata,
  resolveWalletConnectOrigin,
  WC_APP_ICON_PATH,
} from "../../src/core/constants";

describe("resolveWalletConnectMetadata", () => {
  it("uses the optimized icon path", () => {
    const metadata = resolveWalletConnectMetadata();
    assert.equal(metadata.icons.length, 1);
    assert.ok(metadata.icons[0].endsWith(WC_APP_ICON_PATH));
    assert.equal(metadata.icons[0], resolveWalletConnectIconUrl(metadata.url));
  });

  it("prefers NEXT_PUBLIC_APP_URL when page origin is localhost", () => {
    const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const prevLan = process.env.TMC_LAN_DEV_ORIGIN;
    process.env.NEXT_PUBLIC_APP_URL = "https://trustcard.example";
    delete process.env.TMC_LAN_DEV_ORIGIN;

    const origin = resolveWalletConnectOrigin();
    assert.equal(origin, "https://trustcard.example");
    assert.equal(
      resolveWalletConnectIconUrl(),
      "https://trustcard.example/logos/optimized/trust-card-icon.png",
    );

    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
    if (prevLan === undefined) delete process.env.TMC_LAN_DEV_ORIGIN;
    else process.env.TMC_LAN_DEV_ORIGIN = prevLan;
  });

  it("falls back to TMC_LAN_DEV_ORIGIN when app URL is also local", () => {
    const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const prevLan = process.env.TMC_LAN_DEV_ORIGIN;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.TMC_LAN_DEV_ORIGIN = "http://192.168.1.42:3000";

    const origin = resolveWalletConnectOrigin();
    assert.equal(origin, "http://192.168.1.42:3000");

    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
    if (prevLan === undefined) delete process.env.TMC_LAN_DEV_ORIGIN;
    else process.env.TMC_LAN_DEV_ORIGIN = prevLan;
  });
});
