function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const candidate = asTrimmedString(value);
    if (candidate.length > 0) return candidate;
  }
  return "";
}

function extractCandidateFromPath(value: string): string {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return "";

  const candidate = trimmed.replace(/^\/+|\/+$/g, "");
  if (!candidate) return "";

  const segments = candidate.split("/").map((segment) => segment.trim()).filter(Boolean);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const normalized = segment.replace(/^invite[-_]/i, "").trim();
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export function normalizeInviteCodeCandidate(value: unknown): string {
  if (value === undefined || value === null) return "";

  if (typeof value === "object" && !Array.isArray(value)) {
    const objectValue = value as Record<string, unknown>;
    const nestedCandidate = firstNonEmpty(
      objectValue.parentInviteCode,
      objectValue.parentId,
      objectValue["parent-id"],
      objectValue.parent_id,
      objectValue.parentCode,
      objectValue["parent-code"],
      objectValue.inviteCode,
      objectValue.invite_code,
      objectValue.code,
      objectValue.branchCode,
      objectValue.branch_code,
      objectValue.link,
      objectValue.url,
      objectValue["branch-link"],
      objectValue["branch_url"],
      objectValue["deep_link"],
      objectValue["deeplink"],
      objectValue["deeplink_path"],
      objectValue["deeplinkPath"]
    );

    if (nestedCandidate) {
      return normalizeInviteCodeCandidate(nestedCandidate);
    }

    return "";
  }

  const rawValue = asTrimmedString(value);
  if (!rawValue) return "";

  try {
    const parsedUrl = new URL(rawValue);
    const queryCandidate = firstNonEmpty(
      parsedUrl.searchParams.get("parentInviteCode"),
      parsedUrl.searchParams.get("parentId"),
      parsedUrl.searchParams.get("parent-id"),
      parsedUrl.searchParams.get("parent_id"),
      parsedUrl.searchParams.get("parentCode"),
      parsedUrl.searchParams.get("parent-code"),
      parsedUrl.searchParams.get("inviteCode"),
      parsedUrl.searchParams.get("invite_code"),
      parsedUrl.searchParams.get("code"),
      parsedUrl.searchParams.get("branchCode"),
      parsedUrl.searchParams.get("branch_code"),
      parsedUrl.searchParams.get("link"),
      parsedUrl.searchParams.get("url")
    );

    if (queryCandidate) {
      return queryCandidate;
    }

    const pathCandidate = extractCandidateFromPath(parsedUrl.pathname);
    if (pathCandidate) {
      return pathCandidate;
    }
  } catch {
    // Fall back to the raw string if it is not a URL.
  }

  const fallback = extractCandidateFromPath(rawValue);
  return fallback || rawValue;
}

export function extractParentInviteCodeCandidateFromRequestData(data: Record<string, unknown> | undefined): string {
  if (!data || typeof data !== "object") return "";

  return firstNonEmpty(
    data.parentInviteCode,
    data.parentId,
    data["parent-id"],
    data.parent_id,
    data.parentCode,
    data["parent-code"],
    data.inviteCode,
    data.invite_code,
    data.code,
    data.branchCode,
    data.branch_code,
    data.link,
    data.url,
    data["branch-link"],
    data["branch_url"],
    data["deep_link"],
    data["deeplink"],
    data["deeplink_path"],
    data["deeplinkPath"]
  );
}
