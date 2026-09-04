import type { AuthUser } from "@/stores/auth-store";

export type MobileAccountNavItem = {
  id: "explore" | "profile" | "panel" | "become-producer";
  href: string;
  label: string;
  ariaLabel: string;
  isActive: boolean;
};

const PANEL_ACCESS_ROLES: AuthUser["role"][] = ["ADMIN", "ORGANIZER", "TEAM", "CHECKIN"];
const PRODUCER_ROUTES = [
  "/dashboard",
  "/events",
  "/participants",
  "/check-in",
  "/finance",
  "/reports",
  "/enterprise",
  "/promoters",
  "/team",
  "/coupons",
  "/notifications",
  "/profile",
  "/admin"
];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function getMobileAccountNavItems(
  role: AuthUser["role"],
  pathname: string
): MobileAccountNavItem[] {
  const hasPanelAccess = PANEL_ACCESS_ROLES.includes(role);
  const producerHref = role === "CHECKIN" ? "/check-in" : "/dashboard";

  return [
    {
      id: "explore",
      href: "/#eventos",
      label: "Explorar",
      ariaLabel: "Explorar eventos",
      isActive: pathname === "/"
    },
    {
      id: "profile",
      href: "/me",
      label: "Perfil",
      ariaLabel: "Perfil, ingressos e dados da conta",
      isActive:
        (pathname === "/me" || pathname.startsWith("/me/")) &&
        !pathname.startsWith("/me/organizador")
    },
    hasPanelAccess
      ? {
          id: "panel",
          href: producerHref,
          label: "Painel",
          ariaLabel: "Painel do produtor",
          isActive: PRODUCER_ROUTES.some((route) => matchesRoute(pathname, route))
        }
      : {
          id: "become-producer",
          href: "/me/organizador",
          label: "Ser produtor",
          ariaLabel: "Ativar conta de produtor",
          isActive: pathname.startsWith("/me/organizador")
        }
  ];
}
