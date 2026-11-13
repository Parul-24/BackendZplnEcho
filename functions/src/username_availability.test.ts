import test = require("node:test");
import assert = require("node:assert/strict");

import {
  generateUsernameSuggestions,
  getUsernameIndexKey,
  isUsernameAvailableInStore,
  normalizeUsernameInput,
  validateUsername
} from "./username_availability";

test("validation accepts a standard username format", () => {
  const result = validateUsername("John.Doe_99");

  assert.equal(result.valid, true);
  assert.equal(result.normalized, "john.doe_99");
});

test("validation rejects invalid length and unsupported characters", () => {
  assert.deepEqual(validateUsername("ab"), {
    valid: false,
    normalized: "ab",
    error: "Username must be 3-20 characters long."
  });

  assert.deepEqual(validateUsername("john@doe"), {
    valid: false,
    normalized: "john@doe",
    error: "Username can only contain letters, numbers, dots, and underscores."
  });
});

test("normalization trims whitespace and lowercases the username", () => {
  assert.equal(normalizeUsernameInput("  John.Doe  "), "john.doe");
});

test("database username index keys are safe for Firebase child paths", () => {
  const key = getUsernameIndexKey("John.Doe_99");

  assert.equal(key, Buffer.from("john.doe_99", "utf8").toString("base64url"));
  assert.ok(!key.includes("."));
  assert.ok(!key.includes("#"));
  assert.ok(!key.includes("$"));
});

test("suggestion generation yields deduplicated and valid candidates", () => {
  const suggestions = generateUsernameSuggestions("John", "Doe", "john");

  assert.ok(suggestions.length >= 2 && suggestions.length <= 3);
  assert.ok(suggestions.includes("johndoe"));
  assert.ok(suggestions.every((suggestion) => suggestion.length <= 20));
  assert.ok(suggestions.every((suggestion) => !suggestion.includes("@")));
});

test("integration: existing canonical username is unavailable", async () => {
  const store = new Map<string, string>([["john.doe", "user-1"]]);

  assert.equal(await isUsernameAvailableInStore("John.Doe", store), false);
  assert.equal(await isUsernameAvailableInStore("jane_doe", store), true);
});

test("integration: suggestions only include available options from the canonical store", async () => {
  const store = new Map<string, string>([
    ["johndoe", "user-1"],
    ["john_doe", "user-2"],
    ["johnd", "user-3"]
  ]);

  const suggestions = generateUsernameSuggestions("John", "Doe", null);
  const availableSuggestions = [] as string[];

  for (const suggestion of suggestions) {
    const available = await isUsernameAvailableInStore(suggestion, store);
    if (available) {
      availableSuggestions.push(suggestion);
    }
  }

  assert.ok(availableSuggestions.length >= 1);
  assert.ok(!availableSuggestions.includes("johndoe"));
});
