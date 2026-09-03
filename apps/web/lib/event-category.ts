export const EVENT_CATEGORIES = ["Palestra", "Teatro", "Shows", "Jogos"] as const;
export const OTHER_CATEGORY = "__OTHER__";

export function resolveEventCategory(category: string, otherCategory?: string): string {
  return category === OTHER_CATEGORY ? otherCategory?.trim() ?? "" : category.trim();
}

