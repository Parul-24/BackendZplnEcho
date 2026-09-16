import * as admin from "firebase-admin";
import * as leaderboards from "./leaderboards"
import * as tournament from "./tournament";
import * as schedule from "./schedule_tasks"
import * as controlled_invites from "./controlled_invites"
import * as utils from "./utils";
import * as userUtils from "./user_utils";
import { WaveDictionaryClass, WaveSector } from "./wave_util_classes";
import { generateInviteCode, getCodeFromInviteLink } from "./utils";
import { DataSnapshot } from "firebase-admin/database";
import { createDynamicLinkForInviteCode } from "./dynamic_links_handler";
import { STAGING } from "./environments";
import * as vault from "./vault";
//import * as vault from './vault';

const Audicence_DB = "Audience";
const Vault_IGC_Value_DB = "Vault/IGCValue";
const Vault_Audience_Rank = "Vault/AudienceRank";
const Vault_Cash = "Vault/Cash";
export const RootUserId: string = '00000-00000';
export const RootUserInviteLink: string = '00000-00000';
export const FieldParentUid = "parentUid";
export const FieldChildrenIds = "childrenIds";
export const FieldInviteCode = "inviteCode";
export const FieldInviteLink = "inviteLink";
export const FieldInviteCodesDB = "InviteCodes";
export const FieldInviteCodeRegistryDB = "InviteCodeRegistry";
export const FieldShortlinkCodesDB = "ShortlinkCodes";
export const FieldWavescoreData = "WavescoreData";
export const FieldWaves = "Waves";
export const FieldActivityPoints = "AP";
export const FieldResetPoints = "RP";
export const SpillTree_DB = "SpillTree";
export const SpillTreeMaxDirectChildren = 5;

export async function setParentId(userId: string | null, parentInviteCode: string, addPointsOfRegistry: boolean = false): Promise<boolean> {
    if (userId === "" || userId === null) {

        console.log("UpdateParentId - setParentId - " + "userId null or missing");
        return false;
    }

    if (parentInviteCode === "" || parentInviteCode === null) {
        console.log("UpdateParentId - setParentId - " + "parentInviteCode null or missing");
        return false;
    }

    if (isUserTheRootUser(userId)) {
        console.log("UpdateParentId - setParentId - " + "user is the root user");
        return false;
    }

    //if user doesnt exists, return
    // const userDb = await admin.database().ref("Users/"+userId).once('value');
    // if (!userDb.exists())
    // {
    //     console.log("UpdateParentId - setParentId - " + "userDb doesn't exist.");
    //     return false;
    // }

    //find parent uid using parent code.
    let parentUid = await getParentUidFromParentCode(parentInviteCode);

    //if invite code doesnt exist, return
    if (parentUid === null) {
        console.log("UpdateParentId - setParentId - " + "parentUid is null.");
        return false;
    }

    if (isParentIdAndUserIdSame(parentUid, userId)) {
        console.log("UpdateParentId - setParentId - referring to same user.");
        return false;
    }

    if (await checkIfParentExist(userId)) {
        console.log("UpdateParentId - setParentId - Parent already exists.");
        return false;
    }

    console.log("UpdateParentId - setParentId - parentInviteCode:" + parentInviteCode + " parentUid:" + parentUid);

    if (!await canInviteCodeBeRedeemed(parentInviteCode)) {
        console.log("UpdateParentId - setParentId - Parent has exhausted all its invites.");
        return false;
    }


    await UpdateAudienceDb(userId, parentInviteCode);
    console.log("UpdateParentId - setParentId - 1 - UpdateAudienceDb called - userId:" + userId + " - parentInviteCode:" + parentInviteCode);

    await createInviteCodeIfDoesntAlreadyExists(userId);
    console.log("UpdateParentId - setParentId - 2 - createInviteCodeIfDoesntAlreadyExists called - userId:" + userId);

    await UpdateParentChildConnections(userId, parentUid);
    console.log("UpdateParentId - setParentId - 3 - UpdateParentChildConnections called - userId:" + userId + " - parentUid:" + parentUid);

    await controlled_invites.decrementInvitesLeft(parentUid);
    const numberOfSharesToAllot = await controlled_invites.getNumberOfSharesToAllot();
    console.log("numberOfSharesToAllot: " + numberOfSharesToAllot);
    await controlled_invites.setInvitesLeftToUserDb(userId, numberOfSharesToAllot);

    return true;
}

export async function UpdateParentChildConnections(userId: string, parentUid: string): Promise<void> {

    const userDb = await admin.database().ref("Users/" + userId).once('value');

    // Keep the legacy parentId alias synchronized with the canonical parentUid.
    let updateObject: { [key: string]: string } = {};
    updateObject[FieldParentUid] = parentUid;
    updateObject.parentId = parentUid;
    await userDb.ref.update(updateObject);

    // Add user to parent without overwriting existing childrenIds values.
    // This handles legacy array style and object-map style safely.
    await addChildToParentChildrenIds(parentUid, userId, tournament.Users_DB);

    // Maintain spillover tree separately from legacy Users/{uid}/childrenIds graph.
    await addUserToSpillTree(parentUid, userId);
    await vault.markMiningRankRefreshNeeded(parentUid).catch((err) => {
        console.error("UpdateParentChildConnections: failed to mark mining rank refresh as needed", parentUid, userId, err);
    });

    await vault.rewardParentForNewChildJoin(parentUid, userId).catch((err) => {
        console.error("UpdateParentChildConnections: failed to create join reward notification", parentUid, userId, err);
    });
}

export async function UpdateParentChildConnectionsBeforeUserRemoval(userId: string): Promise<void> {

    const parentUid = String((await admin.database().ref(`Users/${userId}/parentUid`).once("value")).val() || "").trim();
    if (!parentUid) return;

    const childrenSnapshot = await admin.database().ref(`Users/${userId}/childrenIds`).once("value");
    const childrenArr = getChildIdsFromChildrenValue(childrenSnapshot.val());

    // Standard approach: keep childrenIds as object-map entries and perform additive updates.
    await removeChildFromChildrenIdsPath(`Users/${parentUid}/childrenIds`, userId);

    for (const childUid of childrenArr) {
        await addChildToParentChildrenIds(parentUid, childUid, tournament.Users_DB);
    }

    // Reassign each direct child to the same parent being preserved.
    await Promise.all(childrenArr.map((childUid) =>
        admin.database().ref(`Users/${childUid}`).update({
            [FieldParentUid]: parentUid,
            parentId: parentUid
        })
    ));

    // then trigger miningRate recalc for parent and its ancestors
//await vault.calculateAndUpdateMiningRateForUser(parentUid).catch(()=>{"User mining rate updated before user removal failed"});
//await vault.updateMiningRateForAncestors(parentUid).catch(()=>{"Ancestors mining rate update before user removal failed"});
}

export async function createInviteCodeIfDoesntAlreadyExists(userId: string): Promise<void> {
    if (userId === undefined || userId === null || userId === "") {
        console.log("Issue while creating invite code - user id is empty.");
        return;
    }

    const userDb = await admin.database().ref("Users/" + userId).once('value');

    let inviteCode = null;

    if (!userDb.child(FieldInviteCode).exists()) {
        inviteCode = await generateUniqueInviteCode(userId, generateInviteCode);
        await addInviteCodeToUserDb(userDb, inviteCode);
        await addInviteCodeToInviteCodeDb(inviteCode, userId);
    }

    if (!userDb.child(FieldInviteLink).exists()) {
        if (inviteCode == null)
            inviteCode = userDb.child(FieldInviteCode).val();
        const userName = String(userDb.child("userName").val() || "").trim();
        const inviteLink = await createDynamicLinkForInviteCode(inviteCode, userName);
        await addInviteLinkToUserDb(userDb, inviteLink);
    }
}

export async function resetAndRegenerateFreeInviteForUser(userId: string): Promise<{
    userId: string;
    skipped: boolean;
    reason?: string;
    oldInviteCode: string;
    newInviteCode: string;
    oldInviteLink: string;
    newInviteLink: string;
}> {
    const emptyResult = {
        userId,
        skipped: false,
        oldInviteCode: "",
        newInviteCode: "",
        oldInviteLink: "",
        newInviteLink: ""
    };

    if (!userId) {
        return { ...emptyResult, skipped: true, reason: "Missing userId" };
    }

    const userRef = admin.database().ref(`${tournament.Users_DB}/${userId}`);
    const snapshot = await userRef.once("value");
    if (!snapshot.exists()) {
        return { ...emptyResult, skipped: true, reason: "User not found" };
    }

    const oldInviteCode = asStringOrEmpty(snapshot.child(FieldInviteCode).val());
    const oldInviteLink = asStringOrEmpty(snapshot.child(FieldInviteLink).val());
    const oldShortLinkCode = oldInviteLink ? getCodeFromInviteLink(oldInviteLink) : "";

    if (oldInviteCode) {
        await removeInviteCodeFromInviteCodeDb(oldInviteCode);
        await admin.database().ref(`${FieldInviteCodeRegistryDB}/${oldInviteCode}`).remove();
    }

    if (oldShortLinkCode) {
        await removeShortLinkInviteCodeFromShortLinkInviteCodeDb(oldShortLinkCode);
    }

    await userRef.update({
        [FieldInviteCode]: null,
        [FieldInviteLink]: null,
        [controlled_invites.FieldInvitesLeft]: 0,
        [userUtils.FieldIsEchoPro]: snapshot.child(userUtils.FieldIsEchoPro).val() === true
    });

    await createInviteCodeIfDoesntAlreadyExists(userId);

    const refreshed = await userRef.once("value");
    return {
        userId,
        skipped: false,
        oldInviteCode,
        newInviteCode: asStringOrEmpty(refreshed.child(FieldInviteCode).val()),
        oldInviteLink,
        newInviteLink: asStringOrEmpty(refreshed.child(FieldInviteLink).val())
    };
}

function asStringOrEmpty(value: unknown): string {
    if (value === undefined || value === null) return "";
    return String(value).trim();
}

async function isInviteCodeAlreadyInUse(inviteCode: string): Promise<boolean> {
    if (!inviteCode) return true;

    const [freeSnap, echoSnap, shortLinkSnap, registrySnap] = await Promise.all([
        admin.database().ref(`${FieldInviteCodesDB}/${inviteCode}`).once("value"),
        admin.database().ref(`EchoProInviteCodes/${inviteCode}`).once("value"),
        admin.database().ref(`${FieldShortlinkCodesDB}/${inviteCode}`).once("value"),
        admin.database().ref(`${FieldInviteCodeRegistryDB}/${inviteCode}`).once("value")
    ]);

    return freeSnap.exists() || echoSnap.exists() || shortLinkSnap.exists() || registrySnap.exists();
}

async function reserveInviteCode(inviteCode: string, userId: string, type: string): Promise<boolean> {
    const reservationRef = admin.database().ref(`${FieldInviteCodeRegistryDB}/${inviteCode}`);
    const transactionResult = await reservationRef.transaction((currentValue) => {
        if (currentValue !== null && currentValue !== undefined) {
            return currentValue;
        }

        return {
            userId,
            type,
            createdAt: Date.now()
        };
    });

    return transactionResult.committed;
}

async function generateUniqueInviteCode(userId: string, generator: () => string, maxAttempts: number = 25): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const inviteCode = generator();
        if (!inviteCode) continue;

        if (await isInviteCodeAlreadyInUse(inviteCode)) {
            continue;
        }

        if (await reserveInviteCode(inviteCode, userId, "invite")) {
            return inviteCode;
        }
    }

    throw new Error(`Unable to generate a unique invite code for user ${userId}`);
}

export async function addInviteCodeToUserDb(userDb: DataSnapshot, inviteCode: string): Promise<void> {
    const updateObject: { [key: string]: string } = {};
    updateObject[FieldInviteCode] = inviteCode;
    await userDb.ref.update(updateObject);

}

export async function addInviteCodeToInviteCodeDb(inviteCode: string, userId: string): Promise<void> {
    const updateObject: { [key: string]: string } = {};
    updateObject[inviteCode] = userId;
    const inviteCodesDbRef = await admin.database().ref(FieldInviteCodesDB);
    await inviteCodesDbRef.update(updateObject);

    await admin.database().ref(`${FieldInviteCodeRegistryDB}/${inviteCode}`).set({
        userId,
        type: "invite",
        createdAt: Date.now()
    });
}

export async function addInviteLinkToUserDb(userDb: DataSnapshot, inviteLink: string): Promise<void> {
    const updateObject: { [key: string]: string } = {};
    updateObject[FieldInviteLink] = inviteLink;
    await userDb.ref.update(updateObject);

}

export async function addShortLinkCodeToDb(inviteLink: string, userId: string): Promise<void> {
    const inviteLinkCode = getCodeFromInviteLink(inviteLink);

    const updateObject: { [key: string]: string } = {};
    updateObject[inviteLinkCode] = userId;

    const shortlinkCodesDbRef = await admin.database().ref(FieldShortlinkCodesDB);
    shortlinkCodesDbRef.update(updateObject);
}

export async function removeInviteCodeFromInviteCodeDb(inviteCode: string): Promise<void> {
    await admin.database().ref(FieldInviteCodesDB).child(inviteCode).remove();
}

export async function removeShortLinkInviteCodeFromShortLinkInviteCodeDb(shortLinkInviteCode: string): Promise<void> {
    await admin.database().ref(FieldShortlinkCodesDB).child(shortLinkInviteCode).remove();
}

export async function UpdateAudienceDb(userId: string, parentInviteCode: string): Promise<void> {
    const audienceDbRef = await admin.database().ref(Audicence_DB + "/" + parentInviteCode);
    await audienceDbRef.update({ [userId]: true });
}

export function isUserTheRootUser(userId: string): boolean {
    return userId === RootUserId;
}

export function isParentIdAndUserIdSame(userId: string, parentUid: string): boolean {
    return userId === parentUid;
}

export async function getParentUidFromParentCode(parentInviteCode: string): Promise<string> {
    var inviteCodesDbRef = await admin.database().ref(FieldInviteCodesDB);
    var inviteCodeSnapshot = (await inviteCodesDbRef.child(parentInviteCode).once('value'));
    if (!inviteCodeSnapshot.exists()) {
        console.log("getParentUidFromParentCode - long code doenst exist");
        inviteCodesDbRef = await admin.database().ref(FieldShortlinkCodesDB);
        inviteCodeSnapshot = (await inviteCodesDbRef.child(parentInviteCode).once('value'));
    }

    if (!inviteCodeSnapshot.exists()) {
        console.log("getParentUidFromParentCode - short code doenst exist");
    }

    let parentUid = null;
    if (parentInviteCode === RootUserInviteLink)
        parentUid = RootUserId;
    else
        parentUid = inviteCodeSnapshot.val();

    return parentUid;
}

export async function getInviteCodeFromShortlinkInviteCode(shortLinkInviteCode: string): Promise<string> {
    const shortLinkInviteCodesDbRef = await admin.database().ref(FieldShortlinkCodesDB);
    const userId = (await shortLinkInviteCodesDbRef.child(shortLinkInviteCode).once('value')).val();
    const userDb = await admin.database().ref("Users/" + userId).once('value');
    const inviteCode = userDb.child(FieldInviteCode).val();
    return inviteCode;
}

export async function getInviteLink(userId: string): Promise<string> {
    const inviteLinkSS = await admin.database().ref(`${tournament.Users_DB}/${userId}/${FieldInviteLink}`).once("value");
    return inviteLinkSS.val();
}

function getChildIdsFromChildrenValue(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value
            .map((v) => String(v || "").trim())
            .filter((v) => v.length > 0);
    }
    if (typeof value === "object") {
        return Object.keys(value)
            .map((v) => String(v || "").trim())
            .filter((v) => v.length > 0);
    }
    return [];
}

async function removeChildFromChildrenIdsPath(path: string, childUid: string): Promise<void> {
    const ref = admin.database().ref(path);
    await ref.transaction((currentValue) => {
        if (currentValue === null || currentValue === undefined) {
            return currentValue;
        }

        if (Array.isArray(currentValue)) {
            return currentValue.filter((id) => String(id || "").trim() !== childUid);
        }

        if (typeof currentValue === "object") {
            const next = { ...currentValue };
            delete next[childUid];
            return next;
        }

        return currentValue;
    });
}

async function isDescendantInUsersGraph(rootUid: string, candidateDescendantUid: string): Promise<boolean> {
    if (!rootUid || !candidateDescendantUid) return false;
    if (rootUid === candidateDescendantUid) return true;

    const visited = new Set<string>();
    const queue: string[] = [rootUid];

    while (queue.length > 0) {
        const currentUid = queue.shift() as string;
        if (!currentUid || visited.has(currentUid)) continue;
        visited.add(currentUid);

        const childrenSnap = await admin.database().ref(`${tournament.Users_DB}/${currentUid}/childrenIds`).once("value");
        const children = getChildIdsFromChildrenValue(childrenSnap.val());

        for (const childUid of children) {
            if (!childUid || visited.has(childUid)) continue;
            if (childUid === candidateDescendantUid) return true;
            queue.push(childUid);
        }
    }

    return false;
}

async function updateSpillTreeDepthForSubtree(rootUid: string, rootDepth: number): Promise<void> {
    const visited = new Set<string>();
    const queue: Array<{ uid: string; depth: number }> = [{ uid: rootUid, depth: rootDepth }];

    while (queue.length > 0) {
        const current = queue.shift() as { uid: string; depth: number };
        if (!current.uid || visited.has(current.uid)) continue;
        visited.add(current.uid);

        await admin.database().ref(`${SpillTree_DB}/${current.uid}/depth`).set(current.depth);

        const childrenSnap = await admin.database().ref(`${SpillTree_DB}/${current.uid}/childrenIds`).once("value");
        const childIds = getChildIdsFromChildrenValue(childrenSnap.val());
        for (const childId of childIds) {
            if (!childId || visited.has(childId)) continue;
            queue.push({ uid: childId, depth: current.depth + 1 });
        }
    }
}

export interface ChangeUserParentResult {
    userId: string;
    oldParentUid: string | null;
    newParentUid: string;
    spillOldParentUid: string | null;
    spillNewParentUid: string;
    newSpillDepth: number;
}

/**
 * Admin utility: directly changes a user's parent to another user id.
 * Updates Users/{uid}/parentUid+parentId, old/new parent childrenIds, and SpillTree links.
 */
export async function changeUserParentByUserIds(userId: string, newParentUid: string): Promise<ChangeUserParentResult> {
    const safeUserId = String(userId || "").trim();
    const safeNewParentUid = String(newParentUid || "").trim();

    if (!safeUserId) throw new Error("Missing userId");
    if (!safeNewParentUid) throw new Error("Missing newParentUid");
    if (safeUserId === safeNewParentUid) throw new Error("userId and newParentUid cannot be same");

    const userRef = admin.database().ref(`${tournament.Users_DB}/${safeUserId}`);
    const newParentRef = admin.database().ref(`${tournament.Users_DB}/${safeNewParentUid}`);

    const [userSnap, newParentSnap] = await Promise.all([
        userRef.once("value"),
        newParentRef.once("value")
    ]);

    if (!userSnap.exists()) throw new Error("User not found");
    if (!newParentSnap.exists()) throw new Error("New parent not found");

    const oldParentUidRaw = userSnap.child(FieldParentUid).exists()
        ? userSnap.child(FieldParentUid).val()
        : userSnap.child("parentId").val();
    const oldParentUid = oldParentUidRaw ? String(oldParentUidRaw) : null;

    if (oldParentUid === safeNewParentUid) {
        return {
            userId: safeUserId,
            oldParentUid,
            newParentUid: safeNewParentUid,
            spillOldParentUid: null,
            spillNewParentUid: safeNewParentUid,
            newSpillDepth: 0
        };
    }

    const wouldCreateCycle = await isDescendantInUsersGraph(safeUserId, safeNewParentUid);
    if (wouldCreateCycle) {
        throw new Error("Invalid parent change: new parent is inside user's downline");
    }

    await userRef.update({
        [FieldParentUid]: safeNewParentUid,
        parentId: safeNewParentUid
    });

    if (oldParentUid) {
        await removeChildFromChildrenIdsPath(`${tournament.Users_DB}/${oldParentUid}/${FieldChildrenIds}`, safeUserId);
    }
    await addChildToParentChildrenIds(safeNewParentUid, safeUserId, tournament.Users_DB);

    const spillNodeRef = admin.database().ref(`${SpillTree_DB}/${safeUserId}`);
    const spillNodeSnap = await spillNodeRef.once("value");
    const spillOldParentUidRaw = spillNodeSnap.child("parentUid").exists()
        ? spillNodeSnap.child("parentUid").val()
        : null;
    const spillOldParentUid = spillOldParentUidRaw ? String(spillOldParentUidRaw) : null;

    if (spillOldParentUid) {
        await removeChildFromChildrenIdsPath(`${SpillTree_DB}/${spillOldParentUid}/childrenIds`, safeUserId);
    }

    await admin.database().ref(`${SpillTree_DB}/${safeNewParentUid}/uid`).set(safeNewParentUid);
    await admin.database().ref(`${SpillTree_DB}/${safeNewParentUid}/childrenIds/${safeUserId}`).set(true);

    const newSpillParentDepthSnap = await admin.database().ref(`${SpillTree_DB}/${safeNewParentUid}/depth`).once("value");
    const newSpillDepth = Number(newSpillParentDepthSnap.val() || 0) + 1;
    const joinedAt = spillNodeSnap.child("joinedAt").exists()
        ? Number(spillNodeSnap.child("joinedAt").val() || Date.now())
        : Date.now();

    await spillNodeRef.update({
        uid: safeUserId,
        sponsorUid: safeNewParentUid,
        parentUid: safeNewParentUid,
        depth: newSpillDepth,
        joinedAt
    });

    await updateSpillTreeDepthForSubtree(safeUserId, newSpillDepth);

    await Promise.all([
        vault.markMiningRankRefreshNeeded(oldParentUid).catch((err) => {
            console.error("changeUserParentByUserIds: failed to mark old parent refresh", oldParentUid, err);
        }),
        vault.markMiningRankRefreshNeeded(safeNewParentUid).catch((err) => {
            console.error("changeUserParentByUserIds: failed to mark new parent refresh", safeNewParentUid, err);
        }),
        vault.markMiningRankRefreshNeeded(safeUserId).catch((err) => {
            console.error("changeUserParentByUserIds: failed to mark user refresh", safeUserId, err);
        })
    ]);

    return {
        userId: safeUserId,
        oldParentUid,
        newParentUid: safeNewParentUid,
        spillOldParentUid,
        spillNewParentUid: safeNewParentUid,
        newSpillDepth
    };
}

export async function changeMyParent(userId: string | null, parentInviteCode: string): Promise<any> {
    if (userId === null || !parentInviteCode) return false;
    const newParentUid = await getParentUidFromParentCode(parentInviteCode);
    if (!newParentUid) return false;
    await changeUserParentByUserIds(userId, newParentUid);
    return true;
}

export async function checkIfParentExist(userId: string | null): Promise<boolean> {
    if (userId === "" || userId === null)
        return false;

    const userDb = await admin.database().ref("Users/" + userId).once('value');
    let doesUserExist = userDb.child(FieldParentUid).exists() || userDb.child("parentId").exists();

    if (!doesUserExist) {
        const audienceDb = await admin.database().ref(Audicence_DB + "/" + "00000-00000" + "/" + userId).once('value');
        doesUserExist = audienceDb.exists() ? true : false;
    }

    return doesUserExist;
}

export async function canInviteCodeBeRedeemed(inviteCode: string): Promise<boolean> {
    const parentUid = await getParentUidFromParentCode(inviteCode);
    console.log("canInviteCodeBeRedeemed (gating bypassed) - parentUid: " + parentUid + " inviteCode: " + inviteCode);

    // Temporarily bypass invite gating checks.
    // Keep this logic for future re-enable:
    // if (!utils.isRootUser(parentUid) &&
    //     (await controlled_invites.isInviteLimitReached(parentUid) ||
    //      !await controlled_invites.isInviteEventActive())) {
    //     console.log("IsInviteCodeValid - invite code can't be used - code: " + inviteCode);
    //     return false;
    // }

    return true;
}

export function addAudiencePointsFromReset(level: number = 0): number {
    if (level > 100)
        return 1;
    if (level > 75)
        return 2;
    if (level > 50)
        return 3;
    if (level > 30)
        return 4;
    if (level > 20)
        return 5;
    if (level > 10)
        return 10;
    if (level > 3)
        return 15;
    if (level === 3)
        return 20;
    if (level === 2)
        return 30;
    if (level === 1)
        return 50;
    if (level === 0)
        return 100;
    return 0;
}

export function addAudiencePointsFromPlay(level: number = 0): number {
    if (level > 100)
        return 0.1;
    if (level > 75)
        return 0.2;
    if (level > 50)
        return 0.3;
    if (level > 30)
        return 0.4;
    if (level > 20)
        return 0.5;
    if (level > 10)
        return 0.6;
    if (level > 3)
        return 0.7;
    if (level === 3)
        return 1;
    if (level === 2)
        return 1.5;
    if (level === 1)
        return 2;
    if (level === 0)
        return 3;
    return 0;
}

export async function addResetAudiencePointsToGenealogy(userId: string, level: number = 0, globalAvg: number) {
    const userDb = await admin.database().ref("Users/" + userId).once('value');
    var isWeeklyRPCollected = userDb.child(FieldWavescoreData + "/" + userUtils.FieldIsWeeklyRPCollected).val()
        if(isWeeklyRPCollected)
        {
            console.log("Weekly reset points already collected");
            return;
        }else
        {
            console.log("Weekly reset points collected");
            addAudiencePointsToGenealogy(userId, level, true, globalAvg);
            await userDb.child(FieldWavescoreData).ref.update({[userUtils.FieldIsWeeklyRPCollected]: true})
        }
}


export async function addAudiencePointsToGenealogy(userId: string, level: number = 0, isReset: boolean = false, globalAvg: number) {
    if (userId === RootUserId)
        return;
    const userDb = await admin.database().ref("Users/" + userId).once('value');
    if (!userDb.exists())
        return;

    let points = 0;
    let pointsField = FieldActivityPoints;
    if (isReset) {
        points = addAudiencePointsFromReset(level);
        pointsField = FieldResetPoints;
    }
    else {
        points = addAudiencePointsFromPlay(level);
    }
        
    const currentPoints = userDb.child(FieldWavescoreData + "/" + FieldWaves + "/" + level + "/" + pointsField).val()
    const newPoints = currentPoints + points;
    await userDb.child(FieldWavescoreData + "/" + FieldWaves + "/" + level).ref.update({[pointsField]: newPoints})
    
    console.log("User:" + userId + "level:" + level + " " + pointsField + " points current:" + currentPoints + " --- " + " after adding " + points + " is " + newPoints);

    //console.log("Audience points set for userId:" + userId + " level:" + level + " isReset:" + isReset + " globalAvg:" + globalAvg + " points:" + points);
    await leaderboards.updateAudienceLeaderboard(userId, points, globalAvg);
    console.log("-------------------------UserId:" + userId + " Level:" + level + " Points:" + points);
    
    
    await addAudiencePointsToGenealogy(userDb.child(FieldParentUid).val(), level + 1, isReset, globalAvg);
}

export async function requestWeeklyAction(userId: string): Promise<boolean> {
    const userDb = await admin.database().ref("Users/" + userId).once('value');
    if (!userDb.exists())
        return false;

    const canRequest = await schedule.canRequestWeeklyReward(userDb);
    if (canRequest) {
        const globalAvg = userDb.child(tournament.GlobalAverage_UserDB).exists() ?
            userDb.child(tournament.GlobalAverage_UserDB).val() : 0;
        //Request for user
        await schedule.weeklyReward(userDb);
        //Add to parent
        await addAudiencePointsToGenealogy(userId, 0, true, globalAvg);
        //await tournament.updateRequestWeekDate(userDb);
        return true;
    }
    return false;
}


export async function updatePlayerAudienceConversionRate(userId: string): Promise<number> {
    const userDb = await admin.database().ref("Users/" + userId).once('value');
    if (!userDb.exists()) return 0.0;
    const userRank = await leaderboards.getPlayerLeaderboardRank(leaderboards.Audience_Leaderboard, leaderboards.Audience_Field, userId, leaderboards.Leaderboard_Type.Audience);
    let igcValue = 0.0;
    if (userRank === 1)
        igcValue = 0.21;
    else if (userRank < 21)
        igcValue = 0.311 * Math.pow(userRank, -0.712);
    else
        igcValue = 0.506 * Math.pow(userRank, -1.164);

    await userDb.ref
        .ref.set({
            [Vault_IGC_Value_DB]: igcValue,
            [Vault_Audience_Rank]: userRank
        });
    return igcValue;
}

export async function convertCoins(userId: string, coins: number): Promise<number> {
    console.log("Converting coins " + userId + "  => " + coins + " coins");
    const userDb = await admin.database().ref("Users/" + userId).once('value');

    if (!userDb.exists()) return -1;
    const currentCoins = userDb.child("coins").val()
    if (currentCoins < coins) return -2;

    const cash = userDb.child(Vault_IGC_Value_DB).val() * coins
    const currentCash = userDb.child(Vault_Cash).val();
    const updates: { [key: string]: any } = {};
    updates["coins"] = currentCoins - coins;
    updates[Vault_Cash] = currentCash + cash;


    await userDb
        .ref.update(updates);


    return 0;
}

export async function getChildrenOf(userId: string): Promise<any[]> {
    const childrenSnapshot = await admin.database().ref(`Users/${userId}/childrenIds`).once('value');
    const childrenArr: any[] = childrenSnapshot.val() ? Object.values(childrenSnapshot.val()) : [];
    return childrenArr;
}

export async function getChildrenOfRecursive(userId: string, levelNumber: number, userDictionary: WaveDictionaryClass): Promise<any> {
    const doChildrenExist = (await admin.database().ref(`Users/${userId}/childrenIds`).once('value')).exists();
    if (!doChildrenExist) {
        userDictionary.addItem(levelNumber, userId);
        // console.log("Level " + levelNumber + " user " + userId + " -> Children doesn't exist");
        return;
    }

    const childrenArr = await getChildrenOf(userId);
    // console.log(userId + " is at level " + levelNumber + " and it's children are: " + childrenArr.toString());

    userDictionary.addItem(levelNumber, userId);

    levelNumber++;

    for (const element of childrenArr) {
        await getChildrenOfRecursive(element, levelNumber, userDictionary);
    }
}

function GetSectorScoreFor(wave: any, start: number, end: number): [number, number] {
    if(wave === null)
        return [0, 0];

    let totalScoreAP = 0;
    let totalScoreRP = 0;
    
    for (let i = start; i <= end; i++) {
        totalScoreAP += wave[i] ? (!isNaN(wave[i].AP) ? wave[i].AP : 0) : 0
        totalScoreRP += wave[i] ? (!isNaN(wave[i].RP) ? wave[i].RP : 0) : 0
    }

    // console.log("GetSectorScoreFor start:" + start + " end:" + end + " totalScoreAP:" + totalScoreAP + " totalScoreRP:" + totalScoreRP);
    return [totalScoreAP, totalScoreRP];
}

export async function getNumberOfActiveUsers(userIds: string[]): Promise<number> {
    if(userIds === null)
        return 0;

    let numberOfUsersActive = 0;
    for (const userId of userIds) {
        let isActive = (await admin.database().ref("Users/" + userId + "/" + FieldWavescoreData + "/" + userUtils.FieldIsWeeklyRPCollected).once('value')).val()
        if(isActive)
            numberOfUsersActive += 1;
    }
    return numberOfUsersActive;
}

export async function getNumberOfGamesPlayedCurrentWeek(userIds: string[]): Promise<number> {
    if(userIds === null)
        return 0;

    let numberOfGamesPlayed = 0;
    for (const userId of userIds) {
        let gamesPlayed = (await admin.database().ref("Users/" + userId + "/" + userUtils.FieldNumberOfGamesPlayedCurrentWeek).once('value')).val()
        numberOfGamesPlayed += gamesPlayed;
    }
    return numberOfGamesPlayed;
}

export async function getWavescoreDataForUser(userId: string): Promise<any> {
    // console.log("getWavescoreDataForUser " + userId);

    let userDictionary = new WaveDictionaryClass();
    await getChildrenOfRecursive(userId, 0, userDictionary);

    // let totalWavescorePoints = 0;
    // //fetch user details
    // await leaderboards.getPlayerAnyLeaderboardRank(leaderboards.Audience_Leaderboard, userId)
    // .then((result) => {
    //   console.log("my data: " + JSON.stringify(result));
    //   totalWavescorePoints = result.Score;
    //   return;
    // });

    const waves = (await admin.database().ref(`Users/${userId}/${FieldWavescoreData}/${FieldWaves}`).once('value')).val();

    const sectors: WaveSector[] =  
    [
        new WaveSector(0, 0),
        new WaveSector(1, 3),
        new WaveSector(4, 10),
        new WaveSector(11, 20),
        new WaveSector(21, 30),
        new WaveSector(31, 50),
        new WaveSector(51, 75),
        new WaveSector(76, 100),
        new WaveSector(101, userDictionary.getTotalItemCount())
    ];
    
    //every level count
    // for (const key in userDictionary.getDictionary()) {
    //     if (userDictionary.getDictionary().hasOwnProperty(key)) {
    //         const count = userDictionary.getItemCountForKey(key);
    //         console.log(`Count for ${key}: ${count}`);
    //     }
    // }

    class SectorDataItem {
        Sector: number = 0;
        WaveMembers: number = 0;
        PointsGenerated: number = 0;
        GamesPlayed: number = 0;
        WeeklyActive: number = 0;
    }

    //sector data
    const sectorData: SectorDataItem[] = [];
    let totalWavescoreMembers = 0;

    let i = 0;
    let totalPointsGeneratedAcrossSectors = 0;
    for (const sector of sectors) {
        let usrList = userDictionary.getTotalItemForSector(sector);
        console.log("Sector " + (i) + ": " + JSON.stringify(usrList));

        // let weeklyActive = await getNumberOfActiveUsers(usrList);
        const [totalScoreAP, totalScoreRP] = GetSectorScoreFor(waves, sector.getStart(), sector.getEnd());
        let totalPointsGeneratedForCurrentSector = totalScoreAP + totalScoreRP;
        totalPointsGeneratedAcrossSectors += totalPointsGeneratedForCurrentSector;
        const waveMembers = userDictionary.getTotalItemCountForSector(sector);
        // const gamesPlayed = await getNumberOfGamesPlayedCurrentWeek(usrList);
        sectorData.push({ Sector: i, WaveMembers: waveMembers, PointsGenerated: totalPointsGeneratedForCurrentSector, GamesPlayed: totalScoreAP, WeeklyActive: totalScoreRP});
        totalWavescoreMembers += waveMembers;
        i++;
    }


    let videoUrl = "gs://zpln-3be94.appspot.com/Video/test/BAV3 (1).mp4"
    if(STAGING)
        videoUrl = "https://firebasestorage.googleapis.com/v0/b/zpln-staging.appspot.com/o/Video%2FFinal%2FLBs%2FWS.mp4?alt=media&token=f936214e-ec4e-4018-8e4e-30d24bdaf2ab";
    else
        videoUrl = "https://firebasestorage.googleapis.com/v0/b/zpln-3be94.appspot.com/o/Video%2FNV%2FLB%2FWS.mp4?alt=media&token=73b1efa1-d6b1-42cd-a73d-4177089264ed";

    let waveObj =
    {
        success: true,
        message: "NA",
        TotalWavescoreMembers: totalWavescoreMembers,
        TotalWavescorePoints: totalPointsGeneratedAcrossSectors,
        VideoURL: videoUrl,
        LaunchPadURL: "https://www.google.com/",
        SectorData: sectorData
        // SectorData: [] as SectorDataItem[]
    }

    const jsonData = JSON.stringify(waveObj);
    console.log("getWavescoreDataForUser: " + userId + "\n" + jsonData);
    return jsonData;
}

export async function getLevel1PlayersDataForUser(userId: string, pageNumber: number): Promise<any> {
    let childrenArr = await getChildrenOf(userId);

    const pageLength = 4;
    const startIndex = (pageNumber-1) * pageLength;
    const endIndex = Math.min(startIndex + pageLength, childrenArr.length);
    const isPageLeft = endIndex < childrenArr.length;

    class PlayerDataItem {
        PlayerName: string = "";
        ProfileURl: string = "";
        InviteLink: string = "";
    }

    childrenArr = childrenArr.slice(startIndex, endIndex);
    const playerData: PlayerDataItem[] = [];
    for (const element of childrenArr) {
        const userDataSS = await (admin.database().ref(tournament.Users_DB + "/" + element).once('value'));
        const userData = userDataSS.val();
        playerData.push({ 
            PlayerName: userData.userName, 
            ProfileURl: userData.SavedAvatarURL, 
            InviteLink: userData.inviteLink});
    }
      
    let dataObj =
    {
        success: true,
        message: "NA",
        nextPage: pageNumber+1,
        isEnd: !isPageLeft,
        PlayerData: playerData
    }

    const jsonData = JSON.stringify(dataObj);
    console.log("getSector1PlayersDataForUser: " + userId + "\n" + jsonData);
    return jsonData;
}

//Echo Pro Users - separate invite code and link creation logic since it only applies to a subset of users and we don't want to mess with existing invite code logic for regular users.
/**
 * Create Echo Pro invite code & link if doesn't exist
 * Same logic as game but stores in separate fields
 */
// export async function createEchoProInviteCodeIfDoesntAlreadyExists(userId: string): Promise<void> {
//   const userRef = admin.database().ref(`${tournament.Users_DB}/${userId}`);
//   const snapshot = await userRef.once("value");

//   if (!snapshot.exists()) return;

//   const isEchoPro = snapshot.child(userUtils.FieldIsEchoPro).val() === true;
//   if (!isEchoPro) return; // Only create for Echo Pro users

//   const echoNode = snapshot.child(userUtils.FieldEcho);
  
//   // Create Echo Pro invite code if doesn't exist
//   if (!echoNode.child(userUtils.FieldEchoProInviteCode).exists()) {
//     const echoProInviteCode = utils.generateInviteCode();
//     await userRef.child(`${userUtils.FieldEcho}/${userUtils.FieldEchoProInviteCode}`).set(echoProInviteCode);
//     await admin.database().ref(`EchoProInviteCodes/${echoProInviteCode}`).set(userId);
    
//     const echoProInviteLink = await createDynamicLinkForEchoProInvite(echoProInviteCode);
//     await userRef.child(`${userUtils.FieldEcho}/${userUtils.FieldEchoProInviteLink}`).set(echoProInviteLink);
//     const echoProShortCode = utils.getCodeFromInviteLink(echoProInviteLink);
//     await admin.database().ref(`EchoProShortlinkCodes/${echoProShortCode}`).set(userId);
//   }

//   // Initialize counter if doesn't exist
//   if (!echoNode.child(userUtils.FieldEchoParentInviteCounter).exists()) {
//     await userRef.child(`${userUtils.FieldEcho}/${userUtils.FieldEchoParentInviteCounter}`).set(0);
//   }
// }

// export async function getEchoProParentUidFromInviteCode(inviteCode: string): Promise<string | null> {
//   const echoProSnapshot = await admin.database().ref(`EchoProInviteCodes/${inviteCode}`).once("value");
//   if (echoProSnapshot.exists()) return String(echoProSnapshot.val());

//   const shortlinkSnapshot = await admin.database().ref(`EchoProShortlinkCodes/${inviteCode}`).once("value");
//   if (shortlinkSnapshot.exists()) return String(shortlinkSnapshot.val());

//   return null;
// }


export async function createEchoProInviteCodeIfDoesntAlreadyExists(
  userId: string,
  firstName: string = "",
  lastName: string = ""
): Promise<void> {
  const userRef = admin.database().ref(`${tournament.Users_DB}/${userId}`);
  const snapshot = await userRef.once("value");

  if (!snapshot.exists()) return;

  const isEchoPro = snapshot.child(userUtils.FieldIsEchoPro).val() === true;
  if (!isEchoPro) return;

  const echoNode = snapshot.child(userUtils.FieldEcho);

  if (!echoNode.child(userUtils.FieldEchoProInviteCode).exists()) {

    // get firstName/lastName from DB if not passed
    const fn = firstName || String(snapshot.child("firstName").val() || "X");
    const ln = lastName || String(snapshot.child("lastName").val() || "X");

        // generate unique invite code with collision check across free, echo, and short-link namespaces
        const echoProInviteCode = await generateUniqueInviteCode(userId, () => utils.generateEchoProInviteCode(fn, ln));

    const echoProInviteLink = utils.generateEchoProInviteLink(echoProInviteCode);

    // Save to user Echo node
    await userRef.child(`${userUtils.FieldEcho}/${userUtils.FieldEchoProInviteCode}`).set(echoProInviteCode);
    await userRef.child(`${userUtils.FieldEcho}/${userUtils.FieldEchoProInviteLink}`).set(echoProInviteLink);

    // Save global lookup: EchoProInviteCodes/{code} = userId
    await admin.database().ref(`EchoProInviteCodes/${echoProInviteCode}`).set(userId);
  }

  // Initialize counter if doesn't exist
  if (!echoNode.child(userUtils.FieldEchoParentInviteCounter).exists()) {
    await userRef.child(`${userUtils.FieldEcho}/${userUtils.FieldEchoParentInviteCounter}`).set(0);
  }
}

export async function getEchoProParentUidFromInviteCode(inviteCode: string): Promise<string | null> {
  if (!inviteCode) return null;

  // Check corporate invite code
  if (inviteCode === utils.ECHO_PRO_CORPORATE_INVITE_CODE) {
    return RootUserId; // corporate/root parent
  }

  // Check EchoProInviteCodes table
  const echoProSnapshot = await admin.database()
    .ref(`EchoProInviteCodes/${inviteCode}`)
    .once("value");
  if (echoProSnapshot.exists()) return String(echoProSnapshot.val());

  return null;
}


/**
 * Increment Echo Pro invite counter when user invites someone
 */
export async function incrementEchoProInviteCounter(userId: string): Promise<number> {
  const counterRef = admin.database().ref(`${tournament.Users_DB}/${userId}/${userUtils.FieldEcho}/${userUtils.FieldEchoParentInviteCounter}`);
  
  await counterRef.transaction((current) => {
    const count = Number(current) || 0;
    return count + 1;
  });

  const snap = await counterRef.once("value");
  return Number(snap.val() || 0);
}

/**
 * Get Echo Pro invite counter
 */
export async function getEchoProInviteCounter(userId: string): Promise<number> {
  const snap = await admin.database()
    .ref(`${tournament.Users_DB}/${userId}/${userUtils.FieldEcho}/${userUtils.FieldEchoParentInviteCounter}`)
    .once("value");
  return Number(snap.val() || 0);
}

export async function getEchoProReferrerInfoFromCode(inviteCode: string): Promise<{ userId: string; name: string } | null> {
  if (!inviteCode) return null;
  
 // NEW: corporate referral handling
  if (inviteCode === utils.ECHO_PRO_CORPORATE_INVITE_CODE) {
    return {
      userId: RootUserId,
      name: "Echo Corporate"
    };
  }

  const parentUid = await getEchoProParentUidFromInviteCode(inviteCode);
  if (!parentUid) return null;

  // NEW: if resolved to root, return corporate name
  if (parentUid === RootUserId) {
    return {
      userId: RootUserId,
      name: "Echo Corporate"
    };
  }

  const parentSnap = await admin.database().ref(`${tournament.Users_DB}/${parentUid}`).once("value");
  if (!parentSnap.exists()) return null;

  const firstName = parentSnap.child("firstName").val() || "";
  const lastName = parentSnap.child("lastName").val() || "";
  const userName = parentSnap.child("userName").val() || "";

  const fullName = `${firstName} ${lastName}`.trim();
  return {
    userId: parentUid,
    name: fullName.length > 0 ? fullName : userName
  };
}

export async function addChildToParentChildrenIds(
  parentUid: string,
  childUid: string,
  rootPath: string = tournament.Users_DB
): Promise<void> {
  if (!parentUid || !childUid) return;

  const childrenRef = admin.database().ref(`${rootPath}/${parentUid}/childrenIds`);
  const snap = await childrenRef.once("value");

  // If missing, create object-map style
  if (!snap.exists()) {
    await childrenRef.set({ [childUid]: true });
    return;
  }

  const val = snap.val();

  // If array style exists, convert safely to object-map
  if (Array.isArray(val)) {
    const mapped: Record<string, boolean> = {};
    for (const id of val) {
      const k = String(id || "").trim();
      if (k) mapped[k] = true;
    }
    mapped[childUid] = true;
    await childrenRef.set(mapped);
    return;
  }

  // Object-map style
  if (typeof val === "object" && val !== null) {
    if (val[childUid] === true) return;
    await childrenRef.child(childUid).set(true);
    return;
  }

  // Fallback
  await childrenRef.set({ [childUid]: true });
}

/**
 * BFS-based SpillTree allocator.
 *
 * Rules:
 *  - Each node in SpillTree may have at most `maxDirectChildren` (default 5) direct children.
 *  - childrenIds is stored as an object-map { childUid: true } — NEVER as an array — so that
 *    Firebase serialisation is stable and Object.keys() reliably returns UIDs, not numeric indices.
 *  - numChildren() is used for slot counting (authoritative, no serialisation ambiguity).
 *
 * Example (maxDirectChildren = 5):
 *  A already has 1,2,3,4,5.  1 already has B,C.
 *  When 6..10 join under A:
 *    6,7,8 → placed under 1  (1 now has B,C,6,7,8  = 5 full)
 *    9,10  → placed under 2  (2 now has 9,10)
 */
export async function addUserToSpillTree(
    sponsorUid: string,
    childUid: string,
    maxDirectChildren: number = SpillTreeMaxDirectChildren
): Promise<{ assignedParentUid: string; depth: number } | null> {
    if (!sponsorUid || !childUid) return null;
    if (sponsorUid === childUid) return null;

    const limit = Number.isFinite(maxDirectChildren) && maxDirectChildren > 0
        ? Math.floor(maxDirectChildren)
        : SpillTreeMaxDirectChildren;

    const spillRootRef = admin.database().ref(SpillTree_DB);
    const childNodeRef = spillRootRef.child(childUid);
    const existingChildNode = await childNodeRef.once("value");

    // Idempotent: child already placed → return existing assignment.
    if (existingChildNode.exists() && existingChildNode.child("parentUid").exists()) {
        return {
            assignedParentUid: String(existingChildNode.child("parentUid").val() || ""),
            depth: Number(existingChildNode.child("depth").val() || 0)
        };
    }

    // BFS — find the first node (breadth-first from sponsor) that still has an open slot.
    const queue: Array<{ uid: string; depth: number }> = [{ uid: sponsorUid, depth: 0 }];
    const visited = new Set<string>();

    let assignedParentUid = sponsorUid;
    let assignedDepth = 1;

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (!current.uid || visited.has(current.uid)) continue;
        visited.add(current.uid);

        // childrenIds is always stored as { uid: true } object-map.
        const currentChildrenSnap = await spillRootRef
            .child(`${current.uid}/childrenIds`)
            .once("value");

        // numChildren() is the only reliable count — no serialisation ambiguity.
        const childCount = currentChildrenSnap.numChildren();

        if (childCount < limit) {
            assignedParentUid = current.uid;
            assignedDepth = current.depth + 1;
            break;
        }

        // This node is full — enqueue its children for the next BFS level.
        if (currentChildrenSnap.exists()) {
            const val = currentChildrenSnap.val() || {};
            // val is always { uid: true } so Object.keys = real UIDs.
            for (const nextUid of Object.keys(val)) {
                if (nextUid && !visited.has(nextUid)) {
                    queue.push({ uid: nextUid, depth: current.depth + 1 });
                }
            }
        }
    }

    // Insert child into assigned parent's childrenIds as object-map entry.
    // This is a single set — no transaction needed because each childUid is unique.
    await spillRootRef
        .child(`${assignedParentUid}/childrenIds/${childUid}`)
        .set(true);

    // Ensure parent and sponsor nodes have their uid field set (useful for reads).
    await spillRootRef.child(`${assignedParentUid}/uid`).set(assignedParentUid);
    await spillRootRef.child(`${sponsorUid}/uid`).set(sponsorUid);

    // Write child node metadata.
    // Do NOT write childrenIds here — it will be created naturally
    // when this child's own referrals are added later.
    await childNodeRef.update({
        uid: childUid,
        sponsorUid,
        parentUid: assignedParentUid,
        depth: assignedDepth,
        joinedAt: Date.now()
    });

    return { assignedParentUid, depth: assignedDepth };
}

export async function backfillChildrenIdsForRoot(rootPath: string): Promise<{
  scanned: number;
  linked: number;
  skippedNoParent: number;
  parentNotFound: number;
}> {
  // Strip leading slash - Firebase root multi-path updates don't support leading /
  const safePath = rootPath.replace(/^\/+/, "");

  const rootSnap = await admin.database().ref(safePath).once("value");

  let scanned = 0;
  let linked = 0;
  let skippedNoParent = 0;
  let parentNotFound = 0;

  if (!rootSnap.exists()) {
    return { scanned, linked, skippedNoParent, parentNotFound };
  }

  const all = rootSnap.val() || {};
  const updates: Record<string, any> = {};

  for (const uid of Object.keys(all)) {
    scanned++;
    const node = all[uid] || {};
    const parentUid = String(node.parentUid || node.parentId || "").trim();

    if (!parentUid) {
      skippedNoParent++;
      continue;
    }

    if (!all[parentUid]) {
      parentNotFound++;
      continue;
    }

    // Use safe path without leading slash
    updates[`${safePath}/${parentUid}/childrenIds/${uid}`] = true;
    linked++;
  }

  console.log(`backfillChildrenIdsForRoot [${safePath}] — updates to apply:`, Object.keys(updates).length);

  if (Object.keys(updates).length > 0) {
    // Use root ref with multi-path update
    await admin.database().ref("/").update(updates);
    console.log(`backfillChildrenIdsForRoot [${safePath}] — done`);
  }

  return { scanned, linked, skippedNoParent, parentNotFound };
}

/**
 * One-time backfill: builds SpillTree for all existing users in Users DB.
 *
 * Processing order:
 *   1. Read all users from RTDB.
 *   2. For each user that has a parentUid/parentId, sort by createdAt asc
 *      (oldest first) so the spill BFS respects original join order.
 *   3. Users with no parent (root-level) are initialised as bare SpillTree
 *      nodes with no parentUid so they act as valid roots.
 *   4. Already-placed users (parentUid already in SpillTree node) are skipped
 *      (idempotent — safe to re-run).
 *
 * Returns a summary: { scanned, placed, skipped, failed, noParent }.
 */
export async function backfillSpillTree(rootPath: string = tournament.Users_DB): Promise<{
  scanned: number;
  placed: number;
  skipped: number;
  failed: number;
  noParent: number;
}> {
  const safePath = rootPath.replace(/^\/+/, "");
  const rootSnap = await admin.database().ref(safePath).once("value");

  let scanned = 0, placed = 0, skipped = 0, failed = 0, noParent = 0;

  if (!rootSnap.exists()) return { scanned, placed, skipped, failed, noParent };

  const all = rootSnap.val() as Record<string, any>;
  const allUids = Object.keys(all);

  // Build a list of { uid, parentUid, createdAt } and sort oldest-first.
  type UserEntry = { uid: string; parentUid: string; createdAt: number };
  const entries: UserEntry[] = [];

  for (const uid of allUids) {
    scanned++;
    const node = all[uid] || {};
    const parentUid = String(node.parentUid || node.parentId || "").trim();
    // createdAt stored on user node; fall back to 0 so they sort first
    const createdAt = Number(node.createdAt || node.joinedAt || 0);
    entries.push({ uid, parentUid, createdAt });
  }

  // Sort ascending by creation time so older users are placed first.
  entries.sort((a, b) => a.createdAt - b.createdAt);

  const spillRootRef = admin.database().ref(SpillTree_DB);

  for (const entry of entries) {
    const { uid, parentUid } = entry;

    if (!parentUid || !all[parentUid]) {
      // Root-level user or parent not in this snapshot — create a bare node
      // so they can serve as a valid BFS root for their own referrals.
      const existingSnap = await spillRootRef.child(uid).once("value");
      if (!existingSnap.exists()) {
        await spillRootRef.child(uid).update({ uid, joinedAt: entry.createdAt || Date.now() });
      }
      noParent++;
      continue;
    }

    try {
      const result = await addUserToSpillTree(parentUid, uid);
      if (result === null) {
        // addUserToSpillTree returns null only for bad args — treat as skip.
        skipped++;
      } else {
        // "placed" counts both new placements and idempotent re-confirmations.
        placed++;
      }
    } catch (err) {
      console.error(`backfillSpillTree: failed for uid=${uid} parent=${parentUid}`, err);
      failed++;
    }
  }

  console.log(`backfillSpillTree [${safePath}] — scanned=${scanned} placed=${placed} skipped=${skipped} failed=${failed} noParent=${noParent}`);
  return { scanned, placed, skipped, failed, noParent };
}

