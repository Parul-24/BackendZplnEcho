import * as assert from "assert";
import { test } from "node:test";

import {
  buildPhoneSyncUpdatePayload,
  getBearerTokenFromAuthorizationHeader,
  normalizePhoneNumber,
} from "./index";

test("getBearerTokenFromAuthorizationHeader extracts the token without whitespace", () => {
  assert.equal(getBearerTokenFromAuthorizationHeader("Bearer abc123"), "abc123");
  assert.equal(getBearerTokenFromAuthorizationHeader("Bearer   abc123   "), "abc123");
  assert.equal(getBearerTokenFromAuthorizationHeader("Basic abc123"), null);
  assert.equal(getBearerTokenFromAuthorizationHeader(undefined), null);
});

test("normalizePhoneNumber strips spaces and keeps the E.164 value", () => {
  assert.equal(normalizePhoneNumber(" +1 (555) 123-4567 "), "+15551234567");
  assert.equal(normalizePhoneNumber(""), null);
  assert.equal(normalizePhoneNumber(null), null);
});

test("buildPhoneSyncUpdatePayload is idempotent and keeps verified phone metadata", () => {
  const payload = buildPhoneSyncUpdatePayload("uid_123", "+15551234567", { phone: "+15551234567" });

  assert.deepEqual(payload, {
    firebaseUid: "uid_123",
    phone: "+15551234567",
    phoneVerified: true,
    phoneVerifiedAt: payload.phoneVerifiedAt,
    updatedAt: payload.updatedAt,
  });

  assert.throws(() => {
    buildPhoneSyncUpdatePayload("uid_123", "+15551234567", { phone: "+15557654321" });
  }, /Phone mismatch/);
});
