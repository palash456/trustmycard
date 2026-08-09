import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const AdminActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const raw = req.headers["x-admin-actor"];
    const value = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();
    return value || "admin";
  },
);
