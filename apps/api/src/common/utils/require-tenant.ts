import { ForbiddenException } from "@nestjs/common";
import { RequestUser } from "../types/request-user";

/**
 * Every tenant-scoped query in this codebase filters by `tenantId`, and a
 * customer/promoter account has `tenantId: null`. Passing that straight into
 * a Prisma `where` turns the filter into "tenantId IS NULL", which matches
 * every other account or record with no tenant instead of narrowing to one
 * organization. Call this before any tenant-scoped query so a null tenant
 * fails closed instead of silently becoming an unscoped query.
 */
export function requireTenant(user: RequestUser): string {
  if (!user.tenantId) {
    throw new ForbiddenException("Esta conta nao pertence a uma organizacao.");
  }
  return user.tenantId;
}
