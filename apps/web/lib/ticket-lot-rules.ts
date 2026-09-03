export type TicketClosingRule = "DATE" | "SOLD" | "BOTH";

export function closingRuleFromOptions(byDate: boolean, bySold: boolean): TicketClosingRule {
  if (byDate && bySold) return "BOTH";
  if (bySold) return "SOLD";
  return "DATE";
}

export function closingRuleOptions(rule: TicketClosingRule): { byDate: boolean; bySold: boolean } {
  return {
    byDate: rule === "DATE" || rule === "BOTH",
    bySold: rule === "SOLD" || rule === "BOTH"
  };
}
