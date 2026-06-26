import { EventStatus, Prisma } from "@prisma/client";
import type { PaginatedResult } from "./base.repository";

export interface IEventsRepository {
  list(tenantId: string, options: { page: number; perPage: number; search?: string; status?: EventStatus }): Promise<PaginatedResult<any>>;
  findByIdForTenant(id: string, tenantId: string): Promise<any | null>;
  findPublicBySlug(slug: string): Promise<any | null>;
  findPublicEvents(options: { page: number; perPage: number; search?: string; category?: string }): Promise<PaginatedResult<any>>;
}
