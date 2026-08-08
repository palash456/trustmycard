"use client";

import { installBrowserConsolePolicy } from "@trustmycard/wallet-sdk";

installBrowserConsolePolicy();

/** Silences browser console output in production before wallet SDK loads. */
export function ProductionConsoleGuard() {
  installBrowserConsolePolicy();
  return null;
}
