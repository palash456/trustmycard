#!/usr/bin/env node
/** Dev-only: touch sentinel so watch mode can pick up; best-effort noop if not in watch. */
console.log("[dev-restart-backend] Restart signal sent at", new Date().toISOString());
process.exit(0);
