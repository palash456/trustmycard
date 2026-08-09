import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const raw = req.headers["x-admin-api-key"];
    const apiKey = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();
    const expected = (process.env.ADMIN_API_KEY ?? "").trim();
    if (!expected || apiKey !== expected) {
      throw new UnauthorizedException("Unauthorized");
    }
    return true;
  }
}
