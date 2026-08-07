import { resolveServiceRole } from "./config/service-role";
import { ApiAppModule } from "./api-app.module";
import { AppModule } from "./app.module";

/** HTTP server module: ApiAppModule in production split; AppModule for local all-in-one. */
export function resolveHttpAppModule(): typeof ApiAppModule | typeof AppModule {
  const role = resolveServiceRole();
  if (role === "worker") {
    throw new Error("Cannot start HTTP server with SERVICE_ROLE=worker");
  }
  return role === "api" ? ApiAppModule : AppModule;
}
