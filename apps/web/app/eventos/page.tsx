import { redirect } from "next/navigation";

/**
 * Compatibility route for payment providers and old links.
 * The buyer's post-purchase destination is the ticket wallet, not the
 * organizer/event catalog (which lives at "/").
 */
export default function EventosCompatibilityPage() {
  redirect("/me/ingressos");
}
