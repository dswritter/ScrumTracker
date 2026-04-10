/** Client route for a single work item (detail view). */
export function itemDetailPath(itemId: string): string {
  return `/items/${encodeURIComponent(itemId)}`
}
