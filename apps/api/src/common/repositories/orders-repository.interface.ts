import { PaymentStatus, Prisma } from "@prisma/client";
import type { PaginatedResult } from "./base.repository";

export interface IOrdersRepository {
  findById(id: string): Promise<any | null>;
  findByEventId(eventId: string): Promise<any[]>;
  findByBuyerEmail(email: string): Promise<any[]>;
  create(data: any): Promise<any>;
  updateStatus(id: string, status: PaymentStatus): Promise<any>;
}
