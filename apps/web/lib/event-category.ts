export const EVENT_CATEGORIES = ["Show", "Curso", "Congresso", "Teatro", "Esporte", "Social"] as const;
export const OTHER_CATEGORY = "__OTHER__";

export function resolveEventCategory(category: string, otherCategory?: string): string {
  return category === OTHER_CATEGORY ? otherCategory?.trim() ?? "" : category.trim();
}
