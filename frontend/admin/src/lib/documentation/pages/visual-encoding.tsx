import {
  DocCallout,
  DocCode,
  DocP,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import {
  TOKEN_COLOR_CLASSES,
  TOKEN_COLOR_LABELS,
  TRANSACTION_ID_COLOR_CLASSES,
  TRANSACTION_ID_MISSING_CLASS,
  WALLET_ADDRESS_COLOR_CLASSES,
  classifyTokenSymbol,
  tokenSymbolColorClass,
  transactionIdColorClass,
  walletAddressColorClass,
} from "@/lib/entity-colors";
import type { DocPage } from "../types";

const SAMPLE_TX = "flow-20260812-195912-9WGYRB";
const SAMPLE_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";

function ColorSwatch({
  label,
  className,
  sample,
}: {
  label: string;
  className: string;
  sample: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`font-mono text-sm font-medium ${className}`}>
        {sample}
      </span>
      <span className="text-xs text-muted-foreground">({label})</span>
    </span>
  );
}

export const visualEncodingPage: DocPage = {
  slug: "visual-encoding",
  title: "Visual encoding & colors",
  description:
    "How the admin panel assigns stable colors to transaction IDs, wallet addresses, and token symbols so you can recognize the same entity across pages.",
  keywords: [
    "color",
    "colour",
    "transaction id",
    "wallet",
    "address",
    "usdt",
    "usdc",
    "native",
    "encoding",
    "ui",
  ],
  sections: [
    {
      id: "why",
      title: "Why stable colors?",
      content: (
        <>
          <DocP>
            Operators jump between Transactions, Pipeline, Activity, Audit &
            logs, and user profiles while debugging a single journey. The admin
            UI uses deterministic color rules so the same{" "}
            <DocCode>flow-*</DocCode> ID, wallet address, or token symbol
            always renders with the same accent — not a random theme color per
            page.
          </DocP>
          <DocCallout variant="info">
            Colors are computed in{" "}
            <DocCode>frontend/admin/src/lib/entity-colors.ts</DocCode> and
            applied via shared components:{" "}
            <DocCode>TransactionIdLink</DocCode>,{" "}
            <DocCode>WalletAddressLink</DocCode>, and{" "}
            <DocCode>TokenSymbol</DocCode> /{" "}
            <DocCode>TokenSymbolList</DocCode> (comma-separated lists) and{" "}
            <DocCode>NetworkBadge</DocCode>.
          </DocCallout>
        </>
      ),
    },
    {
      id: "transaction-ids",
      title: "Transaction IDs (flow-*)",
      content: (
        <>
          <DocP>
            Journey IDs are hashed to one of five accent palettes. The same ID
            always maps to the same shade on every page (tables, headers,
            structured logs, dashboard, pipeline).
          </DocP>
          <DocTable
            headers={["Rule", "Detail"]}
            rows={[
              ["Input", "Canonical flow-* transaction / session / trace ID"],
              [
                "Algorithm",
                "32-bit string hash → index into a fixed 15-color palette",
              ],
              [
                "Missing / N/A",
                "Dull grey (light) or off-white (dark) — never accent colors",
              ],
              [
                "Palettes",
                `${TRANSACTION_ID_COLOR_CLASSES.length} accent shades`,
              ],
            ]}
          />
          <DocP>
            Example for <DocCode>{SAMPLE_TX}</DocCode>:{" "}
            <ColorSwatch
              label="stable per ID"
              className={transactionIdColorClass(SAMPLE_TX)}
              sample={SAMPLE_TX}
            />
          </DocP>
          <DocP>
            Missing IDs render as{" "}
            <span className={TRANSACTION_ID_MISSING_CLASS}>—</span> or{" "}
            <span className={TRANSACTION_ID_MISSING_CLASS}>n/a</span> (dull
            grey in light mode, off-white in dark mode), never as a bright
            accent.
          </DocP>
        </>
      ),
    },
    {
      id: "wallet-addresses",
      title: "Wallet addresses",
      content: (
        <>
          <DocP>
            Wallet addresses use a separate thirty-color palette (deeper
            shades: purple, teal, green, blue, orange, …) so they are visually
            distinct from transaction IDs. Addresses are normalized to lowercase
            before hashing so checksum casing does not change the color.
          </DocP>
          <DocTable
            headers={["Rule", "Detail"]}
            rows={[
              ["Input", "Full EVM (0x…) or TRON (T…) address"],
              ["Links", "Default profile → /users/{address}; pipeline tables → pipeline user hub"],
              ["Palettes", `${WALLET_ADDRESS_COLOR_CLASSES.length} accent shades`],
            ]}
          />
          <DocP>
            Example:{" "}
            <ColorSwatch
              label="stable per address"
              className={walletAddressColorClass(SAMPLE_WALLET)}
              sample={SAMPLE_WALLET}
            />
          </DocP>
        </>
      ),
    },
    {
      id: "tokens",
      title: "Token symbols (USDT, USDC, native)",
      content: (
        <>
          <DocP>
            Stablecoins and native gas assets use fixed category colors (not
            hashed) so USDT, USDC, and native transfers are instantly
            recognizable in pipeline tables, transaction lists, and settlement
            panels.
          </DocP>
          <DocTable
            headers={["Category", "Symbols", "Tailwind class"]}
            rows={[
              [
                TOKEN_COLOR_LABELS.usdt,
                "USDT",
                TOKEN_COLOR_CLASSES.usdt,
              ],
              [
                TOKEN_COLOR_LABELS.usdc,
                "USDC",
                TOKEN_COLOR_CLASSES.usdc,
              ],
              [
                TOKEN_COLOR_LABELS.native,
                "TRX, ETH, BNB, AVAX, POL, MATIC, …",
                TOKEN_COLOR_CLASSES.native,
              ],
              [
                "Other ERC-20 / unknown",
                "Anything else",
                TOKEN_COLOR_CLASSES.other,
              ],
            ]}
          />
          <DocP>
            Examples:{" "}
            <span className={tokenSymbolColorClass("USDT")}>USDT</span>
            {" · "}
            <span className={tokenSymbolColorClass("USDC")}>USDC</span>
            {" · "}
            <span className={tokenSymbolColorClass("TRX")}>TRX</span>
            {" · "}
            <span className={tokenSymbolColorClass("ETH")}>ETH</span>
          </DocP>
          <DocP>
            Classification helper:{" "}
            <DocCode>classifyTokenSymbol(&quot;USDT&quot;)</DocCode> →{" "}
            <DocCode>{classifyTokenSymbol("USDT")}</DocCode>
          </DocP>
        </>
      ),
    },
    {
      id: "where-used",
      title: "Where colors appear",
      content: (
        <DocTable
          headers={["Surface", "Transaction ID", "Wallet", "Token"]}
          rows={[
            ["/transactions", "✓", "✓", "✓"],
            ["/pipeline (tables & user hub)", "✓", "✓", "✓"],
            ["/activity", "✓", "✓", "—"],
            ["/audit structured logs", "✓", "✓", "—"],
            ["/users & /wallets", "—", "✓ (headers & lists)", "✓ in asset rows"],
            ["Dashboard recent / failures", "✓", "✓", "—"],
            ["Settlement sessions panel", "✓", "—", "USDT / USDC / Native"],
          ]}
        />
      ),
    },
  ],
};
