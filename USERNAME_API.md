# Echo Pro Username Availability API

This document covers the production-safe username availability and suggestion endpoints used during Echo Pro registration.

## Canonical uniqueness source

Username uniqueness is enforced against the canonical Realtime Database index at `UsernameIndex`, keyed by the normalized lowercase username. This is the same source used during account creation and when updating usernames, which keeps behavior consistent and prevents race conditions.

## CORS allowlist

Allowed origins:
- `https://zpln-3be94.web.app`
- `https://echopro.vip`
- `http://localhost:4200`
- `https://localhost:4200`

## Endpoints

### 1) CheckUsernameAvailabilityAPI

Method: `GET`

Query parameters:
- `userName` (required)

Validation:
- trim + lowercase normalization
- allowed characters: letters, numbers, dot, underscore
- length: 3-20

Successful response:
```json
{
  "success": true,
  "username": "John.Doe",
  "normalizedUsername": "john.doe",
  "available": true
}
```

Invalid input response:
```json
{
  "success": false,
  "error": "Username must be 3-20 characters long."
}
```

Server failure response:
```json
{
  "success": false,
  "error": "Unable to verify username availability right now."
}
```

### 2) SuggestEchoProUsernamesAPI

Method: `GET`

Query parameters:
- `firstName` (required if `lastName` is missing)
- `lastName` (required if `firstName` is missing)
- `currentUserName` (optional, ignored when it matches the suggested candidate)

Successful response:
```json
{
  "success": true,
  "suggestions": ["johndoe", "john_doe", "johnd"]
}
```

Invalid input response:
```json
{
  "success": false,
  "error": "First name or last name is required."
}
```

Server failure response:
```json
{
  "success": false,
  "error": "Unable to generate username suggestions right now."
}
```

## Suggested curl examples

```bash
curl -X GET "https://us-central1-zpln-3be94.cloudfunctions.net/CheckUsernameAvailabilityAPI?userName=John.Doe"

curl -X GET "https://us-central1-zpln-3be94.cloudfunctions.net/SuggestEchoProUsernamesAPI?firstName=John&lastName=Doe"
```

## Staging and production URLs

> Update these values after deployment if your project uses a custom domain or separate staging Firebase project.

Production:
- `https://us-central1-zpln-3be94.cloudfunctions.net/CheckUsernameAvailabilityAPI`
- `https://us-central1-zpln-3be94.cloudfunctions.net/SuggestEchoProUsernamesAPI`

Staging:
- `https://us-central1-zplndev.cloudfunctions.net/CheckUsernameAvailabilityAPI`
- `https://us-central1-zplndev.cloudfunctions.net/SuggestEchoProUsernamesAPI`

## Backward compatibility

The legacy `GetUserIdFromUsername` endpoint remains in place and continues to resolve the user id using the same canonical username index.
