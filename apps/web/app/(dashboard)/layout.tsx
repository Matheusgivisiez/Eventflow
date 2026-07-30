import { DashboardShell } from "@/components/dashboard-shell";
import { GitCommit, LucideAArrowDown, PercentDiamond } from "lucide-react";
import { getDomainOfErrorBars } from "recharts/types/util/ChartUtils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}


