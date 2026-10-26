export function countDirectChildrenFromValue(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((count, child) => {
      const childId = String(child ?? "").trim();
      return childId ? count + 1 : count;
    }, 0);
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).filter((key) => key && key !== "__proto__").length;
  }

  return 0;
}
