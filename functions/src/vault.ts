import * as admin from "firebase-admin";
import * as tournament from "./tournament";
import * as leaderboards from "./leaderboards";
import * as mailer from "./mailer";
import * as utils from './utils';

import DataSnapshot = admin.database.DataSnapshot;

export const Vault_User_DB = "vault";
export const Coins_Vault_User_DB = "coins";
export const CoinsValue_Vault_User_DB = "coinsValue";
export const Cash_Vault_User_DB = "cash";
export const CashAmountReceived = "cashAmountReceived";
export const CashBalance = "cashBalance";
export const CoinsConversions_Vault_User_DB = "coinsConversions"
export const Lira_Vault_User_DB = "lira";
export const Lira_Mined_User_DB = "liraMined";
export const ZplnMinned_Vault_User_DB = "NeoZplnMining";
export const LastweekZplnMining_Vault_User_DB = "LastWeekZplnMined";
export const miningRate_Vault_User_DB = "NeoMiningRate";
export const MiningRank_Vault_User_DB = "MiningRank";
export const MiningRank_LastCalculatedAt_Vault_User_DB = "MiningRankLastCalculatedAt";
export const MiningRank_NeedsRefresh_Vault_User_DB = "MiningRankNeedsRefresh";
export const MiningRank_RefreshIntervalMs = 24 * 60 * 60 * 1000;
export const isEchoMember_Vault_User_DB = "isEchoMember";
export const Bonk_Vault_User_DB = "BONK_Tokens";
export const Zdlt_Vault_User_DB = "ZDLT_Tokens";
export const Digi_Vault_User_DB = "DIGI_Tokens";
export const Pvs_Vault_User_DB = "PVS_Tokens";
export const Maka_Vault_User_DB = "Maka_Token";

export const UserNotifications_DB = "notifications";
export const UserNotificationsSummary_DB = "notificationsSummary";
export const TeamJoinRewardLedger_DB = "teamJoinRewardLedger";
export const TeamJoinRewardAmount_Zpln = 20;

export const IsVIP_User_DB = "isVIP";

const Lira_To_Coins_ConversionRate = 1000;
export const Lira_Mining_Limit_Per_Day = 10000;

const Minimum_Cash_For_Conversion = 20.0;

// Replace PlayRanks with new ladder and add thresholds
enum PlayRanks {
  Celestial = 1,
  Alpha = 2,
  Delta = 3,
  Sigma = 4,
  Omega = 5,
  Genius = 6
}

// Replace MiningRanks with full circle ladder
enum MiningRanks {
  Default = 1,   // base => Player
  VIP = 2,    // achieved with 12 members => Agent
  Agent = 3,   // achieved with 12 Starborn children => Builder
  Expert = 4,     // achieved with 12 Architect children => Specialist
  Specialist = 5,      // achieved with 12 Solaris children => Architect
  Phantom = 6, // Phantom 1
  Level6 = 7 , // Phantom 2
  Level7=8, // Phantom 3
  Level8=9 // achieved with 12 Apollo children // Phantom 4
}

/**
 * DESIGNER-FACING DISPLAY NAMES for MiningRanks.
 * -----------------------------------------------
 * Only edit THIS object when the designer renames a rank.
 * All code reads display names from here via getMiningRankDisplayName().
 * The enum keys and numeric values above must never change.
 */
export const MiningRankDisplayNames: Record<MiningRanks, string> = {
  [MiningRanks.Default]:    "Player",
  [MiningRanks.VIP]:        "Agent",
  [MiningRanks.Agent]:      "Builder",
  [MiningRanks.Expert]:     "Specialist",
  [MiningRanks.Specialist]: "Architect",
  [MiningRanks.Phantom]:    "Phantom1",
  [MiningRanks.Level6]:     "Phantom2",
  [MiningRanks.Level7]:     "Phantom3",
  [MiningRanks.Level8]:     "Phantom4",
};

/**
 * Returns the display name for a MiningRank enum value.
 * Use this everywhere a human-readable rank name is needed.
 */
export function getMiningRankDisplayName(rank: number): string {
  return MiningRankDisplayNames[rank as MiningRanks] ?? "Player";
}

export interface UserNotificationRecord {
  notificationId?: string;
  type: string;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  readAt: number | null;
  amount?: number;
  actorUserId?: string;
  actorUserName?: string;
  actorSavedAvatarURL?: string;
  targetUserId?: string;
  targetUserName?: string;
  targetSavedAvatarURL?: string;
  metadata?: Record<string, unknown>;
}

export interface UserNotificationSummary {
  unreadCount: number;
  readCount: number;
  totalCount: number;
  lastNotificationAt: number | null;
}

function getUserNotificationsRef(userId: string) {
  return admin.database().ref(`${tournament.Users_DB}/${userId}/${UserNotifications_DB}`);
}

function getUserNotificationsSummaryRef(userId: string) {
  return admin.database().ref(`${tournament.Users_DB}/${userId}/${UserNotificationsSummary_DB}`);
}

function getTeamJoinRewardLedgerRef(parentUserId: string, childUserId: string) {
  return admin.database().ref(`${tournament.Users_DB}/${parentUserId}/${TeamJoinRewardLedger_DB}/${childUserId}`);
}

function getTeamJoinRewardAmountForRank(rank: number): number {
  switch (rank) {
    case MiningRanks.VIP:
    case MiningRanks.Agent:
    case MiningRanks.Expert:
    case MiningRanks.Specialist:
      return TeamJoinRewardAmount_Zpln;
    default:
      return 0;
  }
}

async function getUserDisplayDetails(userId: string): Promise<{ userName: string; savedAvatarURL: string }> {
  const snap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
  if (!snap.exists()) {
    return { userName: userId, savedAvatarURL: "" };
  }

  const firstName = String(snap.child("firstName").val() || "").trim();
  const lastName = String(snap.child("lastName").val() || "").trim();
  const userName = String(snap.child("userName").val() || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    userName: fullName || userName || userId,
    savedAvatarURL: String(snap.child("SavedAvatarURL").val() || snap.child("profilePicture").val() || "")
  };
}

async function updateNotificationSummary(userId: string, deltaUnread: number, deltaRead: number, deltaTotal: number, lastNotificationAt?: number | null): Promise<void> {
  await getUserNotificationsSummaryRef(userId).transaction((current) => {
    const safe = current || {};
    const previousLastNotificationAt = safe.lastNotificationAt ? Number(safe.lastNotificationAt) : null;
    return {
      unreadCount: Number(safe.unreadCount || 0) + deltaUnread,
      readCount: Number(safe.readCount || 0) + deltaRead,
      totalCount: Number(safe.totalCount || 0) + deltaTotal,
      lastNotificationAt: lastNotificationAt !== undefined ? lastNotificationAt : previousLastNotificationAt
    };
  });
}

export async function createUserNotification(userId: string, notification: Omit<UserNotificationRecord, "notificationId">): Promise<UserNotificationRecord | null> {
  if (!userId) return null;

  const createdAt = Number(notification.createdAt || Date.now());
  const notificationRef = getUserNotificationsRef(userId).push();
  if (!notificationRef.key) return null;

  const record: UserNotificationRecord = {
    ...notification,
    notificationId: notificationRef.key,
    createdAt,
    read: Boolean(notification.read),
    readAt: notification.readAt ?? null
  };

  await notificationRef.set(record);
  await updateNotificationSummary(userId, record.read ? 0 : 1, record.read ? 1 : 0, 1, record.createdAt);
  return record;
}

export async function getUserNotifications(userId: string, limit: number = 20, unreadOnly: boolean = false): Promise<{
  summary: UserNotificationSummary;
  notifications: UserNotificationRecord[];
}> {
  const summarySnap = await getUserNotificationsSummaryRef(userId).once("value");
  const summary: UserNotificationSummary = {
    unreadCount: Number(summarySnap.child("unreadCount").val() || 0),
    readCount: Number(summarySnap.child("readCount").val() || 0),
    totalCount: Number(summarySnap.child("totalCount").val() || 0),
    lastNotificationAt: summarySnap.child("lastNotificationAt").exists() ? Number(summarySnap.child("lastNotificationAt").val() || 0) : null
  };

  const snap = await getUserNotificationsRef(userId).orderByChild("createdAt").limitToLast(Math.max(1, Math.min(100, Math.floor(limit || 20)))).once("value");
  const notifications: UserNotificationRecord[] = [];

  snap.forEach((childSnap) => {
    const item = childSnap.val() as UserNotificationRecord;
    if (unreadOnly && item.read) return false;
    notifications.push({ ...item, notificationId: childSnap.key || item.notificationId });
    return false;
  });

  notifications.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return { summary, notifications };
}

export async function markUserNotificationAsRead(userId: string, notificationId: string): Promise<boolean> {
  if (!userId || !notificationId) return false;

  const notificationRef = getUserNotificationsRef(userId).child(notificationId);
  const snapshot = await notificationRef.once("value");
  if (!snapshot.exists()) return false;
  if (Boolean(snapshot.child("read").val())) return true;

  const readAt = Date.now();
  await notificationRef.update({ read: true, readAt });
  await updateNotificationSummary(userId, -1, 1, 0, readAt);
  return true;
}

export async function markAllUserNotificationsAsRead(userId: string): Promise<UserNotificationSummary> {
  const notificationsRef = getUserNotificationsRef(userId);
  const summarySnap = await getUserNotificationsSummaryRef(userId).once("value");
  const summary: UserNotificationSummary = {
    unreadCount: Number(summarySnap.child("unreadCount").val() || 0),
    readCount: Number(summarySnap.child("readCount").val() || 0),
    totalCount: Number(summarySnap.child("totalCount").val() || 0),
    lastNotificationAt: summarySnap.child("lastNotificationAt").exists() ? Number(summarySnap.child("lastNotificationAt").val() || 0) : null
  };

  const allNotificationsSnap = await notificationsRef.once("value");
  const unreadNotifications: UserNotificationRecord[] = [];
  allNotificationsSnap.forEach((childSnap) => {
    const item = childSnap.val() as UserNotificationRecord;
    if (!item.read) {
      unreadNotifications.push({ ...item, notificationId: childSnap.key || item.notificationId });
    }
    return false;
  });
  const readAt = Date.now();

  const updates: Record<string, unknown> = {};
  unreadNotifications.forEach((item) => {
    if (item.notificationId) {
      updates[`${item.notificationId}/read`] = true;
      updates[`${item.notificationId}/readAt`] = readAt;
    }
  });

  if (Object.keys(updates).length > 0) {
    await notificationsRef.update(updates);
  }

  const unreadCount = unreadNotifications.length;
  const nextSummary: UserNotificationSummary = {
    unreadCount: 0,
    readCount: summary.readCount + unreadCount,
    totalCount: summary.totalCount,
    lastNotificationAt: summary.lastNotificationAt
  };

  await getUserNotificationsSummaryRef(userId).set(nextSummary);
  return nextSummary;
}

export async function rewardParentForNewChildJoin(parentUserId: string, childUserId: string): Promise<{ rewarded: boolean; amount: number; notification: UserNotificationRecord | null }> {
  if (!parentUserId || !childUserId) return { rewarded: false, amount: 0, notification: null };

  const ledgerRef = getTeamJoinRewardLedgerRef(parentUserId, childUserId);
  const ledgerSnap = await ledgerRef.once("value");
  if (ledgerSnap.exists()) {
    return { rewarded: false, amount: Number(ledgerSnap.child("amount").val() || 0), notification: null };
  }

  const parentSnap = await admin.database().ref(`${tournament.Users_DB}/${parentUserId}`).once("value");
  if (!parentSnap.exists()) {
    return { rewarded: false, amount: 0, notification: null };
  }

  const parentRank = Number(parentSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).val() || MiningRanks.Default);
  const rewardAmount = getTeamJoinRewardAmountForRank(parentRank);
  if (rewardAmount <= 0) {
    return { rewarded: false, amount: 0, notification: null };
  }

  const childDetails = await getUserDisplayDetails(childUserId);
  const parentDetails = await getUserDisplayDetails(parentUserId);
  const rewardAt = Date.now();

  const rewardRecord = {
    childUserId,
    childUserName: childDetails.userName,
    childSavedAvatarURL: childDetails.savedAvatarURL,
    parentUserId,
    parentUserName: parentDetails.userName,
    parentRank,
    parentRankName: getMiningRankDisplayName(parentRank),
    amount: rewardAmount,
    rewardedAt: rewardAt
  };

  await ledgerRef.set(rewardRecord);

  await admin.database().ref(`${tournament.Users_DB}/${parentUserId}/${Vault_User_DB}/${ZplnMinned_Vault_User_DB}`).transaction((current) => {
    return Number(current || 0) + rewardAmount;
  });

  const notification = await createUserNotification(parentUserId, {
    type: "team_join_reward",
    title: `${childDetails.userName} joined your team`,
    message: `${rewardAmount} Zpln tokens were added because ${childDetails.userName} joined your team.`,
    createdAt: rewardAt,
    read: false,
    readAt: null,
    amount: rewardAmount,
    actorUserId: childUserId,
    actorUserName: childDetails.userName,
    actorSavedAvatarURL: childDetails.savedAvatarURL,
    targetUserId: parentUserId,
    targetUserName: parentDetails.userName,
    metadata: rewardRecord
  });

  return { rewarded: true, amount: rewardAmount, notification };
}


const TOKEN_TO_VAULT_KEY: Record<string,string> = {
  coins: Coins_Vault_User_DB,
  cash: Cash_Vault_User_DB,
  bonk: Bonk_Vault_User_DB,
  zdlt: Zdlt_Vault_User_DB,
  digi: Digi_Vault_User_DB,
  pvs: Pvs_Vault_User_DB,
  maka: Maka_Vault_User_DB
};

export async function AddPrizeTokensToVault(userId: string, prize: Record<string, number>): Promise<Record<string, {
  raw: number;
  miningRate: number;
  credited: number;
  total: number;
}>> {
  if (!userId) return {};
  
  // Read user's current miningRate
  const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once('value');
  if (!userSnap.exists()) return {};
  
  const miningRate = userSnap.child(`${Vault_User_DB}/${miningRate_Vault_User_DB}`).exists()
    ? Number(userSnap.child(`${Vault_User_DB}/${miningRate_Vault_User_DB}`).val())
    : 0.1; // default fallback
  
  const added: Record<string, any> = {};
  const baseRef = admin.database().ref(`${tournament.Users_DB}/${userId}/${Vault_User_DB}`);
  
  for (const k of Object.keys(prize)) {
    const rawAmt = Number(prize[k] || 0);
    if (rawAmt <= 0) continue;
    
    const vaultKey = TOKEN_TO_VAULT_KEY[k];
    if (!vaultKey) continue;
    
    // Apply miningRate multiplier
    const creditedAmt = Number((rawAmt * miningRate).toFixed(4));
    
    const ref = baseRef.child(vaultKey);
    const tx = await ref.transaction(cur => (Number(cur || 0) + creditedAmt));
    
    if (tx.committed) {
      const total = Number(tx.snapshot?.val() || 0);
      added[k] = {
        raw: rawAmt,
        miningRate,
        credited: creditedAmt,
        total
      };
    }
  }
  return added;
}



//#region Initialize Vaults operations

export async function InitializeAllPlayersVault(migrate:boolean=false): Promise<boolean> {
    const usersData = await admin.database().ref(tournament.Users_DB).once("value");

    const allPromises:Promise<boolean>[] = []
    usersData.forEach((user)=>{
        allPromises.push(InitializeVault(user.key, migrate))
    });

    const results = await Promise.all(allPromises)
    const result = results.reduce((prev,curr)=>prev && curr)
    return result;
}

export async function InitializeVault(userId: string|null, migrate: boolean=false): Promise<boolean>{

    if (userId === null) return false;

    const userDb = await admin.database().ref(tournament.Users_DB+"/"+userId).once('value');
    if (!userDb.exists())
        return false;

    let initCoins = 5; // default starting coins 5 Tokens
    let initCoinsValue = 0.0;
    let initCash = 0.0;
    if (migrate) {
        initCoins = userDb.child("coins").exists()?userDb.child("coins").val():0;
        initCoinsValue = userDb.child("coinsValue").exists()?userDb.child("coinsValue").val():0.0
        initCash = userDb.child("cash").exists()?userDb.child("cash").val():0.0;
    } else {
        await leaderboards.resetPlayerLevel(userId);
    }
   await userDb.ref.update( // default vault structure
    {
      [Vault_User_DB]: {
          [Coins_Vault_User_DB]: initCoins,
          [CoinsValue_Vault_User_DB]: initCoinsValue,
          [Cash_Vault_User_DB]: initCash,
          [Lira_Vault_User_DB]: 0,
          [Lira_Mined_User_DB]: 0,
          [ZplnMinned_Vault_User_DB]: 0.0, // new zpln minned
        [miningRate_Vault_User_DB]: 0.1 , // intial ming rate
            [LastweekZplnMining_Vault_User_DB]: 0.0 ,
            [MiningRank_Vault_User_DB]: MiningRanks.Default,
            [isEchoMember_Vault_User_DB]: false
      }
    });

    return true;
}

export async function InitializeLiraVault(userId: string|null): Promise<boolean>{
    if (userId === null) return false;
    const userDb = await admin.database().ref(tournament.Users_DB+"/"+userId).once('value');
    if (!userDb.exists())
        return false;

    return InitializeLiraVaultWithUser(userDb);

}

export async function InitializeLiraVaultWithUser(userDb: DataSnapshot): Promise<boolean>{
    await userDb.ref.update(
        {
            [Vault_User_DB]: {
                [Lira_Vault_User_DB]: 0,
                [Lira_Mined_User_DB]: 0
            }
        });

    return true;
}

export async function InitializeLiraVaultForAllUsers(): Promise<number> {
    const allUsers = await admin.database().ref(tournament.Users_DB).once('value');
    const allPromises: any[] = [];

    allUsers.forEach(function(data) {
        if (data.key!==null){
            allPromises.push(InitializeLiraVaultWithUser(data));
        }
    });
    await Promise.all(allPromises);
    return allPromises.length;
}
//
export function determinePlayRankFromAverage(globalAverage: number): PlayRanks {
  if (!globalAverage || globalAverage < 60000) return PlayRanks.Celestial;
  if (globalAverage >= 100000) return PlayRanks.Genius;
  if (globalAverage >= 90000) return PlayRanks.Omega;
  if (globalAverage >= 80000) return PlayRanks.Sigma;
  if (globalAverage >= 70000) return PlayRanks.Delta;
  return PlayRanks.Alpha; // >= 60000 and < 70000
}
//#endregion

//#region Mining and Play Ranks
/**
 * Convenience: return the PlayRank name (string) for a numeric globalAverage.
 */
export function determinePlayRankNameFromAverage(globalAverage: number): string {
  return PlayRanks[determinePlayRankFromAverage(globalAverage)];
}

/**
 * Fetch user's globalAverage from DB and return their PlayRank enum value.
 */
export async function getPlayRankForUser(userId: string | null): Promise<PlayRanks | null> {
  if (userId === null) return null;
  const userDb = await admin.database().ref(tournament.Users_DB + "/" + userId).once('value');
  if (!userDb.exists()) return null;
  const globalAverage = userDb.child('globalAverage').exists() ? Number(userDb.child('globalAverage').val()) : 0;
  return determinePlayRankFromAverage(globalAverage);
}

/**
 * Convenience: fetch user's PlayRank name (string).
 */
export async function getPlayRankNameForUser(userId: string | null): Promise<string | null> {
  const rank = await getPlayRankForUser(userId);
  return rank === null ? null : PlayRanks[rank];
}

/**
 * Count sector-1 children (levels 1..3) for a user and tally counts per MiningRank.
 *
 * - children relationship path: Users/{userId}/childrenIds
 * - mining rank stored at: Users/{childId}/vault/MiningRank
 *
 * Returns counts: { Celestialcount, Starborncount, Architectcount, Lightmastercount, total, childIds }
 */
// export async function countSector1ChildrenByMiningRank(userId: string | null): Promise<{
//   Celestialcount: number;
//   Starborncount: number;
//   Architectcount: number;
//   Lightmastercount: number;
//   total: number;
//   childIds: string[];
// }> {
//   if (userId === null) {
//     return { Celestialcount: 0, Starborncount: 0, Architectcount: 0, Lightmastercount: 0, total: 0, childIds: [] };
//   }

//   const counts = {
//     Celestialcount: 0,
//     Starborncount: 0,
//     Architectcount: 0,
//     Lightmastercount: 0,
//     total: 0,
//   };
//   const foundIds: string[] = [];
//   const seen = new Set<string>();

//   // BFS up to depth 3 (levels 1..3)
//   const queue: { id: string; depth: number }[] = [{ id: userId, depth: 0 }];

//   while (queue.length > 0) {
//     const node = queue.shift()!;
//     if (node.depth >= 3) continue; // do not traverse past depth 3

//     const childrenSnap = await admin.database().ref(`${tournament.Users_DB}/${node.id}/childrenIds`).once("value"); 
//     if (!childrenSnap.exists()) continue;

//     const childrenVal = childrenSnap.val();
//     const childIds: string[] = Array.isArray(childrenVal)
//       ? childrenVal.filter(Boolean).map(String)
//       : (typeof childrenVal === "object" ? Object.keys(childrenVal) : []);

//     // Batch fetch child user nodes
//     const childSnaps = await Promise.all(childIds.map(id => admin.database().ref(`${tournament.Users_DB}/${id}`).once("value")));

//     for (let i = 0; i < childIds.length; i++) {
//       const childId = childIds[i];
//       if (!childId || seen.has(childId)) continue;
//       seen.add(childId);
//       foundIds.push(childId);

//       const childSnap = childSnaps[i];
//       // read child's mining rank from vault; default to Celestial if missing
//       const mr = childSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).exists()
//         ? Number(childSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).val())
//         : MiningRanks.Celestial;

//       switch (mr) {
//         case MiningRanks.Celestial:
//           counts.Celestialcount++;
//           break;
//         case MiningRanks.Starborn:
//           counts.Starborncount++;
//           break;
//         case MiningRanks.Architect:
//           counts.Architectcount++;
//           break;
//         case MiningRanks.Lightmaster:
//           counts.Lightmastercount++;
//           break;
//         default:
//           counts.Celestialcount++;
//           break;
//       }

//       counts.total++;

//       // enqueue child for next depth level
//       queue.push({ id: childId, depth: node.depth + 1 });
//     }
//   }

//   return {
//     Celestialcount: counts.Celestialcount,
//     Starborncount: counts.Starborncount,
//     Architectcount: counts.Architectcount,
//     Lightmastercount: counts.Lightmastercount,
//     total: counts.total,
//     childIds: foundIds,
//   };
// }


// Counts direct ("actual") referral children only, ignoring spill-tree placements.
export async function countActualDirectChildren(userId: string | null): Promise<number> {
  if (!userId) return 0;

  const childrenSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}/childrenIds`).once("value");
  if (!childrenSnap.exists()) return 0;

  const raw = childrenSnap.val();
  const ids = Array.isArray(raw)
    ? raw.filter(Boolean).map(String)
    : (raw && typeof raw === "object" ? Object.keys(raw) : []);

  return new Set(ids.map((id) => String(id || "").trim()).filter((id) => id.length > 0)).size;
}

export async function countSector1ChildrenByMiningRank(userId: string | null): Promise<{
  totalMembers: number;
  DefaultCount: number;
  VIPCount: number;
  AgentCount: number;
  ExpertCount: number;
  SpecialistCount: number;
  PhantomCount: number;
  Level6Count: number;
  Level7Count: number;
  Level8Count: number;
  childIds: string[];
}> {
  if (userId === null) {
   return {
      totalMembers: 0,
      DefaultCount: 0, VIPCount: 0, AgentCount: 0, ExpertCount: 0, SpecialistCount: 0,
      PhantomCount: 0, Level6Count: 0, Level7Count: 0, Level8Count: 0,
      childIds: []
    };
  }

  let totalMembers = 0;
  let DefaultCount = 0, VIPCount = 0, AgentCount = 0, ExpertCount = 0, SpecialistCount = 0;
  let PhantomCount = 0, Level6Count = 0, Level7Count = 0, Level8Count = 0;
  const childIds: string[] = [];
  const seen = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: userId, depth: 0 }];

  // Traverse SpillTree descendants up to level 3 (L1-L3).
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.depth >= 3) continue;

    const childrenSnap = await admin.database().ref(`SpillTree/${node.id}/childrenIds`).once("value");
    if (!childrenSnap.exists()) continue;

    const childrenVal = childrenSnap.val();
    const ids: string[] = Array.isArray(childrenVal)
      ? childrenVal.filter(Boolean).map(String)
      : (typeof childrenVal === "object" ? Object.keys(childrenVal) : []);

    const snaps = await Promise.all(ids.map(id => admin.database().ref(`${tournament.Users_DB}/${id}`).once("value")));
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const snap = snaps[i];
      if (!id || seen.has(id) || !snap.exists()) continue;

      seen.add(id);
      childIds.push(id);
      totalMembers++;

      const mr = snap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).exists()
        ? Number(snap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).val())
        : MiningRanks.Default;

      switch (mr) {
        case MiningRanks.Default: DefaultCount++; break;
        case MiningRanks.VIP: VIPCount++; break;
        case MiningRanks.Agent: AgentCount++; break;
        case MiningRanks.Expert: ExpertCount++; break;
        case MiningRanks.Specialist: SpecialistCount++; break;
        case MiningRanks.Phantom: PhantomCount++; break;
        case MiningRanks.Level6: Level6Count++; break;
        case MiningRanks.Level7: Level7Count++; break;
        case MiningRanks.Level8: Level8Count++; break;
        default: DefaultCount++; break;
      }

      queue.push({ id, depth: node.depth + 1 });
    }
  }

  return { totalMembers, DefaultCount: DefaultCount, VIPCount: VIPCount, AgentCount: AgentCount, ExpertCount: ExpertCount, SpecialistCount: SpecialistCount, PhantomCount: PhantomCount, Level6Count: Level6Count, Level7Count: Level7Count, Level8Count: Level8Count, childIds };
}

function getSpillTreeChildIdsFromValue(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v || "").trim())
      .filter((v) => v.length > 0);
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .map((v) => String(v || "").trim())
      .filter((v) => v.length > 0);
  }
  return [];
}

function normalizeTimestamp(...candidates: unknown[]): number {
  for (const raw of candidates) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return Number.MAX_SAFE_INTEGER;
}

function capCountsByMiningRank(
  counts: {
    totalMembers: number;
    DefaultCount: number;
    VIPCount: number;
    AgentCount: number;
    ExpertCount: number;
    SpecialistCount: number;
    PhantomCount: number;
    Level6Count: number;
    Level7Count: number;
    Level8Count: number;
  },
  currentRank: MiningRanks
): typeof counts {
  const rankCap = Number(currentRank || MiningRanks.Default);
  const capped = { ...counts };

  if (rankCap < MiningRanks.VIP) {
    capped.VIPCount = 0;
  }
  if (rankCap < MiningRanks.Agent) {
    capped.AgentCount = 0;
  }
  if (rankCap < MiningRanks.Expert) {
    capped.ExpertCount = 0;
  }
  if (rankCap < MiningRanks.Specialist) {
    capped.SpecialistCount = 0;
  }
  if (rankCap < MiningRanks.Phantom) {
    capped.PhantomCount = 0;
  }
  if (rankCap < MiningRanks.Level6) {
    capped.Level6Count = 0;
  }
  if (rankCap < MiningRanks.Level7) {
    capped.Level7Count = 0;
  }
  if (rankCap < MiningRanks.Level8) {
    capped.Level8Count = 0;
  }

  return capped;
}

function getDisplayProgressCountForMiningRank(
  counts: {
    totalMembers: number;
    DefaultCount: number;
    VIPCount: number;
    AgentCount: number;
    ExpertCount: number;
    SpecialistCount: number;
    PhantomCount: number;
    Level6Count: number;
    Level7Count: number;
    Level8Count: number;
  },
  thresholdRank: MiningRanks
): number {
  const safeThreshold = Number(thresholdRank || MiningRanks.Default);
  const clampToFive = (value: number): number => Math.max(0, Math.min(5, Math.floor(value || 0)));

  switch (safeThreshold) {
    case MiningRanks.Default:
      return clampToFive(counts.totalMembers);
    case MiningRanks.VIP:
      return clampToFive(
        counts.VIPCount + counts.AgentCount + counts.ExpertCount + counts.SpecialistCount + counts.PhantomCount + counts.Level6Count + counts.Level7Count + counts.Level8Count
      );
    case MiningRanks.Agent:
      return clampToFive(
        counts.AgentCount + counts.ExpertCount + counts.SpecialistCount + counts.PhantomCount + counts.Level6Count + counts.Level7Count + counts.Level8Count
      );
    case MiningRanks.Expert:
      return clampToFive(
        counts.ExpertCount + counts.SpecialistCount + counts.PhantomCount + counts.Level6Count + counts.Level7Count + counts.Level8Count
      );
    case MiningRanks.Specialist:
      return clampToFive(
        counts.SpecialistCount + counts.PhantomCount + counts.Level6Count + counts.Level7Count + counts.Level8Count
      );
    case MiningRanks.Phantom:
      return clampToFive(
        counts.PhantomCount + counts.Level6Count + counts.Level7Count + counts.Level8Count
      );
    case MiningRanks.Level6:
      return clampToFive(counts.Level6Count + counts.Level7Count + counts.Level8Count);
    case MiningRanks.Level7:
      return clampToFive(counts.Level7Count + counts.Level8Count);
    case MiningRanks.Level8:
      return clampToFive(counts.Level8Count);
    default:
      return 0;
  }
}

export interface SpillTreeTopPlayerRecord {
  userId: string;
  userName: string;
  savedAvatarURL: string;
  miningRank: number;
  miningRankName: string;
  spillLevel: number;
  joinedAt: number;
}

export async function getTopPlayersInSpillTreeByMiningRank(
  userId: string | null,
  maxLevel: number = 3,
  limit: number = 5
): Promise<{ totalCandidates: number; players: SpillTreeTopPlayerRecord[] }> {
  if (!userId) {
    return { totalCandidates: 0, players: [] };
  }

  const safeMaxLevel = Math.max(1, Math.min(3, Math.floor(Number(maxLevel) || 3)));
  const safeLimit = Math.max(1, Math.min(50, Math.floor(Number(limit) || 5)));

  const queue: Array<{ id: string; depth: number }> = [{ id: userId, depth: 0 }];
  const seen = new Set<string>();
  const candidates: SpillTreeTopPlayerRecord[] = [];

  while (queue.length > 0) {
    const node = queue.shift() as { id: string; depth: number };
    if (node.depth >= safeMaxLevel) continue;

    const childrenSnap = await admin.database().ref(`SpillTree/${node.id}/childrenIds`).once("value");
    const childIds = getSpillTreeChildIdsFromValue(childrenSnap.val());
    if (childIds.length === 0) continue;

    const [spillSnaps, userSnaps] = await Promise.all([
      Promise.all(childIds.map((id) => admin.database().ref(`SpillTree/${id}`).once("value"))),
      Promise.all(childIds.map((id) => admin.database().ref(`${tournament.Users_DB}/${id}`).once("value")))
    ]);

    for (let i = 0; i < childIds.length; i++) {
      const childId = childIds[i];
      if (!childId || seen.has(childId)) continue;
      seen.add(childId);

      const spillSnap = spillSnaps[i];
      const userSnap = userSnaps[i];
      const spillLevel = node.depth + 1;

      queue.push({ id: childId, depth: spillLevel });

      if (!userSnap.exists()) continue;

      const firstName = String(userSnap.child("firstName").val() || "").trim();
      const lastName = String(userSnap.child("lastName").val() || "").trim();
      const userName = String(userSnap.child("userName").val() || "").trim();
      const fullName = `${firstName} ${lastName}`.trim();

      const miningRank = userSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).exists()
        ? Number(userSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).val())
        : MiningRanks.Default;

      const joinedAt = normalizeTimestamp(
        spillSnap.child("joinedAt").val(),
        userSnap.child("joinTimestamp").val(),
        userSnap.child("createdAt").val()
      );

      candidates.push({
        userId: childId,
        userName: fullName || userName || childId,
        savedAvatarURL: String(userSnap.child("SavedAvatarURL").val() || userSnap.child("profilePicture").val() || ""),
        miningRank,
        miningRankName: getMiningRankDisplayName(miningRank),
        spillLevel,
        joinedAt
      });
    }
  }

  candidates.sort((a, b) => {
    if (b.miningRank !== a.miningRank) return b.miningRank - a.miningRank;
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.userId.localeCompare(b.userId);
  });

  return {
    totalCandidates: candidates.length,
    players: candidates.slice(0, safeLimit)
  };
}

/**
 * Calculate play-rank energy boost percent (not as fraction).
 */
export function playRankEnergyPercentFromPlayRank(rank: PlayRanks): number {
  switch (rank) {
    case PlayRanks.Genius:   return 75;
    case PlayRanks.Omega:    return 50;
    case PlayRanks.Sigma:    return 40;
    case PlayRanks.Delta:    return 30;
    case PlayRanks.Alpha:    return 20;
    case PlayRanks.Celestial:
    default:                 return 10;
  }
}

/**
 * Compute sector-1 circle energy boosts (percent) from counts.
 * - starbornEnergyPercent: 1% per Celestial (capped 12%) + +10% if CelestialCount >= 12
 * - architectEnergyPercent: 3% per Starborn (capped 36%) + +25% if StarbornCount >= 12
 * - lightmasterEnergyPercent: 5% per Architect (capped 60%) + +50% if ArchitectCount >= 12
 */
// export function computeSector1CircleEnergyPercents(counts: {
// totalMembers: number;
//   VIPCount: number;
//   AgentCount: number;
//   ExpertCount: number;
//   SpecialistCount: number;
//   Level6Count: number;
//   Level7Count: number;
//   Level8Count: number;
// }) {
//   //const clamp12 = (n: number) => Math.min(n || 0, 5);

//   // // StarBorn Circle: 1% each member, max 12%, +8% bonus if 12 => max 20%
//   // const starbornBase  = clamp12(counts.totalMembers) * 2;
//   // const starbornBonus = 0;// (counts.totalMembers >= 5) ? 10 : 0;
//   // const starbornEnergyPercent = Math.min(starbornBase + starbornBonus, 10);

//   // // Architect Circle: 2% each StarBorn child, max 24%, +16% bonus if 12 => max 40%
//   // const architectBase  = clamp12(counts.Starborncount) * 5;
//   // const architectBonus =0;// (counts.Starborncount >= 5) ? 16 : 0;
//   // const architectEnergyPercent = Math.min(architectBase + architectBonus, 25);

//   // // Solaris Circle: 3% each Architect child, max 36%, +24% bonus if 12 => max 60%
//   // const solarisBase  = clamp12(counts.Architectcount) * 9;
//   // const solarisBonus =0;// (counts.Architectcount >= 5) ? 24 : 0;
//   // const solarisEnergyPercent = Math.min(solarisBase + solarisBonus, 45);

//   // // Apollo Circle: 4% each Solaris child, max 48%, +32% bonus if 12 => max 80%
//   // const apolloBase  = clamp12(counts.Solariscount) * 14;
//   // const apolloBonus =0;// (counts.Solariscount >= 5) ? 32 : 0;
//   // const apolloEnergyPercent = Math.min(apolloBase + apolloBonus, 70);

//   // // LightMaster Circle: 5% each Apollo child, max 60%, +40% bonus if 12 => max 100%
//   // const lightmasterBase  = clamp12(counts.Apollocount) * 20;
//   // const lightmasterBonus = 0;//(counts.Apollocount >= 5) ? 40 : 0;
//   // const lightmasterEnergyPercent = Math.min(lightmasterBase + lightmasterBonus, 100);

//   const clamp5 = (n: number) => Math.min(n || 0, 5);

//   const vipBase = clamp5(counts.totalMembers) * 2;
//   const vipEnergyPercent = Math.min(vipBase, 10);

//   const agentBase = clamp5(counts.VIPCount) * 5;
//   const agentEnergyPercent = Math.min(agentBase, 25);

//   const expertBase = clamp5(counts.AgentCount) * 9;
//   const expertEnergyPercent = Math.min(expertBase, 45);

//   const specialistBase = clamp5(counts.ExpertCount) * 14;
//   const specialistEnergyPercent = Math.min(specialistBase, 70);

//   const phantomBase = clamp5(counts.SpecialistCount) * 20;
//   const phantomEnergyPercent = Math.min(phantomBase, 100);

//   const Level6Base = clamp5(counts.Level6Count) * 1000;
//   const Level6EnergyPercent = Math.min(Level6Base, 5000);

//   const Level7Base = clamp5(counts.Level7Count) * 10000;
//   const Level7EnergyPercent = Math.min(Level7Base, 50000);

//   const Level8Base = clamp5(counts.Level8Count) * 50000;
//   const Level8EnergyPercent = Math.min(Level8Base, 250000);

//   return {
//     vipEnergyPercent,
//     agentEnergyPercent,
//     expertEnergyPercent,
//     specialistEnergyPercent,
//     phantomEnergyPercent,
//     Level6EnergyPercent,
//     Level7EnergyPercent,
//     Level8EnergyPercent
//   };
// }

export function computeSector1CircleEnergyPercents(counts?: {
  totalMembers?: number;
  DefaultCount?: number;
  VIPCount?: number;
  AgentCount?: number;
  ExpertCount?: number;
  SpecialistCount?: number;
  PhantomCount?: number;
  Level6Count?: number;
  Level7Count?: number;
  Level8Count?: number;
}) {
  const safe = {
    totalMembers: Number(counts?.totalMembers ?? 0),
    DefaultCount: Number(counts?.DefaultCount ?? 0),
    VIPCount: Number(counts?.VIPCount ?? 0),
    AgentCount: Number(counts?.AgentCount ?? 0),
    ExpertCount: Number(counts?.ExpertCount ?? 0),
    SpecialistCount: Number(counts?.SpecialistCount ?? 0),
    PhantomCount: Number(counts?.PhantomCount ?? 0),
    Level6Count: Number(counts?.Level6Count ?? 0),
    Level7Count: Number(counts?.Level7Count ?? 0),
    Level8Count: Number(counts?.Level8Count ?? 0),
  };

  const clamp5 = (n: number) => Math.min(n || 0, 5);

  // Default circle energy (NEW)
  const defaultBase = clamp5(safe.DefaultCount) * 1;
  const DefaultEnergyPercent = Math.min(defaultBase, 5);

  // VIP now depends on DefaultCount (NOT totalMembers)
  const vipBase = clamp5(safe.DefaultCount) * 2;
  const vipEnergyPercent = Math.min(vipBase, 10);

  const agentBase = clamp5(safe.VIPCount) * 3;
  const agentEnergyPercent = Math.min(agentBase, 15);

  const expertBase = clamp5(safe.AgentCount) * 4;
  const expertEnergyPercent = Math.min(expertBase, 20);

  const specialistBase = clamp5(safe.ExpertCount) * 5;
  const specialistEnergyPercent = Math.min(specialistBase, 25);

  const phantomBase = clamp5(safe.SpecialistCount) * 100;
  const phantomEnergyPercent = Math.min(phantomBase, 500);

  const Level6Base = clamp5(safe.PhantomCount) * 1000;
  const Level6EnergyPercent = Math.min(Level6Base, 5000);

  const Level7Base = clamp5(safe.Level6Count) * 10000;
  const Level7EnergyPercent = Math.min(Level7Base, 50000);

  const Level8Base = clamp5(safe.Level7Count) * 50000;
  const Level8EnergyPercent = Math.min(Level8Base, 250000);

  return {
    DefaultEnergyPercent,
    vipEnergyPercent,
    agentEnergyPercent,
    expertEnergyPercent,
    specialistEnergyPercent,
    phantomEnergyPercent,
    Level6EnergyPercent,
    Level7EnergyPercent,
    Level8EnergyPercent
  };
}

const TeamGrowthRewardProgress_Vault_User_DB = "teamGrowthRewardProgress";
const TeamGrowthRewardHistory_Vault_User_DB = "teamGrowthRewardHistory";
const TeamGrowthRewardCountCap = 5;

type TeamGrowthCountSnapshot = {
  DefaultCount: number;
  VIPCount: number;
  AgentCount: number;
  ExpertCount: number;
  SpecialistCount: number;
  PhantomCount: number;
  Level6Count: number;
  Level7Count: number;
};

function buildTeamGrowthRewardCountsFromDisplayCounts(displayCounts: {
  playerCount: number;
  agentCount: number;
  builderCount: number;
  specialistCount: number;
  architectCount: number;
  phantom1Count: number;
  phantom2Count: number;
  phantom3Count: number;
  phantom4Count: number;
}): TeamGrowthCountSnapshot {
  return {
    DefaultCount: displayCounts.playerCount,
    VIPCount: displayCounts.agentCount,
    AgentCount: displayCounts.builderCount,
    ExpertCount: displayCounts.specialistCount,
    SpecialistCount: displayCounts.architectCount,
    PhantomCount: displayCounts.phantom1Count,
    Level6Count: displayCounts.phantom2Count,
    Level7Count: displayCounts.phantom3Count,
  };
}

type TeamGrowthRewardSummary = {
  agentMakaReward: number;
  builderMakaReward: number;
  specialistMakaReward: number;
  architectMakaReward: number;
  phantom1CashReward: number;
  phantom2CashReward: number;
  phantom3CashReward: number;
  phantom4CashReward: number;
};

type TeamGrowthRewardPlanEntry = {
  progressKey: string;
  countKey: keyof TeamGrowthCountSnapshot;
  tokenKey: string;
  perPersonAmount: number;
  responseKey: keyof TeamGrowthRewardSummary;
  minRank: MiningRanks;
};

const TEAM_GROWTH_REWARD_PLAN: TeamGrowthRewardPlanEntry[] = [
  { progressKey: "vipBaseCount", countKey: "DefaultCount", tokenKey: Maka_Vault_User_DB, perPersonAmount: 1, responseKey: "agentMakaReward", minRank: MiningRanks.VIP },
  { progressKey: "agentBaseCount", countKey: "VIPCount", tokenKey: Maka_Vault_User_DB, perPersonAmount: 5, responseKey: "builderMakaReward", minRank: MiningRanks.Agent },
  { progressKey: "expertBaseCount", countKey: "AgentCount", tokenKey: Maka_Vault_User_DB, perPersonAmount: 10, responseKey: "specialistMakaReward", minRank: MiningRanks.Expert },
  { progressKey: "specialistBaseCount", countKey: "ExpertCount", tokenKey: Maka_Vault_User_DB, perPersonAmount: 20, responseKey: "architectMakaReward", minRank: MiningRanks.Specialist },
  { progressKey: "phantomBaseCount", countKey: "SpecialistCount", tokenKey: Cash_Vault_User_DB, perPersonAmount: 100, responseKey: "phantom1CashReward", minRank: MiningRanks.Phantom },
  { progressKey: "level6BaseCount", countKey: "PhantomCount", tokenKey: Cash_Vault_User_DB, perPersonAmount: 1000, responseKey: "phantom2CashReward", minRank: MiningRanks.Level6 },
  { progressKey: "level7BaseCount", countKey: "Level6Count", tokenKey: Cash_Vault_User_DB, perPersonAmount: 10000, responseKey: "phantom3CashReward", minRank: MiningRanks.Level7 },
  { progressKey: "level8BaseCount", countKey: "Level7Count", tokenKey: Cash_Vault_User_DB, perPersonAmount: 50000, responseKey: "phantom4CashReward", minRank: MiningRanks.Level8 },
];

function clampRewardCount(n: number): number {
  return Math.max(0, Math.min(TeamGrowthRewardCountCap, Math.floor(Number(n) || 0)));
}

function createEmptyTeamGrowthRewardSummary(): TeamGrowthRewardSummary {
  return {
    agentMakaReward: 0,
    builderMakaReward: 0,
    specialistMakaReward: 0,
    architectMakaReward: 0,
    phantom1CashReward: 0,
    phantom2CashReward: 0,
    phantom3CashReward: 0,
    phantom4CashReward: 0,
  };
}

function buildTeamGrowthRewardSummary(rewardDeltas: Array<{ progressKey: string; creditAmount: number }>): TeamGrowthRewardSummary {
  const summary = createEmptyTeamGrowthRewardSummary();

  for (const delta of rewardDeltas) {
    if (delta.progressKey === "vipBaseCount") {
      summary.agentMakaReward += delta.creditAmount;
    } else if (delta.progressKey === "agentBaseCount") {
      summary.builderMakaReward += delta.creditAmount;
    } else if (delta.progressKey === "expertBaseCount") {
      summary.specialistMakaReward += delta.creditAmount;
    } else if (delta.progressKey === "specialistBaseCount") {
      summary.architectMakaReward += delta.creditAmount;
    } else if (delta.progressKey === "phantomBaseCount") {
      summary.phantom1CashReward += delta.creditAmount;
    } else if (delta.progressKey === "level6BaseCount") {
      summary.phantom2CashReward += delta.creditAmount;
    } else if (delta.progressKey === "level7BaseCount") {
      summary.phantom3CashReward += delta.creditAmount;
    } else if (delta.progressKey === "level8BaseCount") {
      summary.phantom4CashReward += delta.creditAmount;
    }
  }

  return summary;
}

function buildTeamGrowthRewardSummaryFromProgress(
  counts: TeamGrowthCountSnapshot,
  progress: Record<string, unknown>,
  maxEligibleRank: MiningRanks = MiningRanks.Level8
): TeamGrowthRewardSummary {
  const rewardDeltas: Array<{ progressKey: string; creditAmount: number }> = [];

  for (const reward of TEAM_GROWTH_REWARD_PLAN) {
    if (Number(maxEligibleRank) < Number(reward.minRank)) {
      continue;
    }

    const prevCount = clampRewardCount(Number(progress[reward.progressKey] || 0));
    const nowCount = clampRewardCount(counts[reward.countKey]);
    const delta = Math.max(0, nowCount - prevCount);

    if (delta > 0) {
      rewardDeltas.push({
        progressKey: reward.progressKey,
        creditAmount: delta * reward.perPersonAmount
      });
    }
  }

  return buildTeamGrowthRewardSummary(rewardDeltas);
}

async function getPreviewTeamGrowthRewardSummary(
  userId: string,
  counts: TeamGrowthCountSnapshot,
  maxEligibleRank: MiningRanks = MiningRanks.Level8
): Promise<TeamGrowthRewardSummary> {
  const vaultSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}/${Vault_User_DB}`).once("value");
  if (!vaultSnap.exists()) {
    return createEmptyTeamGrowthRewardSummary();
  }

  const progressRaw = vaultSnap.child(TeamGrowthRewardProgress_Vault_User_DB).val();
  const progress = progressRaw && typeof progressRaw === "object"
    ? { ...(progressRaw as Record<string, unknown>) }
    : {};

  return buildTeamGrowthRewardSummaryFromProgress(counts, progress, maxEligibleRank);
}

async function creditTeamGrowthRewards(
  userId: string,
  counts: TeamGrowthCountSnapshot,
  maxEligibleRank: MiningRanks = MiningRanks.Level8
): Promise<TeamGrowthRewardSummary> {
  const vaultRef = admin.database().ref(`${tournament.Users_DB}/${userId}/${Vault_User_DB}`);
  const rewardHistoryRef = vaultRef.child(TeamGrowthRewardHistory_Vault_User_DB);

  type RewardDelta = {
    progressKey: string;
    tokenKey: string;
    perPersonAmount: number;
    prevCount: number;
    nowCount: number;
    deltaCount: number;
    creditAmount: number;
  };

  const rewardPlan = TEAM_GROWTH_REWARD_PLAN.filter((reward) => Number(maxEligibleRank) >= Number(reward.minRank));

  try {
    let txRewardDeltas: RewardDelta[] = [];
    const tx = await vaultRef.transaction((currentRaw) => {
      const current = (currentRaw && typeof currentRaw === "object") ? { ...(currentRaw as Record<string, unknown>) } : {};
      const progressRaw = current[TeamGrowthRewardProgress_Vault_User_DB];
      const progress = (progressRaw && typeof progressRaw === "object") ? { ...(progressRaw as Record<string, unknown>) } : {};

      let makaBalance = Number(current[Maka_Vault_User_DB] || 0);
      let cashBalance = Number(current[Cash_Vault_User_DB] || 0);
      let changed = false;
      const rewardDeltas: RewardDelta[] = [];

      for (const reward of rewardPlan) {
        const prevCount = clampRewardCount(Number(progress[reward.progressKey] || 0));
        const nowCount = clampRewardCount(counts[reward.countKey]);
        const delta = Math.max(0, nowCount - prevCount);

        if (delta > 0) {
          const creditAmount = delta * reward.perPersonAmount;
          if (reward.tokenKey === Maka_Vault_User_DB) {
            makaBalance += creditAmount;
          } else {
            cashBalance += creditAmount;
          }
          rewardDeltas.push({
            progressKey: reward.progressKey,
            tokenKey: reward.tokenKey,
            perPersonAmount: reward.perPersonAmount,
            prevCount,
            nowCount,
            deltaCount: delta,
            creditAmount
          });
          changed = true;
        }

        if (nowCount > prevCount) {
          progress[reward.progressKey] = nowCount;
          changed = true;
        }
      }

      if (!changed) return currentRaw;

      current[Maka_Vault_User_DB] = Number(makaBalance.toFixed(4));
      current[Cash_Vault_User_DB] = Number(cashBalance.toFixed(4));
      current[TeamGrowthRewardProgress_Vault_User_DB] = progress;
      txRewardDeltas = rewardDeltas;
      return current;
    });

    if (!tx.committed || txRewardDeltas.length === 0) {
      return createEmptyTeamGrowthRewardSummary();
    }

    const now = Date.now();
    const totalMakaCredited = txRewardDeltas
      .filter((d) => d.tokenKey === Maka_Vault_User_DB)
      .reduce((sum, d) => sum + d.creditAmount, 0);
    const totalCashCredited = txRewardDeltas
      .filter((d) => d.tokenKey === Cash_Vault_User_DB)
      .reduce((sum, d) => sum + d.creditAmount, 0);

    await rewardHistoryRef.push({
      createdAt: now,
      totalMakaCredited,
      totalCashCredited,
      deltas: txRewardDeltas
    });

    return buildTeamGrowthRewardSummary(txRewardDeltas);
  } catch (err) {
    console.error("creditTeamGrowthRewards: failed for", userId, err);
    return createEmptyTeamGrowthRewardSummary();
  }
}

export interface MiningRankSnapshot {
  isEchoUser: boolean;
  playRankEnergy: number;
  agentEnergy: number;
  builderEnergy: number;
  specialistEnergy: number;
  architectEnergy: number;
  phantom1Energy: number;
  phantom2Energy: number;
  phantom3Energy: number;
  phantom4Energy: number;
  totalEnergy: number;
  miningRate: number;
  sector1Total: number;
  playerCount: number;
  agentCount: number;
  builderCount: number;
  specialistCount: number;
  architectCount: number;
  phantom1Count: number;
  phantom2Count: number;
  phantom3Count: number;
  phantom4Count: number;
  actualPlayerCount: number;
  actualAgentCount: number;
  actualBuilderCount: number;
  actualSpecialistCount: number;
  actualArchitectCount: number;
  actualPhantom1Count: number;
  actualPhantom2Count: number;
  actualPhantom3Count: number;
  actualPhantom4Count: number;
  newMiningRank: MiningRanks;
  playerRank: PlayRanks;
  fromCache: boolean;
  lastCalculatedAt: number;
  agentMakaReward: number;
  builderMakaReward: number;
  specialistMakaReward: number;
  architectMakaReward: number;
  phantom1CashReward: number;
  phantom2CashReward: number;
  phantom3CashReward: number;
  phantom4CashReward: number;
}

export async function markMiningRankRefreshNeeded(userId: string | null): Promise<void> {
  if (!userId) return;

  try {
    await admin.database().ref(`${tournament.Users_DB}/${userId}/${Vault_User_DB}`).update({
      [MiningRank_NeedsRefresh_Vault_User_DB]: true
    });
  } catch (err) {
    console.error("markMiningRankRefreshNeeded: DB update failed for", userId, err);
  }
}

export async function getMiningRankSnapshot(userId: string | null, forceRefresh: boolean = false, persistUpdates: boolean = true): Promise<MiningRankSnapshot | null> {
  if (!userId) return null;

  const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
  if (!userSnap.exists()) return null;

  const now = Date.now();
  const cachedMiningRate = Number(userSnap.child(`${Vault_User_DB}/${miningRate_Vault_User_DB}`).val() || 0);
  const cachedMiningRank = Number(userSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).val() || MiningRanks.Default);
  const lastCalculatedAt = Number(userSnap.child(`${Vault_User_DB}/${MiningRank_LastCalculatedAt_Vault_User_DB}`).val() || 0);
  const needsRefresh = Boolean(userSnap.child(`${Vault_User_DB}/${MiningRank_NeedsRefresh_Vault_User_DB}`).val());
  const refreshDue = forceRefresh || needsRefresh || lastCalculatedAt <= 0 || (now - lastCalculatedAt) >= MiningRank_RefreshIntervalMs;

  if (!refreshDue) {
    // Counts are not persisted in DB, so we must recompute them even on cache hit.
    // We skip the DB write by calling calculateAndUpdateMiningRateForUser only for read purposes.
    const fresh = await calculateAndUpdateMiningRateForUser(userId, persistUpdates);
    if (!fresh) return null;
    return {
      ...fresh,
      miningRate: persistUpdates ? cachedMiningRate : fresh.miningRate,
      newMiningRank: persistUpdates ? (cachedMiningRank as MiningRanks) : fresh.newMiningRank,
      fromCache: true,
      lastCalculatedAt
    };
  }

  const recomputed = await calculateAndUpdateMiningRateForUser(userId, persistUpdates);
  if (!recomputed) return null;

  return {
    ...recomputed,
    fromCache: false,
    lastCalculatedAt: Date.now()
  };
}

/**
 * Main function: calculates the energy boosts and miningRate for a user,
 * updates vault/miningRate and upgrades MiningRank if thresholds met.
 *
 * Returns detailed breakdown:
 *  { playRankEnergy, starbornEnergy, architectEnergy, lightmasterEnergy, totalEnergy, miningRate, sector1Total, newMiningRank }
 */

// export async function calculateAndUpdateMiningRateForUser(userId: string | null): Promise<{
//   playRankEnergy: number;
//   starbornEnergy: number;
//   architectEnergy: number;
//   solarisEnergy: number;
//   apolloEnergy: number;
//   lightmasterEnergy: number;
//   totalEnergy: number;
//   miningRate: number;
//   sector1Total: number;
//   Celestialcount: number;
//   Starborncount: number;
//   Architectcount: number;
//   Solariscount: number;
//   Apollocount: number;
//   newMiningRank: MiningRanks;
//   playerRank: PlayRanks;
// } | null> {
//   if (userId === null) return null;

//   // play rank boost
//   const playRank = await getPlayRankForUser(userId) || PlayRanks.Celestial;
//   const playRankEnergy = playRankEnergyPercentFromPlayRank(playRank);

//   // sector-1 counts
//   const counts = await countSector1ChildrenByMiningRank(userId);
//   const sector1Total = counts.totalMembers || 0;

//   const {
//     starbornEnergyPercent,
//     architectEnergyPercent,
//     solarisEnergyPercent,
//     apolloEnergyPercent,
//     lightmasterEnergyPercent
//   } = computeSector1CircleEnergyPercents(counts);

//   const totalEnergy = playRankEnergy
//     + starbornEnergyPercent
//     + architectEnergyPercent
//     + solarisEnergyPercent
//     + apolloEnergyPercent
//     + lightmasterEnergyPercent;

//   const miningRate = Number((totalEnergy / 100).toFixed(4)); // fraction (e.g., 3.00 => 3.0x)

//   // Progression of MiningRanks based on circle completions
//   let newMiningRank = MiningRanks.Default;
//   if (counts.Level7Count >= 12) newMiningRank = MiningRanks.Level8;
//   else if (counts.Level6Count >= 12) newMiningRank = MiningRanks.Level7;
//   else if (counts.PhantomCount >= 12) newMiningRank = MiningRanks.Level6;
//   else if (counts.SpecialistCount >= 12) newMiningRank = MiningRanks.Phantom;
//   else if (counts.ExpertCount >= 12) newMiningRank = MiningRanks.Specialist;
//   else if (counts.AgentCount >= 12) newMiningRank = MiningRanks.Expert;
//   else if (counts.VIPCount >= 12) newMiningRank = MiningRanks.Agent;
//   else if (counts.totalMembers >= 12) newMiningRank = MiningRanks.VIP;
//    else {
//     // keep current if present
//     const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once('value');
//     if (userSnap.exists() && userSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).exists()) {
//       newMiningRank = Number(userSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).val()) || MiningRanks.Default;
//     }
//   }

//   // update DB vault: miningRate and MiningRank
//   try {
//     await admin.database().ref(`${tournament.Users_DB}/${userId}/${Vault_User_DB}`).update({
//       [miningRate_Vault_User_DB]: miningRate,
//       [MiningRank_Vault_User_DB]: newMiningRank
//     });
//   } catch (err) {
//     console.error("calculateAndUpdateMiningRateForUser: DB update failed for", userId, err);
//   }

//   return {
//     playRankEnergy,
//     starbornEnergy: starbornEnergyPercent,
//     architectEnergy: architectEnergyPercent,
//     solarisEnergy: solarisEnergyPercent,
//     apolloEnergy: apolloEnergyPercent,
//     lightmasterEnergy: lightmasterEnergyPercent,
//     totalEnergy,
//     miningRate,
//     sector1Total,
//      Celestialcount: counts.DefaultCount,
//     Starborncount: counts.VIPCount,
//     Architectcount: counts.AgentCount,
//     Solariscount: counts.ExpertCount,
//     Apollocount: counts.SpecialistCount,
//     newMiningRank,
//     playerRank: playRank
//   };
// }

export async function calculateAndUpdateMiningRateForUser(userId: string | null, persistUpdates: boolean = true): Promise<{
  isEchoUser: boolean;
  playRankEnergy: number;
  agentEnergy: number;
  builderEnergy: number;
  specialistEnergy: number;
  architectEnergy: number;
  phantom1Energy: number;
  phantom2Energy: number;
  phantom3Energy: number;
  phantom4Energy: number;
  totalEnergy: number;
  miningRate: number;
  sector1Total: number;
  playerCount: number;
  agentCount: number;
  builderCount: number;
  specialistCount: number;
  architectCount: number;
  phantom1Count: number;
  phantom2Count: number;
  phantom3Count: number;
  phantom4Count: number;
  actualPlayerCount: number;
  actualAgentCount: number;
  actualBuilderCount: number;
  actualSpecialistCount: number;
  actualArchitectCount: number;
  actualPhantom1Count: number;
  actualPhantom2Count: number;
  actualPhantom3Count: number;
  actualPhantom4Count: number;
  newMiningRank: MiningRanks;
  playerRank: PlayRanks;
  agentMakaReward: number;
  builderMakaReward: number;
  specialistMakaReward: number;
  architectMakaReward: number;
  phantom1CashReward: number;
  phantom2CashReward: number;
  phantom3CashReward: number;
  phantom4CashReward: number;
} | null> {
  if (userId === null) return null;

  const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
  const isEchoUser = Boolean(userSnap.child("isEchoPro").val());

  const playRank = await getPlayRankForUser(userId) || PlayRanks.Celestial;
  const playRankEnergy = playRankEnergyPercentFromPlayRank(playRank);

  const counts = await countSector1ChildrenByMiningRank(userId);
  const currentRank = Number(userSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).val() || MiningRanks.Default);
  const eligibleCounts = capCountsByMiningRank(counts, currentRank);
  const sector1Total = counts.totalMembers || 0;

  // Progress counts returned to API should include higher-rank descendants for each threshold.
  // Example: Specialist contributes to Builder threshold count.
  const responseCounts = {
    playerCount: getDisplayProgressCountForMiningRank(counts, MiningRanks.Default),
    agentCount: getDisplayProgressCountForMiningRank(counts, MiningRanks.VIP),
    builderCount: getDisplayProgressCountForMiningRank(counts, MiningRanks.Agent),
    specialistCount: getDisplayProgressCountForMiningRank(counts, MiningRanks.Expert),
    architectCount: getDisplayProgressCountForMiningRank(counts, MiningRanks.Specialist),
    phantom1Count: getDisplayProgressCountForMiningRank(counts, MiningRanks.Phantom),
    phantom2Count: getDisplayProgressCountForMiningRank(counts, MiningRanks.Level6),
    phantom3Count: getDisplayProgressCountForMiningRank(counts, MiningRanks.Level7),
    phantom4Count: getDisplayProgressCountForMiningRank(counts, MiningRanks.Level8),
  };

  // Energy progression should be based on display/progression counts, but
  // higher-tier gains above the user’s current rank are not eligible to show or credit.
  const displayCounts = {
    playerCount: getDisplayProgressCountForMiningRank(eligibleCounts, MiningRanks.Default),
    agentCount: getDisplayProgressCountForMiningRank(eligibleCounts, MiningRanks.VIP),
    builderCount: getDisplayProgressCountForMiningRank(eligibleCounts, MiningRanks.Agent),
    specialistCount: getDisplayProgressCountForMiningRank(eligibleCounts, MiningRanks.Expert),
    architectCount: getDisplayProgressCountForMiningRank(eligibleCounts, MiningRanks.Specialist),
    phantom1Count: getDisplayProgressCountForMiningRank(eligibleCounts, MiningRanks.Phantom),
    phantom2Count: getDisplayProgressCountForMiningRank(eligibleCounts, MiningRanks.Level6),
    phantom3Count: getDisplayProgressCountForMiningRank(eligibleCounts, MiningRanks.Level7),
    phantom4Count: getDisplayProgressCountForMiningRank(eligibleCounts, MiningRanks.Level8),
  };

 

  const {
    vipEnergyPercent,
    agentEnergyPercent,
    expertEnergyPercent,
    specialistEnergyPercent,
    phantomEnergyPercent,
    Level6EnergyPercent,
    Level7EnergyPercent,
    Level8EnergyPercent
  } = computeSector1CircleEnergyPercents({
    totalMembers: displayCounts.playerCount,
    DefaultCount: displayCounts.playerCount,
    VIPCount: displayCounts.agentCount,
    AgentCount: displayCounts.builderCount,
    ExpertCount: displayCounts.specialistCount,
    SpecialistCount: displayCounts.architectCount,
    PhantomCount: displayCounts.phantom1Count,
    Level6Count: displayCounts.phantom2Count,
    Level7Count: displayCounts.phantom3Count,
    Level8Count: displayCounts.phantom4Count
  });

   

  const totalEnergyBase =
    playRankEnergy +
    vipEnergyPercent +
    agentEnergyPercent +
    expertEnergyPercent +
    specialistEnergyPercent +
    phantomEnergyPercent +
    Level6EnergyPercent +
    Level7EnergyPercent +
    Level8EnergyPercent;

  const totalEnergy = isEchoUser ? totalEnergyBase * 2 : totalEnergyBase;

  const miningRate = Number((totalEnergy / 100).toFixed(4));

  

  let newMiningRank = MiningRanks.Default;

  // if (counts.Level7Count >= 5) newMiningRank = MiningRanks.Level8;
  // else if (counts.Level6Count >= 5) newMiningRank = MiningRanks.Level7;
  // else if (counts.PhantomCount >= 5) newMiningRank = MiningRanks.Level6;
  // else if (counts.SpecialistCount >= 5) newMiningRank = MiningRanks.Phantom;
  // else if (counts.ExpertCount >= 5) newMiningRank = MiningRanks.Specialist;
  // else if (counts.AgentCount >= 5) newMiningRank = MiningRanks.Expert;
  // else if (counts.VIPCount >= 5) newMiningRank = MiningRanks.Agent;
  // else if (counts.totalMembers >= 5) newMiningRank = MiningRanks.VIP;
  // else {
  //   const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
  //   if (userSnap.exists() && userSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).exists()) {
  //     newMiningRank = Number(userSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).val()) || MiningRanks.Default;
  //   }

  const atLeastVIPCount = counts.VIPCount + counts.AgentCount + counts.ExpertCount + counts.SpecialistCount + counts.PhantomCount + counts.Level6Count + counts.Level7Count + counts.Level8Count;
  const atLeastAgentCount = counts.AgentCount + counts.ExpertCount + counts.SpecialistCount + counts.PhantomCount + counts.Level6Count + counts.Level7Count + counts.Level8Count;
  const atLeastExpertCount = counts.ExpertCount + counts.SpecialistCount + counts.PhantomCount + counts.Level6Count + counts.Level7Count + counts.Level8Count;
  const atLeastSpecialistCount = counts.SpecialistCount + counts.PhantomCount + counts.Level6Count + counts.Level7Count + counts.Level8Count;
  const atLeastPhantomCount = counts.PhantomCount + counts.Level6Count + counts.Level7Count + counts.Level8Count;
  const atLeastLevel6Count = counts.Level6Count + counts.Level7Count + counts.Level8Count;
  const atLeastLevel7Count = counts.Level7Count + counts.Level8Count;

  if (atLeastLevel7Count >= 5) newMiningRank = MiningRanks.Level8;
  else if (atLeastLevel6Count >= 5) newMiningRank = MiningRanks.Level7;
  else if (atLeastPhantomCount >= 5) newMiningRank = MiningRanks.Level6;
  else if (atLeastSpecialistCount >= 5) newMiningRank = MiningRanks.Phantom;
  else if (atLeastExpertCount >= 5) newMiningRank = MiningRanks.Specialist;
  else if (atLeastAgentCount >= 5) newMiningRank = MiningRanks.Expert;
  else if (atLeastVIPCount >= 5) newMiningRank = MiningRanks.Agent;
  else if (counts.totalMembers >= 5) newMiningRank = MiningRanks.VIP;
  // else {
  //   const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
  //   if (userSnap.exists() && userSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).exists()) {
  //     newMiningRank = Number(userSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).val()) || MiningRanks.Default;
  //   }

  // }

  let teamGrowthRewardSummary: TeamGrowthRewardSummary = createEmptyTeamGrowthRewardSummary();

  try {
    if (persistUpdates) {
      await admin.database().ref(`${tournament.Users_DB}/${userId}/${Vault_User_DB}`).update({
        [miningRate_Vault_User_DB]: miningRate,
        [MiningRank_Vault_User_DB]: newMiningRank,
        [MiningRank_LastCalculatedAt_Vault_User_DB]: Date.now(),
        [MiningRank_NeedsRefresh_Vault_User_DB]: false
      });

      teamGrowthRewardSummary = await creditTeamGrowthRewards(
        userId,
        buildTeamGrowthRewardCountsFromDisplayCounts(displayCounts),
        newMiningRank
      );
    } else {
      teamGrowthRewardSummary = await getPreviewTeamGrowthRewardSummary(
        userId,
        buildTeamGrowthRewardCountsFromDisplayCounts(displayCounts),
        currentRank as MiningRanks
      );
    }
  } catch (err) {
    console.error("calculateAndUpdateMiningRateForUser: DB update failed for", userId, err);
  }

  return {
    isEchoUser,
    playRankEnergy,
    agentEnergy: vipEnergyPercent,
    builderEnergy: agentEnergyPercent,
    specialistEnergy: expertEnergyPercent,
    architectEnergy: specialistEnergyPercent,
    phantom1Energy: phantomEnergyPercent,
    phantom2Energy: Level6EnergyPercent,
    phantom3Energy: Level7EnergyPercent,
    phantom4Energy: Level8EnergyPercent,
    totalEnergy,
    miningRate,
    sector1Total,
    playerCount: responseCounts.playerCount,
    agentCount: responseCounts.agentCount,
    builderCount: responseCounts.builderCount,
    specialistCount: responseCounts.specialistCount,
    architectCount: responseCounts.architectCount,
    phantom1Count: responseCounts.phantom1Count,
    phantom2Count: responseCounts.phantom2Count,
    phantom3Count: responseCounts.phantom3Count,
    phantom4Count: responseCounts.phantom4Count,
    actualPlayerCount: eligibleCounts.DefaultCount,
    actualAgentCount: eligibleCounts.VIPCount,
    actualBuilderCount: eligibleCounts.AgentCount,
    actualSpecialistCount: eligibleCounts.ExpertCount,
    actualArchitectCount: eligibleCounts.SpecialistCount,
    actualPhantom1Count: eligibleCounts.PhantomCount,
    actualPhantom2Count: eligibleCounts.Level6Count,
    actualPhantom3Count: eligibleCounts.Level7Count,
    actualPhantom4Count: eligibleCounts.Level8Count,
    newMiningRank,
    playerRank: playRank,
    agentMakaReward: teamGrowthRewardSummary?.agentMakaReward || 0,
    builderMakaReward: teamGrowthRewardSummary?.builderMakaReward || 0,
    specialistMakaReward: teamGrowthRewardSummary?.specialistMakaReward || 0,
    architectMakaReward: teamGrowthRewardSummary?.architectMakaReward || 0,
    phantom1CashReward: teamGrowthRewardSummary?.phantom1CashReward || 0,
    phantom2CashReward: teamGrowthRewardSummary?.phantom2CashReward || 0,
    phantom3CashReward: teamGrowthRewardSummary?.phantom3CashReward || 0,
    phantom4CashReward: teamGrowthRewardSummary?.phantom4CashReward || 0,
  };
}


/**
 * Recalculate mining rate for up to `depth` ancestors of `childUserId`.
 * Calls calculateAndUpdateMiningRateForUser for each ancestor (depth 1..depth).
 */
export async function calculateAllUsersTeamGrowthRewardsForBatch(
  applyCredits: boolean = true,
  batchSize: number = 50
): Promise<{
  processed: number;
  totalMaka: number;
  totalCash: number;
  totalRewards: number;
  nonQualifiedUserMakaTotal: number;
  nonQualifiedUserCashTotal: number;
  users: Array<{ userId: string; maka: number; cash: number; qualified: boolean; nonQualifiedPreviewMaka: number; nonQualifiedPreviewCash: number }>;
}> {
  const safeBatchSize = Math.max(1, Math.min(100, Math.floor(Number(batchSize) || 50)));
  const usersSnap = await admin.database().ref(tournament.Users_DB).once("value");

  if (!usersSnap.exists()) {
    return {
      processed: 0,
      totalMaka: 0,
      totalCash: 0,
      totalRewards: 0,
      nonQualifiedUserMakaTotal: 0,
      nonQualifiedUserCashTotal: 0,
      users: []
    };
  }

  const userIds = Object.keys(usersSnap.val() || {});
  const users: Array<{ userId: string; maka: number; cash: number; qualified: boolean; nonQualifiedPreviewMaka: number; nonQualifiedPreviewCash: number }> = [];
  let totalMaka = 0;
  let totalCash = 0;
  let nonQualifiedUserMakaTotal = 0;
  let nonQualifiedUserCashTotal = 0;

  for (let i = 0; i < userIds.length; i += safeBatchSize) {
    const batch = userIds.slice(i, i + safeBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (userId) => {
        try {
          // Qualification requires 5 direct (actual) referrals, not spill-tree placements.
          const directChildrenCount = await countActualDirectChildren(userId);
          const qualified = directChildrenCount >= 5;

          const result = await calculateAndUpdateMiningRateForUser(userId, qualified && applyCredits);
          const maka = (result?.agentMakaReward || 0) + (result?.builderMakaReward || 0) + (result?.specialistMakaReward || 0) + (result?.architectMakaReward || 0);
          const cash = (result?.phantom1CashReward || 0) + (result?.phantom2CashReward || 0) + (result?.phantom3CashReward || 0) + (result?.phantom4CashReward || 0);

          if (!qualified) {
            nonQualifiedUserMakaTotal += maka;
            nonQualifiedUserCashTotal += cash;
            return {
              userId,
              maka: 0,
              cash: 0,
              qualified: false,
              nonQualifiedPreviewMaka: maka,
              nonQualifiedPreviewCash: cash,
            };
          }

          totalMaka += maka;
          totalCash += cash;
          return {
            userId,
            maka,
            cash,
            qualified: true,
            nonQualifiedPreviewMaka: 0,
            nonQualifiedPreviewCash: 0,
          };
        } catch (err) {
          console.error("calculateAllUsersTeamGrowthRewardsForBatch: failed for", userId, err);
          return {
            userId,
            maka: 0,
            cash: 0,
            qualified: false,
            nonQualifiedPreviewMaka: 0,
            nonQualifiedPreviewCash: 0,
          };
        }
      })
    );

    for (const item of batchResults) {
      users.push(item);
    }
  }

  return {
    processed: users.length,
    totalMaka,
    totalCash,
    totalRewards: totalMaka + totalCash,
    nonQualifiedUserMakaTotal,
    nonQualifiedUserCashTotal,
    users,
  };
}

export async function updateMiningRateForAncestors(childUserId: string, depth: number = 3): Promise<void> {
  if (!childUserId) return;
  let currentId = childUserId;
  for (let d = 0; d < depth; d++) {
    const parentSnap = await admin.database().ref(`${tournament.Users_DB}/${currentId}/parentUid`).once('value');
    if (!parentSnap.exists()) break;
    const parentId = parentSnap.val();
    if (!parentId) break;
    // recalc for parent (sector1 changed for this parent)
    await calculateAndUpdateMiningRateForUser(parentId).catch((err) => {
      console.error("updateMiningRateForAncestors: failed for", parentId, err);
    });
    currentId = parentId;
  }
}

//#endregion
//



//#region Lira operations
export async function ConvertLiraIntoCoins(userId: string|null, coinsAmount: number=1): Promise<number> {
    if (userId === null) return -1;
    if (coinsAmount <= 0) return -1;

    const userDb = await admin.database().ref(tournament.Users_DB+"/"+userId).once('value');
    if (!userDb.exists())
        return -1;


    const currentCoins = userDb.child(Vault_User_DB+"/"+Coins_Vault_User_DB).val();
    const currentLira  = userDb.child(Vault_User_DB+"/"+Lira_Vault_User_DB).val();

    if (!canConvertLiraTest(coinsAmount, currentLira)) return -1;

    const newCoins = currentCoins + coinsAmount;
    const newLira  = currentLira - (coinsAmount * Lira_To_Coins_ConversionRate);

    await userDb.child(Vault_User_DB).ref.update(
        {
            [Coins_Vault_User_DB]: newCoins,
            [Lira_Vault_User_DB]: newLira
        });
    return newLira;
}

function canConvertLiraTest(coinsAmount:number, currentLira:number): boolean {
    return coinsAmount * Lira_To_Coins_ConversionRate <= currentLira;
}

export async function AddLiraToVault(userId: string|null, newLira: number): Promise<number> {
    if (userId === null) return -1;
    if (newLira <= 0) return 0;

    const userDb = await admin.database().ref(tournament.Users_DB+"/"+userId).once('value');
    if (!userDb.exists())
        return -1;

    const currentLiraMined  = userDb.child(Vault_User_DB+"/"+Lira_Mined_User_DB).val();
    const currentLira  = userDb.child(Vault_User_DB+"/"+Lira_Vault_User_DB).val();
    const newLiraCapped = newLira;// Quitado el CAP de minado Math.min(Lira_Mining_Limit_Per_Day - currentLiraMined, newLira);

    const updatedLira = currentLira + newLiraCapped;
    await userDb.child(Vault_User_DB).ref.update(
        {
            [Lira_Mined_User_DB]: currentLiraMined + newLiraCapped,
            [Lira_Vault_User_DB]: updatedLira
        });

    return updatedLira;
}

export async function ResetLiraDailyLimit(userId: string|null): Promise<number> {
    if (userId === null) return -1;

    const userDb = await admin.database().ref(tournament.Users_DB + "/" + userId).once('value');
    if (!userDb.exists())
        return -1;

    return ResetLiraDailyLimitForUser(userDb);
}

export async function ResetLiraDailyLimitForUser(userDb: DataSnapshot): Promise<number> {
    return userDb.child(Vault_User_DB+"/"+Lira_Mined_User_DB).ref.transaction((lira)=>
    {
        return 0
    })
        .then(()=>{return 0})
        .catch(()=>{return -1});
}

export async function ResetLiraDailyLimitForAllUsers(): Promise<number> {
    const allUsers = await admin.database().ref(tournament.Users_DB).once('value');
    const allPromises: any[] = [];

    allUsers.forEach(function(data) {
        if (data.key!==null){
            allPromises.push(ResetLiraDailyLimitForUser(data));
        }
    });
    await Promise.all(allPromises);
    return allPromises.length;
}

//endregion

//#region Coins operations
/**
 * Converts all the coins given the current coinValue and revert all the coins to 0
 * @param userId
 * @constructor
 */
export async function ConvertCoinsIntoCash(userId: string|null): Promise<any> {
    if (userId === null) return -1;

    const userDb = await admin.database().ref(tournament.Users_DB+"/"+userId).once('value');
    if (!userDb.exists())
        return -1;

    const currentCoins = userDb.child(Vault_User_DB+"/"+Coins_Vault_User_DB).val();
    const currentCoinsValue = userDb.child(Vault_User_DB+"/"+CoinsValue_Vault_User_DB).val();
    const currentCash = userDb.child(Vault_User_DB+"/"+Cash_Vault_User_DB).val();

    if (!canConvertCoinsTest(currentCoins, currentCoinsValue, currentCash)) return -1;

    const resetVal = 0;//123;
    // //temporary allotment of 100 coins on weekly reset
    // if(!canConvertCoinsTest(currentCoins, currentCoinsValue, currentCash))
    // {
    //     //no conversion
    //     await userDb.child(Vault_User_DB).ref.update(
    //         {
    //             [Coins_Vault_User_DB]: currentCoins + resetVal
    //         });
    //     return -1;
    // }

    const newCash = currentCash + (currentCoinsValue * currentCoins);

    const coinsConversions = historicCoinsConversion(userDb,currentCoins,currentCoinsValue);

    await userDb.child(Vault_User_DB).ref.update(
    {
        [Coins_Vault_User_DB]: resetVal,
        [Cash_Vault_User_DB]: newCash,
        [CoinsConversions_Vault_User_DB]: coinsConversions
    });
    console.log("ConvertCoinsIntoCash called for userId:" + userId + "and conversion happened.")
    return newCash;
}

function historicCoinsConversion(userDb: DataSnapshot,
                                 currentCoins: number,
                                 currentCoinsValue: number): any {
    const startDate = new Date().toUTCString()

    const currentConversions: any[] = userDb.child('vault/'+CoinsConversions_Vault_User_DB).exists()
        ?userDb.child('vault/'+CoinsConversions_Vault_User_DB).val()
        :[];

    if (currentConversions.length===3)
        currentConversions.shift();

    currentConversions.push({
            date: startDate,
            coins:currentCoins,
            coinsValue: currentCoinsValue,
            cash: (currentCoinsValue * currentCoins)
        },
    );

    return currentConversions;

}

function canConvertCoinsTest(currentCoins: any, currentCoinsValue: any,
                        currentCash: any, minimumCashForConvert: number = Minimum_Cash_For_Conversion) {
    return currentCoins * currentCoinsValue >= minimumCashForConvert;
}


export async function AddZplnMinedForCoins(userId: string | null, coinsToAdd: number): Promise<{ CurrentGameZplnMinned: number; NeoZplnMined: number } | number> {
  if (userId === null) return -1;
  if (!coinsToAdd || coinsToAdd <= 0) return 0;

  const userDbSnap = await admin.database().ref(tournament.Users_DB + "/" + userId).once('value');
  if (!userDbSnap.exists()) return -1;

  const miningRate: number = Number(userDbSnap.child(Vault_User_DB + "/" + miningRate_Vault_User_DB).val() || 0.0);
  const zplnToAdd = Number(miningRate) * Number(coinsToAdd);

  const zplnRef = admin.database().ref(`${tournament.Users_DB}/${userId}/${Vault_User_DB}/${ZplnMinned_Vault_User_DB}`);

  try {
    const txResult = await zplnRef.transaction((curr) => {
      return (curr || 0) + zplnToAdd;
    });

    // txResult.snapshot contains the value after the transaction (if committed)
    const zplnTotal = txResult && txResult.snapshot ? Number(txResult.snapshot.val() || 0) : (zplnToAdd);
    return { CurrentGameZplnMinned: zplnToAdd, NeoZplnMined: zplnTotal };
  } catch (err) {
    console.error("AddZplnMinedForCoins error for user:", userId, err);
    return -1;
  }
}

export async function AddCoinsToVault(userId: string|null, newCoins: number): Promise<{ updatedCoins: number; CurrentGameZplnMinned: number; NeoZplnMined: number } | number> {
    if (userId === null) return -1;
    if (newCoins <= 0) return 0;

    const userDb = await admin.database().ref(tournament.Users_DB+"/"+userId).once('value');
    if (!userDb.exists())
        return -1;

    let updatedCoins = -1;
  try {
    const txResult = await userDb.child(Vault_User_DB + "/" + Coins_Vault_User_DB).ref.transaction((coins) => {
      const curr = Number(coins || 0);
      updatedCoins = curr + newCoins;
      return updatedCoins;
    });

    if (!txResult.committed) {
      // transaction did not commit, return error code
      return -1;
    }

    // calculate and apply zpln mined for the added coins, and get new total
    const zplnResult = await AddZplnMinedForCoins(userId, newCoins);
    if (typeof zplnResult === "number") {
      // error or zero
      if (zplnResult === 0) {
        return { updatedCoins, CurrentGameZplnMinned: 0, NeoZplnMined: 0 };
      }
      return -1;
    }

    return { updatedCoins, CurrentGameZplnMinned: zplnResult.CurrentGameZplnMinned, NeoZplnMined: zplnResult.NeoZplnMined };
  } catch (err) {
    console.error("AddCoinsToVault transaction failed for", userId, err);
    return -1;
  }
}




export async function UpdateCoinsValueToVault(userId: string|null, newCoinsValue: number): Promise<number> {
    console.log("Setup coinsValue: "+newCoinsValue+" to "+userId)

    if (userId === null) return -1;
    if (newCoinsValue < 0) return 0;

    const userDb = await admin.database().ref(tournament.Users_DB+"/"+userId).once('value');
    if (userDb===null)
        return -1;

    return userDb.child(Vault_User_DB).ref
        .update(
    {
        [CoinsValue_Vault_User_DB]: newCoinsValue
        }).then(()=>{return newCoinsValue}).catch(()=>{return -1});
}

export async function ResetAllCoinsValues(userId: string | null): Promise<number> {
    console.log("Setup coinsValue: " + 0 + " to " + userId)

    if (userId === null) return -1;

    const userDb = await admin.database().ref(tournament.Users_DB + "/" + userId).once('value');
    if (userDb === null)
        return -1;

    await UpdateCoinsValueToVault(userId, 0);

    try {
        await userDb.ref.update({
            [CoinsValue_Vault_User_DB]: 0,
            coinsValueFromHighScore: 0,
            coinsValueFromTopPlayer: 0,
            coinsValueFromWaveScore: 0,
        });
        return 0; // Success
    } catch (error) {
        console.error("Error updating coins values:", error);
        return -1; // Error
    }
    
    return 0;
}

//#endregion

//#region Cash operations
export async function AddCashToVault(userId: string|null, newCash: number): Promise<number> {
    if (userId === null) return -1;
    if (newCash <= 0) return 0;

    const userDb = await admin.database().ref(tournament.Users_DB+"/"+userId).once('value');
    if (!userDb.exists())
        return -1;

    let updatedCash = -1;

    return userDb.child(Vault_User_DB+"/"+Cash_Vault_User_DB).ref
        .transaction((coins)=>
    {
        updatedCash = coins+ newCash;
        return updatedCash
    }
    ).then(()=>{return updatedCash}).catch(()=>{return -1});
/*
/ * Cambio para que solo cargue el dinero como coins * /
  const coinsValue = userDb.child(Vault_User_DB+"/"+CoinsValue_Vault_User_DB).exists()?
        userDb.child(Vault_User_DB+"/"+CoinsValue_Vault_User_DB).val():0;

  return userDb.child(Vault_User_DB+"/"+Coins_Vault_User_DB).ref
        .transaction((coins)=>
            {
                updatedCash = coins+ (newCash/coinsValue);
                return updatedCash
            }
        ).then(()=>{return updatedCash}).catch(()=>{return -1});*/

}

export async function SetCashInVault(userId: string|null, newCash: number=0.0): Promise<number> {
    if (userId === null) return -1;

    const userDb = await admin.database().ref(tournament.Users_DB+"/"+userId).once('value');
    if (!userDb.exists())
        return -1;

    await userDb.child(Vault_User_DB+"/"+Cash_Vault_User_DB).ref.set(newCash);
    return newCash;
}



export async function ConvertCoinsIntoCashForAllUsers(): Promise<number>{
    const allUsersRef = admin.database().ref(tournament.Users_DB+'/');

    const users = await allUsersRef.once("value");
    const allPromises: any[] = [];


    users.forEach(function(data) {
        console.log(data.key);
        if (data.key!==null){
            allPromises.push(ConvertCoinsIntoCash(data.key));
        }
    });
    await Promise.all(allPromises);
    return allPromises.length;
}

export async function ResetCashVault(userId: string|null, threshold: number = 0): Promise<boolean> {
    if (userId === null) return false;

    const user = await admin.database().ref(tournament.Users_DB+'/'+userId)
        .once('value');

    return ResetCashVaultWithData(user, threshold);

}

export async function ResetCashVaultWithData(user: DataSnapshot, threshold: number =0): Promise<boolean> {
    if (user === null) return false;

    if (user.child("vault").exists() &&
        user.child("vault/cash").val()>=threshold) {

        console.log("Reset cash from "+user.key+ " current cash "+user.child("vault/cash").val());
        return user.ref.update({vault: {cash:0}})
            .then(()=>{return true;})
            .catch((err)=>{
                console.error(err);
                return false;
            });

    } else {
        return true;
    }
}

export async function ResetCashForAllUsers(threshold: number = 0): Promise<number>{
    const allUsersRef = admin.database().ref(tournament.Users_DB+'/');

    const users = await allUsersRef.once("value");
    const allPromises: any[] = [];


    users.forEach(function(data) {
        if (data.key!==null){
            allPromises.push(ResetCashVaultWithData(data, threshold));
        }
    });
    await Promise.all(allPromises);
    return allPromises.length;
}

export async function ResetMakaForAllUsers(): Promise<number> {
    const allUsersRef = admin.database().ref(tournament.Users_DB + '/');

    const users = await allUsersRef.once("value");
    const allPromises: any[] = [];

    users.forEach(function(data) {
        if (data.key !== null) {
            const userVaultRef = admin.database().ref(`${tournament.Users_DB}/${data.key}/${Vault_User_DB}`);
            allPromises.push(
                Promise.all([
                    userVaultRef.child(Maka_Vault_User_DB).set(0),
                    userVaultRef.child(TeamGrowthRewardHistory_Vault_User_DB).remove(),
                    userVaultRef.child(TeamGrowthRewardProgress_Vault_User_DB).remove()
                ]).catch((err) => {
                    console.error("ResetMakaForAllUsers: failed for", data.key, err);
                    return false;
                })
            );
        }
    });

    await Promise.all(allPromises);
    return allPromises.length;
}
//#endregion

//#region Vault utils
export async function GetUserLevelAndVault(userId: string): Promise<any>{
    let userData =  await admin.database()
        .ref(tournament.Users_DB + "/" + userId).once('value');

    if (!userData.child("levelName").exists()) await leaderboards.resetPlayerLevel(userId);

    // await leaderboards.updateGlobalAverage(userId,0.0);

    userData =  await admin.database()
        .ref(tournament.Users_DB + "/" + userId).once('value');

    const nextWeek = await admin.database()
        .ref(tournament.GameParameters_DB + "/" + tournament.NextWeek_GameParameters_DB).once('value');
    const eventCoinsData = await GetCoinsSourceFromEvents(userData);

    const vaultComposed = {...userData.child(Vault_User_DB).val(),...eventCoinsData,coinsValueFromTopPlayer: userData.child('coinsValueFromTopPlayer').exists()?
            userData.child('coinsValueFromTopPlayer').val():0,
        coinsValueFromHighScore: userData.child('coinsValueFromHighScore').exists()?
            userData.child('coinsValueFromHighScore').val():0,
        coinsValueFromWaveScore: userData.child('coinsValueFromWaveScore').exists()?
            userData.child('coinsValueFromWaveScore').val():0,
        
        ZplnMinned: userData.child(Vault_User_DB + "/" + ZplnMinned_Vault_User_DB).exists() ? userData.child(Vault_User_DB + "/" + ZplnMinned_Vault_User_DB).val() : 0.0,
         LastweekZplnMined: userData.child(Vault_User_DB + "/" + LastweekZplnMining_Vault_User_DB).exists() ?
            userData.child(Vault_User_DB + "/" + LastweekZplnMining_Vault_User_DB).val() : 0.0,
        NeoMiningRate: userData.child(Vault_User_DB + "/" + miningRate_Vault_User_DB).exists() ?
            userData.child(Vault_User_DB + "/" + miningRate_Vault_User_DB).val() : 0.0,
        MiningRank: userData.child(Vault_User_DB + "/" + MiningRank_Vault_User_DB).exists() ?
            userData.child(Vault_User_DB + "/" + MiningRank_Vault_User_DB).val() : MiningRanks.Default

        };
            
    return {
        level: userData.child('level').val(),
        levelName: userData.child('levelName').val(),
        vault: vaultComposed,
        globalAverage: userData.child('globalAverage').exists()?userData.child('globalAverage').val():0,
        nextWeekConversionDate: nextWeek

    }
}

async function GetCoinsSourceFromEvents(userData: admin.database.DataSnapshot): Promise<any>{
    let sevenDaysDate = new Date();
    sevenDaysDate.setDate(sevenDaysDate.getDate()-7);

    const sevenDaysTimestamp = sevenDaysDate.getTime();

    console.log("Getting coins for "+userData.key+" timestamp limit: "
        +sevenDaysTimestamp+" ("+sevenDaysDate.toUTCString()+")")

    let eventCoinsData: any[]= [];
    userData.child(tournament.Tournaments_Users_DB)
        .forEach((eventData)=>{

            const elegibleForCoins = !eventData.child("joinTimestamp").exists() ||
                eventData.child("joinTimestamp").val()>sevenDaysTimestamp;
            console.log("Event "+eventData.key+" elegible: "+elegibleForCoins);

            if (elegibleForCoins) {
                const eventId = eventData.key!==null? eventData.key:"NOID";
                eventCoinsData.push({
                    eventId: eventId,
                    eventName: eventData.child("eventName").exists()?eventData.child("eventName").val():"VIP",
                    eventUrl:  eventData.child("eventUrl").exists()?eventData.child("eventUrl").val():"",
                    game1Coins: eventData.child("games/1/coins").exists()?eventData.child("games/1/coins").val():0,
                    game2Coins: eventData.child("games/2/coins").exists()?eventData.child("games/2/coins").val():0,
                    game3Coins: eventData.child("games/3/coins").exists()?eventData.child("games/3/coins").val():0

                });
            }

        });
    return {eventCoins: eventCoinsData};
}

export async function redeemVaultWithAmount(userId: string, email: string, redeemAmount: Number): Promise<boolean>{

  const userDb = await admin.database().ref("Users/" + userId).once('value');
  if (!userDb.exists())
    return false;

  let userName = userDb.child("userName").val();

  let userMail = email;//'abhishek.sonar@ediiie.com';//userDb.child("email").val();
  if(!utils.isValidEmail(userMail))
    return false;

  const cash = userDb.child(Vault_User_DB + "/" + Cash_Vault_User_DB).val();
  // const coins = userDb.child(vault.Vault_User_DB + "/" + vault.Coins_Vault_User_DB).val();
  // const coinsValue = userDb.child(vault.Vault_User_DB + "/" + vault.CoinsValue_Vault_User_DB).val();
  // let totalCash = cash + (coins * coinsValue);
  if(redeemAmount <= cash)
  {
    let mailSubject = "Zpln | Cash Redeem Confirmation";
    let mailContentForUser = "Your amount of $" + redeemAmount + " will be redeemed soon. <br><i>Keep playing...Keep earning!</i>";
    let mailContentForAdmin = "Key: " + userDb.key + "<br>" +
                              "Username: " + userName + "<br>" +
                              "Email: " + userMail + "<br>" +
                              "Redeem Amount: " + redeemAmount + "<br>";

    //send mails
    mailer.sendEmail(userMail, mailSubject, mailContentForUser)
    mailer.sendEmail(mailer.MAILER_AUTH_USER_EMAIL, mailSubject, mailContentForAdmin)
    return true;
  }

  return false;
}

//#endregion

//#region delete
/**
 * Reset all players' progress except genealogy (parentUid / childrenIds).
 * - Clears/jettisons joined tournaments under Users/{uid}/Tournaments (sets to null)
 * - Resets leaderboard-related fields on the user (globalAverage, average, total, BestAttemptTotal, currentGame/currentAttempt, isCompleted)
 * - Resets per-game highScore/credits/coins/gameState (if tournaments removed this may be redundant)
 * - Resets vault to sane defaults and sets coins to `defaultCoins`
 *
 * Returns number of users processed.
 *
 * WARNING: This operation is destructive. Run only from admin context.
 */
export async function ResetAllUsersProgressAndVaults(defaultCoins: number = 5000): Promise<number> {
  const usersSnap = await admin.database().ref(tournament.Users_DB).once("value");
  if (!usersSnap.exists()) return 0;

  const userIds: string[] = Object.keys(usersSnap.val());
  const batchSize = 50; // tune to avoid DB throttling
  let processed = 0;

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    await Promise.all(batch.map(async (uid) => {
      try {
        const userRef = admin.database().ref(`${tournament.Users_DB}/${uid}`);
        const userSnap = await userRef.once("value");
        if (!userSnap.exists()) return;

        // preserve existing coinValue and NeoMiningRate if present
        // const existingCoinsValue = userSnap.child(`${Vault_User_DB}/${CoinsValue_Vault_User_DB}`).exists()
        //   ? userSnap.child(`${Vault_User_DB}/${CoinsValue_Vault_User_DB}`).val()
        //   : 0.0;
        // const existingMiningRate = userSnap.child(`${Vault_User_DB}/${miningRate_Vault_User_DB}`).exists()
        //   ? userSnap.child(`${Vault_User_DB}/${miningRate_Vault_User_DB}`).val()
        //   : 0.1;

        // Reset tournaments node (remove joined tournaments)
        // and reset top-level user fields related to progress/leaderboards
        const updates: any = {};

        // remove tournament entries for user
        updates[tournament.Tournaments_Users_DB] = null;

        // reset per-user progress fields
        updates["globalAverage"] = 0;
        updates["average"] = 0;
        updates["total"] = 0;
        updates["BestAttemptTotal"] = 0;
        updates["currentAttempt"] = 1;
        updates["currentGame"] = 1;
        updates["isCompleted"] = false;

        // reset per-game nodes if present under user (games are stored under each tournament normally;
        // since tournaments removed above, this is mostly precautionary for any stray 'games' node)
        // We'll remove any top-level 'games' key under user if exists
        if (userSnap.child("games").exists()) updates["games"] = null;

        // reset vault (overwrite vault node with defaults but leave genealogical keys intact)
        updates[Vault_User_DB] = {
          [Coins_Vault_User_DB]: defaultCoins,
          [CoinsValue_Vault_User_DB]: 0.0,
          [Cash_Vault_User_DB]: 0,
          [CashAmountReceived]: 0,
          [CashBalance]: 0,
          [CoinsConversions_Vault_User_DB]: [],
          [Lira_Vault_User_DB]: 0,
          [Lira_Mined_User_DB]: 0,
          [ZplnMinned_Vault_User_DB]: 5000.0,
          [LastweekZplnMining_Vault_User_DB]: 0.0,
          [miningRate_Vault_User_DB]: 0.1,//existingMiningRate,
          [MiningRank_Vault_User_DB]: MiningRanks.Default
        };

        // apply update
        await userRef.update(updates);

        // remove user from public leaderboards if helper exists in leaderboards module
        // (non-fatal; skip if helper not present)
        try {
          const removeFn = (leaderboards as any).removeUserFromAllLeaderboards;
          if (typeof removeFn === "function") {
            await removeFn(uid);
          } else {
            // best-effort: remove some known leaderboard entries if they exist
            // (adjust paths if your leaderboard schema differs)
            await admin.database().ref(`${leaderboards.HighScore_Leaderboard}/${uid}`).remove().catch(() => {});
          }
        } catch (e) {
          console.error("ResetAllUsersProgressAndVaults: error removing leaderboards for", uid, e);
        }

        processed++;
      } catch (err) {
        console.error("ResetAllUsersProgressAndVaults: failed for user", uid, err);
      }
    }));
  }

  return processed;
}
//#region 

//#region Wallet operations


export enum WithdrawalTokenType {
  Coins = 1,
  Cash = 2,
  Bonk = 3,
  Zdlt = 4,
  Digi = 5,
  Pvs = 6,
  Maka = 7
}

export type WalletNetwork = "solana" | "evm";

const WITHDRAWAL_TOKEN_MAP: Record<WithdrawalTokenType, { key: string; name: string; network: WalletNetwork }> = {
  [WithdrawalTokenType.Coins]: { key: Coins_Vault_User_DB, name: "coins", network: "solana" },       // "coins"
  [WithdrawalTokenType.Cash]:  { key: Cash_Vault_User_DB,  name: "cash", network: "solana" },        // "cash"
  [WithdrawalTokenType.Bonk]:  { key: Bonk_Vault_User_DB,  name: "bonk", network: "solana" },        // "BONK_Tokens"
  [WithdrawalTokenType.Zdlt]:  { key: Zdlt_Vault_User_DB,  name: "zdlt", network: "solana" },        // "ZDLT_Tokens"
  [WithdrawalTokenType.Digi]:  { key: Digi_Vault_User_DB,  name: "digi", network: "solana" },        // "DIGI_Tokens"
  [WithdrawalTokenType.Pvs]:   { key: Pvs_Vault_User_DB,   name: "pvs", network: "solana" },         // "PVS_Tokens"
  [WithdrawalTokenType.Maka]:  { key: Maka_Vault_User_DB,  name: "maka", network: "evm" }            // "Maka_Token"
};


// Optional: guard to validate enum id
function getWithdrawalTokenMapEntry(tokenTypeId: number) {
  const tt = tokenTypeId as WithdrawalTokenType;
  return WITHDRAWAL_TOKEN_MAP[tt];
}

export function getWalletNetworkForTokenType(tokenTypeId: number): WalletNetwork | null {
  const entry = getWithdrawalTokenMapEntry(tokenTypeId);
  return entry ? entry.network : null;
}

export function getVaultPathForToken(userId: string, tokenTypeId: number): { path: string; key?: string; name?: string } {
  const map = getWithdrawalTokenMapEntry(tokenTypeId);
  if (!map) return { path: "" };
  const path = `${tournament.Users_DB}/${userId}/${Vault_User_DB}/${map.key}`;
  return { path, key: map.key, name: map.name };
}

export async function getVaultBalance(userId: string, tokenTypeId: number): Promise<{ path: string; balance: number; key?: string; name?: string }> {
  const info = getVaultPathForToken(userId, tokenTypeId);
  if (!info.path) return { path: "", balance: NaN };
  const snap = await admin.database().ref(info.path).once("value");
  return { path: info.path, balance: Number(snap.val() || 0), key: info.key, name: info.name };
}


type WalletBucket = { primary: string | null; list: string[] };

function normalizeWalletAddress(value: any): string | null {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function looksLikeEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function looksLikeSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function parseWalletBucket(val: any): WalletBucket {
  const bucket = val || {};
  const listObj = bucket.list || {};
  const primary = normalizeWalletAddress(bucket.primary);

  return {
    primary,
    list: Array.from(new Set(Object.keys(listObj || {}).map((key) => normalizeWalletAddress(key) || "").filter(Boolean)))
  };
}

function normalizeLegacyWallets(raw: any): { solana: WalletBucket; evm: WalletBucket; legacy: WalletBucket } {
  const legacy = parseWalletBucket(raw);
  const solana = parseWalletBucket(raw?.solana);
  const evm = parseWalletBucket(raw?.evm);

  const nextSolana = { ...solana };
  const nextEvm = { ...evm };

  if (!nextSolana.primary && !nextEvm.primary && legacy.primary) {
    if (looksLikeEvmAddress(legacy.primary)) {
      nextEvm.primary = legacy.primary;
    } else if (looksLikeSolanaAddress(legacy.primary)) {
      nextSolana.primary = legacy.primary;
    } else {
      nextSolana.primary = legacy.primary;
    }
  }

  return { solana: nextSolana, evm: nextEvm, legacy };
}

/**
 * Returns canonical wallet info using network-specific fields only.
 * Legacy `primary`/`list` are ignored as active source of truth and are removed from writes.
 */
export async function getUserWalletInfo(userId: string): Promise<{
  solanaPrimary: string | null;
  solanaList: string[];
  evmPrimary: string | null;
  evmList: string[];
}> {
  const snap = await admin.database().ref(`${tournament.Users_DB}/${userId}/wallets`).once("value");
  if (!snap.exists()) {
    return {
      solanaPrimary: null,
      solanaList: [],
      evmPrimary: null,
      evmList: []
    };
  }

  const raw = snap.val() || {};
  const { solana, evm } = normalizeLegacyWallets(raw);
  const solanaListSet = new Set<string>([...solana.list]);
  const evmListSet = new Set<string>([...evm.list]);

  return {
    solanaPrimary: solana.primary,
    solanaList: Array.from(solanaListSet),
    evmPrimary: evm.primary,
    evmList: Array.from(evmListSet)
  };
}

/**
 * Set/reset the primary wallet for a specific network.
 * Removes old generic legacy wallet fields.
 */
export async function setWalletPrimaryForNetwork(userId: string, network: WalletNetwork, walletId: string): Promise<void> {
  const cleanWalletId = normalizeWalletAddress(walletId);
  if (!cleanWalletId) return;

  const ref = admin.database().ref(`${tournament.Users_DB}/${userId}/wallets`);
  const snap = await ref.once("value");
  const current = snap.exists() ? snap.val() || {} : {};
  const bucketKey = network === "evm" ? "evm" : "solana";
  const bucket = current[bucketKey] || {};
  const list = { ...(bucket.list || {}) };
  list[cleanWalletId] = true;

  const next = {
    ...current,
    [bucketKey]: {
      primary: cleanWalletId,
      list
    }
  };

  delete next.primary;
  delete next.list;

  await ref.set(next);
}

export async function migrateLegacyPrimaryWalletForUser(userId: string): Promise<{
  hadLegacyPrimary: boolean;
  removedLegacyPrimary: boolean;
  migratedToSolana: boolean;
  migratedToEvm: boolean;
  ignoredLegacyPrimary: boolean;
  legacyPrimary: string | null;
  solanaPrimary: string | null;
  evmPrimary: string | null;
}> {
  const ref = admin.database().ref(`${tournament.Users_DB}/${userId}/wallets`);
  const snap = await ref.once("value");

  if (!snap.exists()) {
    return {
      hadLegacyPrimary: false,
      removedLegacyPrimary: false,
      migratedToSolana: false,
      migratedToEvm: false,
      ignoredLegacyPrimary: false,
      legacyPrimary: null,
      solanaPrimary: null,
      evmPrimary: null
    };
  }

  const raw = snap.val() || {};
  const { legacy, solana, evm } = normalizeLegacyWallets(raw);
  const legacyPrimary = legacy.primary;

  if (!legacyPrimary) {
    return {
      hadLegacyPrimary: false,
      removedLegacyPrimary: false,
      migratedToSolana: false,
      migratedToEvm: false,
      ignoredLegacyPrimary: false,
      legacyPrimary: null,
      solanaPrimary: solana.primary,
      evmPrimary: evm.primary
    };
  }

  const solanaList = { ...((raw?.solana?.list) || {}) };
  const evmList = { ...((raw?.evm?.list) || {}) };
  let nextSolanaPrimary = solana.primary;
  let nextEvmPrimary = evm.primary;
  let migratedToSolana = false;
  let migratedToEvm = false;
  let ignoredLegacyPrimary = false;

  if (!nextSolanaPrimary && looksLikeSolanaAddress(legacyPrimary)) {
    nextSolanaPrimary = legacyPrimary;
    solanaList[legacyPrimary] = true;
    migratedToSolana = true;
  } else if (!nextEvmPrimary && looksLikeEvmAddress(legacyPrimary)) {
    nextEvmPrimary = legacyPrimary;
    evmList[legacyPrimary] = true;
    migratedToEvm = true;
  } else {
    ignoredLegacyPrimary = true;
  }

  const updates: Record<string, unknown> = {
    primary: null
  };

  if (migratedToSolana) {
    updates.solana = {
      ...(raw?.solana || {}),
      primary: nextSolanaPrimary,
      list: solanaList
    };
  }

  if (migratedToEvm) {
    updates.evm = {
      ...(raw?.evm || {}),
      primary: nextEvmPrimary,
      list: evmList
    };
  }

  await ref.update(updates);

  return {
    hadLegacyPrimary: true,
    removedLegacyPrimary: true,
    migratedToSolana,
    migratedToEvm,
    ignoredLegacyPrimary,
    legacyPrimary,
    solanaPrimary: nextSolanaPrimary,
    evmPrimary: nextEvmPrimary
  };
}

/**
 * Backward-compatible wrapper retained for older call sites.
 */
export async function storeWalletIdIfAbsent(userId: string, walletId: string): Promise<void> {
  await setWalletPrimaryForNetwork(userId, "solana", walletId);
}

export async function storeWalletIdIfAbsentForNetwork(userId: string, network: WalletNetwork, walletId: string): Promise<void> {
  await setWalletPrimaryForNetwork(userId, network, walletId);
}

/**
 * Debit (withdraw) a token from vault given enum id.
 * Returns { success, previous, updated, tokenName }.
 */
// export async function WithdrawTokenFromVault(userId: string, tokenTypeId: number, amount: number): Promise<{
//   success: boolean;
//   previous: number;
//   updated: number;
//   tokenName: string;
//   error?: string;
// }> {
//   if (!userId) return { success: false, previous: 0, updated: 0, tokenName: "", error: "missing userId" };
//   if (!Number.isFinite(amount) || amount <= 0) return { success: false, previous: 0, updated: 0, tokenName: "", error: "invalid amount" };

//   const tokenType = tokenTypeId as WithdrawalTokenType;
//   const map = WITHDRAWAL_TOKEN_MAP[tokenType];
//   if (!map) return { success: false, previous: 0, updated: 0, tokenName: "", error: "invalid tokenTypeId" };

//   const path = `${tournament.Users_DB}/${userId}/${Vault_User_DB}/${map.key}`;
//   const tx = await admin.database().ref(path).transaction((curr) => {
//     const prev = Number(curr || 0);
//     if (prev < amount) return; // abort
//     return Number((prev - amount).toFixed(6));
//   });

//   if (!tx.committed) {
//     return { success: false, previous: Number(tx.snapshot?.val() || 0), updated: Number(tx.snapshot?.val() || 0), tokenName: map.name, error: "insufficient balance or transaction aborted" };
//   }

//   const updatedVal = Number(tx.snapshot?.val() || 0);
//   const previousVal = updatedVal + amount;
//   return { success: true, previous: previousVal, updated: updatedVal, tokenName: map.name };
// }

// export async function WithdrawTokenFromVault(userId: string, tokenTypeId: number, amount: number): Promise<{
//   success: boolean;
//   previous: number;
//   updated: number;
//   tokenName: string;
//   error?: string;
// }> {
//   if (!userId) return { success: false, previous: 0, updated: 0, tokenName: "", error: "missing userId" };
//   if (!Number.isFinite(amount) || amount <= 0) return { success: false, previous: 0, updated: 0, tokenName: "", error: "invalid amount" };

//   const map = getWithdrawalTokenMapEntry(tokenTypeId);
//   if (!map) return { success: false, previous: 0, updated: 0, tokenName: "", error: "invalid tokenTypeId" };

//   // Path uses the exact vault DB field name constant (e.g., "BONK_Tokens")
//   const path = `${tournament.Users_DB}/${userId}/${Vault_User_DB}/${map.key}`;
//   const tx = await admin.database().ref(path).transaction((curr) => {
//     const prev = Number(curr || 0);
//     if (prev < amount) return; // abort
//     return Number((prev - amount).toFixed(6));
//   });

//   if (!tx.committed) {
//     return {
//       success: false,
//       previous: Number(tx.snapshot?.val() || 0),
//       updated: Number(tx.snapshot?.val() || 0),
//       tokenName: map.name,
//       error: "insufficient balance or transaction aborted"
//     };
//   }

//   const updatedVal = Number(tx.snapshot?.val() || 0);
//   const previousVal = updatedVal + amount;
//   return { success: true, previous: previousVal, updated: updatedVal, tokenName: map.name };
// }

export async function WithdrawTokenFromVault(userId: string, tokenTypeId: number, amount: number): Promise<{
  success: boolean; previous: number; updated: number; tokenName: string; error?: string;
}> {
  if (!userId) return { success: false, previous: 0, updated: 0, tokenName: "", error: "missing userId" };
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, previous: 0, updated: 0, tokenName: "", error: "invalid amount" };

  const map = getWithdrawalTokenMapEntry(tokenTypeId);
  if (!map) return { success: false, previous: 0, updated: 0, tokenName: "", error: "invalid tokenTypeId" };

  const path = `${tournament.Users_DB}/${userId}/${Vault_User_DB}/${map.key}`;
  console.log("WithdrawTokenFromVault:start", { userId, tokenTypeId, tokenName: map.name, key: map.key, path, amount });

  // Explicit read first
  const balSnap = await admin.database().ref(path).once("value");
  const currentRaw = balSnap.val();
  const current = Number(currentRaw || 0);
  console.log("WithdrawTokenFromVault:readBefore", { path, currentRaw, current });

  if (!Number.isFinite(current)) {
    return { success: false, previous: 0, updated: 0, tokenName: map.name, error: "non-numeric balance" };
  }
  if (current < amount) {
    console.log("WithdrawTokenFromVault:insufficient-readBefore", { current, amount });
    return { success: false, previous: current, updated: current, tokenName: map.name, error: "insufficient balance" };
  }

  const updated = Number((current - amount).toFixed(6));
  try {
    await admin.database().ref(path).set(updated);
    console.log("WithdrawTokenFromVault:setAfter", { path, previous: current, updated });
    return { success: true, previous: current, updated, tokenName: map.name };
  } catch (e) {
    console.error("WithdrawTokenFromVault:setError", e);
    return { success: false, previous: current, updated: current, tokenName: map.name, error: "set failed" };
  }
}

/**
 * Append withdrawal history record.
 * Users/{uid}/WithdrawalHistory/{pushId} = { token, amount, walletId, timestamp }
 */
export async function addWithdrawalHistory(userId: string, record: {
  token: string;
  amount: number;
  walletId: string;
  walletNetwork?: WalletNetwork;
  miningRate?: number;
}): Promise<void> {
  const ref = admin.database().ref(`${tournament.Users_DB}/${userId}/WithdrawalHistory`);
  await ref.push({
    token: record.token,
    amount: record.amount,
    walletId: record.walletId,
    walletNetwork: record.walletNetwork || null,
    timestamp: Date.now(),
    miningRate: record.miningRate ?? null
  });
}

/**
 * Get last withdrawal timestamp or null.
 */
export async function getLastWithdrawalTimestamp(userId: string): Promise<number | null> {
  const ref = admin.database().ref(`${tournament.Users_DB}/${userId}/WithdrawalHistory`);
  const snap = await ref.orderByChild("timestamp").limitToLast(1).once("value");
  if (!snap.exists()) return null;
  let ts: number | null = null;
  snap.forEach(c => {
    ts = Number(c.child("timestamp").val() || 0);
    return false;
  });
  return ts;
}

// Export mapping for API usage
export function listWithdrawalTokenTypes(): { id: number; name: string; network: WalletNetwork }[] {
  return Object.keys(WITHDRAWAL_TOKEN_MAP).map(k => {
    const id = Number(k) as WithdrawalTokenType;
    return {
      id,
      name: WITHDRAWAL_TOKEN_MAP[id].name,
      network: WITHDRAWAL_TOKEN_MAP[id].network
    };
  });
}


/**
 * Returns user's VIP flag.
 * - If Users/{uid}/isVIP exists => returns it.
 * - If missing => computes from current data, stores it, returns it.
 */
export async function getOrComputeIsVIP(userId: string | null): Promise<boolean | null> {
  if (!userId) return null;

  const userRef = admin.database().ref(`${tournament.Users_DB}/${userId}`);
  const userSnap = await userRef.once("value");
  if (!userSnap.exists()) return null;

  if (userSnap.child(IsVIP_User_DB).exists()) {
    return Boolean(userSnap.child(IsVIP_User_DB).val());
  }

  const counts = await countSector1ChildrenByMiningRank(userId);
  const miningRank = Number(
    userSnap.child(`${Vault_User_DB}/${MiningRank_Vault_User_DB}`).val() || MiningRanks.Default
  );

  // VIP condition aligned with spill-tree descendant rule (5 descendants -> VIP)
  const isVIP = counts.totalMembers >= 5 || miningRank >= MiningRanks.VIP;
  await userRef.update({ [IsVIP_User_DB]: isVIP });
  return isVIP;
}

//#endregion