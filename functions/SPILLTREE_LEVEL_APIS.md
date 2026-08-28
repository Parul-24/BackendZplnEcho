# SpillTree Level APIs

This document covers simple usage and response formats for all SpillTree level APIs.

## Base URL

Use your deployed Cloud Functions base URL, for example:

- `https://<region>-<project>.cloudfunctions.net`

---

## 1) GetSpillTreeLevel1API

Returns direct level-1 children from SpillTree for a user (max 5).

### Usage

GET

```text
/GetSpillTreeLevel1API?userId=USER_ID
```

POST body

```json
{
  "userId": "USER_ID"
}
```

### Response (example)

```json
{
  "success": true,
  "userId": "USER_ID",
  "totalChildren": 3,
  "childrenIds": ["U1", "U2", "U3"],
  "children": [
    {
      "userId": "U1",
      "userName": "John D",
      "firstName": "John",
      "lastName": "Doe",
      "name": "John Doe",
      "existsInUsersDb": true
    }
  ]
}
```

---

## 2) GetSpillTreeLevel2API

Returns level-2 children for a user (children of level-1 users, max 25).

### Usage

GET

```text
/GetSpillTreeLevel2API?userId=USER_ID
```

POST body

```json
{
  "userId": "USER_ID"
}
```

### Response (example)

```json
{
  "success": true,
  "userId": "USER_ID",
  "level1Count": 5,
  "level1ChildrenIds": ["L1A", "L1B", "L1C", "L1D", "L1E"],
  "totalLevel2Children": 12,
  "level2ChildrenIds": ["L2A", "L2B"],
  "children": [
    {
      "userId": "L2A",
      "userName": "Jane S",
      "firstName": "Jane",
      "lastName": "Smith",
      "name": "Jane Smith",
      "existsInUsersDb": true
    }
  ]
}
```

---

## 3) GetSpillTreeLevel3API

Returns level-3 children for a user (children of level-2 users, max 125).

### Usage

GET

```text
/GetSpillTreeLevel3API?userId=USER_ID
```

POST body

```json
{
  "userId": "USER_ID"
}
```

### Response (example)

```json
{
  "success": true,
  "userId": "USER_ID",
  "level1Count": 5,
  "level1ChildrenIds": ["L1A", "L1B"],
  "level2Count": 25,
  "level2ChildrenIds": ["L2A", "L2B"],
  "totalLevel3Children": 40,
  "level3ChildrenIds": ["L3A", "L3B"],
  "children": [
    {
      "userId": "L3A",
      "userName": "Alex K",
      "firstName": "Alex",
      "lastName": "King",
      "name": "Alex King",
      "existsInUsersDb": true
    }
  ]
}
```

---

## 4) GetSpillTreeLevel1To3API

Returns all levels together: L1 + L2 + L3.

### Usage

GET

```text
/GetSpillTreeLevel1To3API?userId=USER_ID
```

POST body

```json
{
  "userId": "USER_ID"
}
```

### Response (example)

```json
{
  "success": true,
  "userId": "USER_ID",
  "level1Count": 5,
  "level2Count": 25,
  "level3Count": 80,
  "totalChildren": 110,
  "level1ChildrenIds": ["L1A"],
  "level2ChildrenIds": ["L2A"],
  "level3ChildrenIds": ["L3A"],
  "allChildrenIds": ["L1A", "L2A", "L3A"],
  "allChildren": [
    {
      "userId": "L2A",
      "level": 2,
      "userName": "Mary P",
      "firstName": "Mary",
      "lastName": "Parker",
      "name": "Mary Parker",
      "existsInUsersDb": true
    }
  ]
}
```

---

## Notes

- `userId` and `uid` are both accepted by these APIs.
- If the user has no SpillTree node or no children at that level, APIs return success with empty arrays.
- Max limits are controlled by SpillTree rule (direct children max 5):
  - L1 max = 5
  - L2 max = 25
  - L3 max = 125
