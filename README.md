# ZPLN Backend

## Echo Pro username availability and suggestion APIs

The backend now includes production-safe username validation and suggestion APIs for Echo Pro registration. These endpoints use the canonical `UsernameIndex` key for uniqueness enforcement and keep the older `GetUserIdFromUsername` lookup working for backward compatibility.

### Check username availability

Request:
```bash
curl -X GET "https://us-central1-zpln-3be94.cloudfunctions.net/CheckUsernameAvailabilityAPI?userName=John.Doe"
```

Success response:
```json
{
  "success": true,
  "username": "John.Doe",
  "normalizedUsername": "john.doe",
  "available": true
}
```

Invalid response:
```json
{
  "success": false,
  "error": "Username must be 3-20 characters long."
}
```

### Suggest usernames

Request:
```bash
curl -X GET "https://us-central1-zpln-3be94.cloudfunctions.net/SuggestEchoProUsernamesAPI?firstName=John&lastName=Doe"
```

Success response:
```json
{
  "success": true,
  "suggestions": ["johndoe", "john_doe", "johnd"]
}
```

### Legacy compatibility

The previous user lookup remains available:
```bash
curl -X GET "https://us-central1-zpln-3be94.cloudfunctions.net/GetUserIdFromUsername?userName=John.Doe"
```

### Deployment notes

- Staging / production URLs should be updated to the actual Firebase project once deployed.
- The API allowlist includes the production web app domain and `localhost:4200` for development.
- Username validation enforces lowercase normalization and rejects unsupported characters.

See [USERNAME_API.md](USERNAME_API.md) for the full contract and samples.