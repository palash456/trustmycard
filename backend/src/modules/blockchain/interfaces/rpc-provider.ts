/**
 * Chain-agnostic blockchain provider interfaces.
 */

export interface RpcProvider {
  readonly name: string;
  readonly chain: "tron" | "evm";
  isHealthy(): Promise<boolean>;
}

export interface BalanceReader extends RpcProvider {
  getNativeBalance(address: string): Promise<string>;
  getTokenBalance(address: string, token: string): Promise<string>;
}

export interface TxBroadcaster extends RpcProvider {
  broadcast(signedTx: unknown): Promise<{ txHash: string }>;
}
