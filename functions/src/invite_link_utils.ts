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

const INVITE_VALUE_KEYS = [
  "parentInviteCode",
  "parentId",
  "parent-id",
  "parent_id",
  "parentCode",
  "parent-code",
  "inviteCode",
  "invite_code",
  "code",
  "branchCode",
  "branch_code"
];

const BRANCH_LINK_KEYS = [
  "+url",
  "~referring_link",
  "$canonical_url",
  "$deeplink_path",
  "link",
  "url",
  "branch-link",
  "branch_url",
  "deep_link",
  "deeplink",
  "deeplink_path",
  "deeplinkPath"
];

function extractCandidateFromPath(value: string): string {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return "";

  const candidate = trimmed.replace(/^\/+|\/+$/g, "");
  if (!candidate) return "";

  const segments = candidate.split("/").map((segment) => segment.trim()).filter(Boolean);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const normalized = segment.replace(/^invited?[-_]/i, "").trim();
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
    for (const key of [...INVITE_VALUE_KEYS, ...BRANCH_LINK_KEYS]) {
      if (objectValue[key] !== undefined && objectValue[key] !== null) {
        const nestedCandidate = normalizeInviteCodeCandidate(objectValue[key]);
        if (nestedCandidate) return nestedCandidate;
      }
    }

    for (const nestedValue of Object.values(objectValue)) {
      if (nestedValue && typeof nestedValue === "object") {
        const nestedCandidate = normalizeInviteCodeCandidate(nestedValue);
        if (nestedCandidate) return nestedCandidate;
      }
    }

    return "";
  }

  const rawValue = asTrimmedString(value);
  if (!rawValue) return "";

  try {
    const parsedUrl = new URL(rawValue, "https://invite.local");
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

  return normalizeInviteCodeCandidate(data);
}
