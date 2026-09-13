import { RequestUser } from "../types/request-user";

/**
 * Returns the e-mail that may be used to claim data that is not linked to the
 * user id yet (guest orders matched by Order.buyerEmail or Ticket.attendeeEmail).
 *
 * Returns null when the account has not verified the address. Without this
 * check anyone could register using someone else's e-mail and take over that
 * person's guest purchases, tickets and CPF.
 */
export function resolveClaimEmail(user: Pick<RequestUser, "email" | "emailVerified">): string | null {
  return user.emailVerified ? user.email.toLowerCase() : null;
}
