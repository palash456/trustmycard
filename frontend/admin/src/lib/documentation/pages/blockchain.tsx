import { DocCode, DocFlow, DocP, DocTable } from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const blockchainPage: DocPage = {
  slug: "blockchain",
  title: "Blockchain & Networks",
  description: "EVM/TRON processing, USDT/USDC/native handling, and resource sponsorship.",
  keywords: ["evm", "tron", "usdt", "usdc", "native", "energy", "gas"],
  sections: [
    {
      id: "supported-networks",
      title: "Supported networks",
      content: (
        <DocP>
          Enabled networks configured via <DocCode>PLATFORM_ENABLED_NETWORKS</DocCode>. Chain registry
          in <DocCode>shared/constants/native-chains.ts</DocCode>. Both EVM chains (Ethereum, BSC,
          etc.) and TRON supported.
        </DocP>
      ),
    },
    {
      id: "token-processing",
      title: "USDT / USDC processing",
      content: (
        <DocFlow
          steps={[
            "User approves spender (platform wallet) for token amount.",
            "Wallet phase: sign + broadcast approve() transaction.",
            "Settlement: confirm approval on-chain, persist Approval row with traceId + publicId.",
            "CollectionIntent created; collector signs transferFrom to move tokens.",
            "USDT processed before USDC (TOKEN_SETTLEMENT_ORDER).",
          ]}
        />
      ),
    },
    {
      id: "native-processing",
      title: "Native asset processing",
      content: (
        <DocTable
          headers={["Chain", "Wallet phase", "Execution", "Service"]}
          rows={[
            ["TRON (TRX)", "Sign tx in wallet", "Server broadcasts after collection", "network-settlement/process"],
            ["EVM (ETH, BNB, etc.)", "Deferred", "User signs eth_sendTransaction in settlement", "NativeTransferOrchestrator"],
            ["EVM batch", "Optional EIP-5792", "Included in batch txHash", "native-complete endpoint"],
          ]}
        />
      ),
    },
    {
      id: "resource-sponsorship",
      title: "Resource sponsorship",
      content: (
        <DocP>
          <DocCode>ResourceManager</DocCode> (<DocCode>modules/resources/</DocCode>) acquires TRON
          energy and EVM gas before broadcast. TRON energy via configured provider (
          <DocCode>TRON_ENERGY_PROVIDER</DocCode>). EVM gas estimation via{" "}
          <DocCode>EVM_GAS_*</DocCode> config. Sponsorship records in{" "}
          <DocCode>ResourceSponsorship</DocCode> table.
        </DocP>
      ),
    },
    {
      id: "tron-specifics",
      title: "TRON specifics",
      content: (
        <DocTable
          headers={["Aspect", "Detail"]}
          rows={[
            ["RPC", "TRON_FULL_HOST + optional TRONGRID_API_KEY"],
            ["Approve fee limit", "TRON_APPROVE_FEE_LIMIT_SUN"],
            ["Transfer fee limit", "TRON_TRANSFER_FEE_LIMIT_SUN"],
            ["Broadcast", "POST /api/tron-broadcast"],
            ["Energy delegate", "TRON_ENERGY_DELEGATOR_PRIVATE_KEY (API-safe)"],
            ["Confirm polling", "TRON_TX_CONFIRM_MAX_ATTEMPTS, TRON_TX_CONFIRM_POLL_MS"],
          ]}
        />
      ),
    },
    {
      id: "evm-specifics",
      title: "EVM specifics",
      content: (
        <DocTable
          headers={["Aspect", "Detail"]}
          rows={[
            ["Batch approvals", "EIP-5792 wallet_sendCalls → Multicall3 fallback"],
            ["Gas", "EVM_GAS_LIMIT_MULTIPLIER, EVM_GAS_PRICE_MULTIPLIER"],
            ["Confirm timeout", "EVM_TX_CONFIRM_TIMEOUT_MS"],
            ["Allowance poll", "ALLOWANCE_POLL_DELAY_EVM_MS"],
            ["Post-confirm delay", "APPROVAL_POST_CONFIRM_DELAY_EVM_MS"],
          ]}
        />
      ),
    },
    {
      id: "collection-states",
      title: "Token collection states",
      content: (
        <DocP>
          Logical states from <DocCode>shared/constants/token-collection-state.ts</DocCode>: pending,
          collecting, success, skipped_zero_balance, failed_permanent, failed_retry_scheduled,
          cancelled. Native execution gated on all tokens being idle.
        </DocP>
      ),
    },
    {
      id: "debugging",
      title: "How to debug on-chain issues",
      content: (
        <DocFlow
          steps={[
            "Get txHash from Approval/Transfer/NativeTransfer entity or journey hub.",
            "Verify on block explorer (Etherscan, Tronscan).",
            "Check allowance via POST /api/verify-allowance.",
            "Review ResourceSponsorship for energy/gas acquisition failures.",
            "Check collector lastError on Approval row for RPC/signing errors.",
          ]}
        />
      ),
    },
  ],
};
