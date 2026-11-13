import * as admin from "firebase-admin";

export const USERNAME_INDEX_PATH = "UsernameIndex";
const USERNAME_PATTERN = /^[a-z0-9._]+$/;

export interface UsernameValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

export function getUsernameIndexKey(value: string | null | undefined): string {
  const normalized = normalizeUsernameInput(value);
  return Buffer.from(normalized, "utf8").toString("base64url");
}

export function getUsernameIndexRef(value: string | null | undefined): admin.database.Reference {
  return admin.database().ref(USERNAME_INDEX_PATH).child(getUsernameIndexKey(value));
}

export function normalizeUsernameInput(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function validateUsername(value: string | null | undefined): UsernameValidationResult {
  const normalized = normalizeUsernameInput(value);

  if (!normalized) {
    return { valid: false, normalized, error: "Username is required." };
  }

  if (normalized.length < 3 || normalized.length > 20) {
    return { valid: false, normalized, error: "Username must be 3-20 characters long." };
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Username can only contain letters, numbers, dots, and underscores."
    };
  }

  return { valid: true, normalized };
}

export function sanitizeSuggestionToken(value: string | null | undefined): string {
  const cleaned = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return cleaned;
}

export function generateUsernameSuggestions(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  currentUserName?: string | null
): string[] {
  const first = sanitizeSuggestionToken(firstName);
  const last = sanitizeSuggestionToken(lastName);
  const blocked = new Set<string>();

  if (currentUserName) {
    blocked.add(normalizeUsernameInput(currentUserName));
  }

  const candidates: string[] = [];

  if (first && last) {
    candidates.push(`${first}${last}`);
    candidates.push(`${first}_${last}`);
    candidates.push(`${first}.${last}`);
    if (first.length > 1 && last.length > 1) {
      candidates.push(`${first}${last.slice(0, 1)}`);
    }
  } else if (first) {
    candidates.push(first, `${first}1`, `${first}_1`);
  } else if (last) {
    candidates.push(last, `${last}1`, `${last}_1`);
  }

  const suggestions: string[] = [];
  for (const candidate of candidates) {
    const normalized = normalizeUsernameInput(candidate);
    const validation = validateUsername(normalized);

    if (!validation.valid) {
      continue;
    }

    if (blocked.has(validation.normalized)) {
      continue;
    }

    if (!suggestions.includes(validation.normalized)) {
      suggestions.push(validation.normalized);
    }

    if (suggestions.length >= 3) {
      break;
    }
  }

  return suggestions.slice(0, 3);
}

export async function isUsernameAvailableInStore(
  value: string | null | undefined,
  store: Map<string, string>,
  currentUserId?: string | null
): Promise<boolean> {
  const validation = validateUsername(value);
  if (!validation.valid) {
    return false;
  }

  const current = store.get(validation.normalized);
  if (!current) {
    return true;
  }

  return currentUserId ? String(current) === String(currentUserId) : false;
}

function withTimeout<T>(promiseFactory: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeoutMs);

    promiseFactory()
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function isUsernameAvailable(
  value: string | null | undefined,
  currentUserId: string | null = null,
  timeoutMs = 1500
): Promise<boolean> {
  const validation = validateUsername(value);
  if (!validation.valid) {
    return false;
  }

  const usernameRef = getUsernameIndexRef(validation.normalized);

  return withTimeout(async () => {
    const snapshot = await usernameRef.once("value");
    const existingUserId = snapshot.val();

    if (!existingUserId) {
      return true;
    }

    return String(existingUserId) === String(currentUserId || "");
  }, timeoutMs);
}

export async function reserveUsernameForUser(
  userId: string,
  value: string | null | undefined
): Promise<boolean> {
  const validation = validateUsername(value);
  if (!validation.valid || !userId) {
    return false;
  }

  const userNameRef = getUsernameIndexRef(validation.normalized);
  const result = await userNameRef.transaction((currentValue) => {
    if (currentValue === null || currentValue === userId) {
      return userId;
    }

    return undefined;
  });

  return !!result.committed && String(result.snapshot.val() || "") === String(userId);
}

export async function releaseUsernameReservation(
  userId: string,
  value: string | null | undefined
): Promise<void> {
  const validation = validateUsername(value);
  if (!validation.valid || !userId) {
    return;
  }

  const usernameRef = getUsernameIndexRef(validation.normalized);
  const currentValue = (await usernameRef.once("value")).val();
  if (String(currentValue || "") === String(userId)) {
    await usernameRef.remove();
  }
}

export async function ensureUsernameIndexEntryForUser(userId: string, userName: string | null | undefined): Promise<boolean> {
  const validation = validateUsername(userName);
  if (!validation.valid || !userId) {
    return false;
  }

  const usernameRef = getUsernameIndexRef(validation.normalized);
  const currentValue = (await usernameRef.once("value")).val();

  if (!currentValue || String(currentValue) === String(userId)) {
    await usernameRef.set(String(userId));
    return true;
  }

  return false;
}

export async function rebuildUsernameIndex(): Promise<{ scanned: number; updated: number; removed: number; }> {
  const usernameIndexRef = admin.database().ref(USERNAME_INDEX_PATH);
  await usernameIndexRef.remove();

  let lastKey: string | null = null;
  let scanned = 0;
  let updated = 0;
  const pageSize = 200;

  while (true) {
    const usersRef = admin.database().ref("Users");
    let pageQuery = usersRef.orderByKey();

    if (lastKey) {
      pageQuery = pageQuery.startAt(lastKey);
    }

    pageQuery = pageQuery.limitToFirst(pageSize + 1);
    const pageSnapshot = await pageQuery.once("value");
    const entries = pageSnapshot.val() || {};
    const ids = Object.keys(entries);

    if (ids.length === 0) {
      break;
    }

    const startIndex = lastKey && ids[0] === lastKey ? 1 : 0;
    const currentPage = ids.slice(startIndex, startIndex + pageSize);

    for (const userId of currentPage) {
      const userSnapshot = pageSnapshot.child(userId);
      const rawUserName = String(userSnapshot.child("userName").val() ?? "");
      const validation = validateUsername(rawUserName);

      if (!userId || !validation.valid) {
        continue;
      }

      scanned += 1;
      const userNameRef = getUsernameIndexRef(validation.normalized);
      await userNameRef.set(String(userId));
      updated += 1;
    }

    if (currentPage.length < pageSize || ids.length <= pageSize) {
      break;
    }

    lastKey = currentPage[currentPage.length - 1];
  }

  return {
    scanned,
    updated,
    removed: 0
  };
}
