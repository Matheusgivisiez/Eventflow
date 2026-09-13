import { UserRole } from "@prisma/client";

export type RequestUser = {
  id: string;
  tenantId: string | null;
  email: string;
  /**
   * Only true once the account proved it controls this e-mail address.
   * Anything that claims ownership of data by buyerEmail/attendeeEmail
   * must check this first — see resolveClaimEmail().
   */
  emailVerified: boolean;
  role: UserRole;
};
