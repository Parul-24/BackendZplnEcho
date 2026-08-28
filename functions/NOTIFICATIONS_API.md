# Notification System and APIs

This document describes the team-join reward notification flow and the APIs the frontend can use to display unread/read notification state.

## Overview

When a user joins another user's team, the backend now performs three actions:

1. It updates the genealogy tree as usual.
2. If the parent is in one of the rewardable mining ranks, the backend adds Zpln to the parent's vault.
3. It creates a notification for the parent describing who joined and how much Zpln was added.

The current reward rule is:

- Rewardable ranks: `Agent`, `Builder`, `Specialist`, `Architect`
- Reward amount: `20` Zpln
- No duplicate reward is created for the same parent-child pair; a ledger entry prevents double processing.

## Data Model

Notification records are stored under:

- `Users/{userId}/notifications/{notificationId}`

Notification summary data is stored under:

- `Users/{userId}/notificationsSummary`

Reward ledger entries are stored under:

- `Users/{parentUserId}/teamJoinRewardLedger/{childUserId}`

### Notification record shape

```json
{
  "notificationId": "auto-generated-id",
  "type": "team_join_reward",
  "title": "SAM joined your team",
  "message": "20 Zpln tokens were added because SAM joined your team.",
  "createdAt": 1751443200000,
  "read": false,
  "readAt": null,
  "amount": 20,
  "actorUserId": "child-user-id",
  "actorUserName": "SAM",
  "actorSavedAvatarURL": "https://...",
  "targetUserId": "parent-user-id",
  "targetUserName": "Parent Name",
  "metadata": {
    "childUserId": "child-user-id",
    "childUserName": "SAM",
    "parentUserId": "parent-user-id",
    "parentUserName": "Parent Name",
    "parentRank": 2,
    "parentRankName": "Agent",
    "amount": 20,
    "rewardedAt": 1751443200000
  }
}
```

### Summary shape

```json
{
  "unreadCount": 3,
  "readCount": 12,
  "totalCount": 15,
  "lastNotificationAt": 1751443200000
}
```

## APIs

All endpoints are HTTPS Cloud Functions.

### 1) GetUserNotificationsAPI

Returns a notification list plus summary counts.

#### Request

```text
/GetUserNotificationsAPI?userId=USER_ID&limit=20&unreadOnly=false
```

#### Query params

- `userId` required
- `limit` optional, default `20`
- `unreadOnly` optional, set to `true` to return only unread items

#### Response

```json
{
  "Action": "GetUserNotificationsAPI",
  "UserId": "USER_ID",
  "Summary": {
    "unreadCount": 3,
    "readCount": 12,
    "totalCount": 15,
    "lastNotificationAt": 1751443200000
  },
  "Notifications": [
    {
      "notificationId": "notif_abc123",
      "type": "team_join_reward",
      "title": "SAM joined your team",
      "message": "20 Zpln tokens were added because SAM joined your team.",
      "createdAt": 1751443200000,
      "read": false,
      "readAt": null,
      "amount": 20,
      "actorUserId": "child-user-id",
      "actorUserName": "SAM",
      "actorSavedAvatarURL": "https://...",
      "targetUserId": "parent-user-id",
      "targetUserName": "Parent Name"
    }
  ]
}
```

### 2) MarkNotificationAsReadAPI

Marks a single notification as read.

#### Request

```text
/MarkNotificationAsReadAPI?userId=USER_ID&notificationId=NOTIFICATION_ID
```

#### Response

```json
{
  "Action": "MarkNotificationAsReadAPI",
  "UserId": "USER_ID",
  "NotificationId": "NOTIFICATION_ID",
  "Success": true,
  "Summary": {
    "unreadCount": 2,
    "readCount": 13,
    "totalCount": 15,
    "lastNotificationAt": 1751443200000
  }
}
```

### 3) MarkAllNotificationsAsReadAPI

Marks all notifications for a user as read.

#### Request

```text
/MarkAllNotificationsAsReadAPI?userId=USER_ID
```

#### Response

```json
{
  "Action": "MarkAllNotificationsAsReadAPI",
  "UserId": "USER_ID",
  "Summary": {
    "unreadCount": 0,
    "readCount": 15,
    "totalCount": 15,
    "lastNotificationAt": 1751443200000
  }
}
```

## Frontend Integration Notes

- Fetch notifications when the user opens the inbox or after a join event.
- Use `Summary.unreadCount` for the badge.
- Use `Notifications[].read` to render read/unread state.
- Use `Notifications[].createdAt` to show time.
- Use `actorUserName` and `actorSavedAvatarURL` to render who joined.
- Use `amount` and `message` to explain the reward.
- After calling one of the read APIs, refresh the notifications list or use the returned `Summary` to update the badge locally.

## Server-Side Behavior

- The reward is created when the parent-child connection is written.
- The same parent-child pair is only rewarded once.
- The notification message is generated server-side so the frontend does not need to calculate reward text.
- The reward amount is currently fixed at 20 Zpln for the rewardable ranks.

## Notes for Future Rank Changes

If rank labels or reward rules change later, update the centralized rank configuration and reward helper in `functions/src/vault.ts`. The notification APIs will continue to work without frontend changes as long as the response shape stays the same.