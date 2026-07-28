# ADR 0001 — Shared package lives in frontend/shared

## Status

Accepted (updated)

## Context

Platform types, constants, and schemas are shared across frontend apps. The backend may consume the same contracts later.

## Decision

Own platform contracts in `frontend/shared` (`types/`, `constants/`, `schemas/`), imported by frontend packages as `@trustmycard/shared`.

The backend is a separate npm tree. When needed, it can depend on `file:../frontend/shared`.

## Consequences

- One npm install for all frontend packages (`cd frontend && npm install`)
- Backend stays independent; optional cross-folder dependency for shared types
- Root repo contains only `backend/`, `frontend/`, and `docs/`
