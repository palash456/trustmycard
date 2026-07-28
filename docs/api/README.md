# API

HTTP / OpenAPI documentation. Keep request/response shapes aligned with `@trustmycard/shared` (`frontend/shared`).

## Runtime endpoints

- Backend base: `http://localhost:4000/v1`
- Swagger UI: `http://localhost:4000/v1/docs`
- Wallet endpoints: `http://localhost:4000/v1/api/*`

Website app routes proxy `/api/*` to backend `v1/api/*` through `frontend/website/src/app/api/[...path]/route.ts`.
