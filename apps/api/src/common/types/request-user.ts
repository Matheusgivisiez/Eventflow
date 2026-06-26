import { UserRole } from "@prisma/client";

export type RequestUser = {
  id: string;
  tenantId: string | null;
  email: string;
  role: UserRole;
};
