import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ethers } from "ethers";
import { ConfigService } from "../../config/config.service";
import { PlatformConfigService } from "../../config/platform-config.service";
import { SETTING_KEYS } from "../../config/settings-keys";
import { COLLECTION_SIGNER, type CollectionSigner } from "../custody/signer";
import {
  EVM_COLLECTOR_MIN_GAS_UNITS,
  EVM_RPCS,
  TRON_GRID,
  sleep,
  type EvmChainKey,
  type TokenSymbol,
} from "./wallet.constants";
import {
  getToken,
  isEvm,
  tronAddressToAbiWord,
  humanizeCollectorGasError,
} from "./wallet-crypto.util";

@Injectable()
export class WalletRpcService {
  constructor(
    private readonly configService: ConfigService,
    private readonly platformConfig: PlatformConfigService,
    @Inject(COLLECTION_SIGNER)
    private readonly collectionSigner: CollectionSigner,
  ) {}

  rpcTimeoutMs(): number {
    return (
      Number(this.configService.get(SETTING_KEYS.COLLECTOR_RPC_TIMEOUT_MS)) ||
      this.platformConfig.getCollector().rpcTimeoutMs
    );
  }

  getAdminEvmPrivateKey(): string {
    return this.platformConfig.getWallets().adminEvmPrivateKey;
  }

  getAdminTronPrivateKey(): string {
    return this.platformConfig.getWallets().adminTronPrivateKey;
  }

  tronHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const apiKey = this.platformConfig.getChains().trongridApiKey;
    if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
    return headers;
  }

  tronFullHost(): string {
    return this.platformConfig.getChains().tronFullHost || TRON_GRID;
  }

  spenderEvm() {
    return this.platformConfig.getWallets().spenderEvm;
  }

  spenderTron() {
    return this.platformConfig.getWallets().spenderTron;
  }

  spenderFor(network: string) {
    return this.platformConfig.spenderForNetwork(network);
  }

  async rpcCall(
    rpc: string,
    method: string,
    params: unknown[],
  ): Promise<string> {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: AbortSignal.timeout(this.rpcTimeoutMs()),
    });
    const json = (await res.json()) as {
      result?: string;
      error?: { message?: string };
    };
    if (!res.ok || json.error)
      throw new Error(json.error?.message || `RPC ${res.status}`);
    return json.result ?? "0x0";
  }

  async evmRpcCall(
    network: EvmChainKey,
    method: string,
    params: unknown[],
  ): Promise<string> {
    let lastError: unknown;
    for (const rpc of EVM_RPCS[network]) {
      try {
        return await this.rpcCall(rpc, method, params);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`All ${network} RPC endpoints failed`);
  }

  async readTronTransactionInfo(txHash: string): Promise<{
    id?: string;
    blockNumber?: number;
    receipt?: { result?: string };
    result?: string;
  } | null> {
    try {
      const res = await fetch(
        `${this.tronFullHost()}/wallet/gettransactioninfobyid`,
        {
          method: "POST",
          headers: this.tronHeaders(),
          body: JSON.stringify({ value: txHash }),
          cache: "no-store",
          signal: AbortSignal.timeout(
            this.platformConfig.getCollector().rpcTimeoutMs,
          ),
        },
      );
      if (!res.ok) return null;
      return (await res.json()) as {
        id?: string;
        blockNumber?: number;
        receipt?: { result?: string };
        result?: string;
      };
    } catch {
      return null;
    }
  }

  async readTokenBalanceRaw(
    network: string,
    owner: string,
    token: TokenSymbol,
  ): Promise<bigint> {
    const tokenInfo = getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported network/token");

    if (network === "tron") {
      const parameter = tronAddressToAbiWord(owner);
      const res = await fetch(`${TRON_GRID}/wallet/triggerconstantcontract`, {
        method: "POST",
        headers: this.tronHeaders(),
        body: JSON.stringify({
          owner_address: owner,
          contract_address: tokenInfo.address,
          function_selector: "balanceOf(address)",
          parameter,
          visible: true,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(this.rpcTimeoutMs()),
      });
      const json = (await res.json().catch(() => ({}))) as {
        constant_result?: string[];
      };
      const hex = json.constant_result?.[0];
      return hex ? BigInt(`0x${hex}`) : BigInt(0);
    }

    if (!isEvm(network))
      throw new BadRequestException("Unsupported EVM network");
    const data = `0x70a08231${owner.slice(2).toLowerCase().padStart(64, "0")}`;
    const raw = await this.evmRpcCall(network, "eth_call", [
      { to: tokenInfo.address, data },
      "latest",
    ]);
    return BigInt(raw);
  }

  async readTokenBalanceRawWithRetry(
    network: string,
    owner: string,
    token: TokenSymbol,
    maxAttempts = 4,
  ): Promise<bigint> {
    const delayMs =
      network === "tron"
        ? this.platformConfig.getTransfer().allowancePollDelayTronMs
        : this.platformConfig.getTransfer().allowancePollDelayEvmMs;
    let balance = await this.readTokenBalanceRaw(network, owner, token);
    for (let i = 1; i < maxAttempts && balance <= BigInt(0); i++) {
      await sleep(delayMs);
      balance = await this.readTokenBalanceRaw(network, owner, token);
    }
    return balance;
  }

  async ensureCollectorEvmGas(
    provider: ethers.providers.JsonRpcProvider,
    wallet: ethers.Wallet,
    network: EvmChainKey,
  ): Promise<void> {
    const balance = await provider.getBalance(wallet.address);
    const feeData = await provider.getFeeData();
    const maxFee =
      feeData.maxFeePerGas ?? feeData.gasPrice ?? ethers.BigNumber.from(0);
    const needed = maxFee.mul(EVM_COLLECTOR_MIN_GAS_UNITS);
    if (balance.lt(needed)) {
      throw new Error(
        humanizeCollectorGasError(
          network,
          "insufficient funds for intrinsic transaction cost",
          this.spenderFor(network),
        ),
      );
    }
  }
}
