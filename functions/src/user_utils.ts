import * as admin from 'firebase-admin';
import * as utils from "./utils";
import * as audience from "./audience";
import * as tournament from './tournament';
import { UserRecord } from 'firebase-admin/auth';
import { DataSnapshot } from 'firebase-admin/database';
//void user_utils;
const FIELD_USERNAME = "userName";
const FIELD_LEVELNAME = "levelName";
const FIELD_PHONE = "phone";
export const FieldIsWeeklyRPCollected = "IsWeeklyRPCollected";
export const FieldNumberOfGamesPlayedCurrentWeek = "NumberOfGamesPlayedCurrentWeek";
export const TotalGamesToAccountForGlobalAverage = 9;//15;

export const PLAYER_LEVEL: string[] =
    [
        "Novice",
        "Level 1",
        "Level 2",
        "Level 3",
        "Level 4",
        "Maestro",
        "Architect",
        "Alpha",
        "Alpha 2",
        "Omega",
        "Omega 2",
        "Light Master",
    ];


export async function isUserPresentInDb(userId: string): Promise<boolean> {
    return (await admin.database().ref("Users/" + userId).once("value")).exists();
}


// Tutorial VO field constants
export const Tutorial_DB = "tutorial";
export const TutorialFields = {
    Echo_Events_VO: "Echo_Events_VO",
    Echo_Matrix_VO: "Echo_Matrix_VO",
    Rank_Rewards_VO: "Rank_Rewards_VO",
    Homepage_VO: "Homepage_VO",
    Pro_Events_VO: "Pro_Events_VO",
    The_VIP_Club_VO: "The_VIP_Club_VO",
    Gameplay_Tutorial_VO: "Gameplay_Tutorial_VO",
} as const;


//Echo Pro Users
export const FieldIsEchoPro = "isEchoPro";
export const FieldEcho = "Echo";
export const FieldEchoProInviteCode = "echoProInviteCode";
export const FieldEchoProInviteLink = "echoProInviteLink";
export const FieldEchoParentInviteCounter = "echoParentInviteCounter";


export type TutorialFieldKey = keyof typeof TutorialFields;

export interface TutorialStatus {
    Echo_Events_VO: boolean;
    Echo_Matrix_VO: boolean;
    Rank_Rewards_VO: boolean;
    Homepage_VO: boolean;
    Pro_Events_VO: boolean;
    The_VIP_Club_VO: boolean;
    Gameplay_Tutorial_VO: boolean;
}

const defaultTutorialStatus = (): TutorialStatus => ({
    Echo_Events_VO: false,
    Echo_Matrix_VO: false,
    Rank_Rewards_VO: false,
    Homepage_VO: false,
    Pro_Events_VO: false,
    The_VIP_Club_VO: false,
    Gameplay_Tutorial_VO: false,
});

export async function getTutorialStatus(userId: string): Promise<TutorialStatus> {
    const snap = await admin.database()
        .ref(`${tournament.Users_DB}/${userId}/${Tutorial_DB}`)
        .once("value");

    const defaults = defaultTutorialStatus();
    if (!snap.exists()) return defaults;

    const data = snap.val() || {};
    // Merge with defaults so missing fields always return false
    return {
        ...defaults,
        ...Object.fromEntries(
            Object.keys(defaults).map(k => [k, data[k] === true])
        )
    } as TutorialStatus;
}

export async function updateTutorialStatus(userId: string, field: TutorialFieldKey, value: boolean): Promise<TutorialStatus> {
    if (!Object.keys(TutorialFields).includes(field)) {
        throw new Error(`Invalid tutorial field: ${field}`);
    }
    await admin.database()
        .ref(`${tournament.Users_DB}/${userId}/${Tutorial_DB}/${field}`)
        .set(value);

    return getTutorialStatus(userId);
}


// export async function setNumberOfGamesPlayedCurrentWeek(userId: string, val: number): Promise<void> {
//     const userDb = (await admin.database().ref("Users/" + userId).once("value")).val();
//     await userDb.update({ [FieldNumberOfGamesPlayedCurrentWeek]: val });
// }

// export async function incrementNumberOfGamesPlayedCurrentWeek(userId: string): Promise<void> {
//     let val = (await admin.database().ref("Users/" + userId + "/" + FieldNumberOfGamesPlayedCurrentWeek).once("value")).val();
//     val += 1;
//     await setNumberOfGamesPlayedCurrentWeek(userId, val);
// }

export async function isPhoneNumberPresentInAuth(phone: string): Promise<boolean> {
    console.log("isPhoneNumberPresentInAuth: " + phone);

    if (await getUserIdByPhoneNumber(phone) !== "")
        return true;
    else
        return false;
}

export async function getUserIdByPhoneNumber(phone: string): Promise<string> {
    console.log("getUserIdByPhoneNumber: " + phone);
    let authUserFromNumber = "";
    try {
        authUserFromNumber = (await admin.auth().getUserByPhoneNumber(phone)).uid;
    } catch (error) {
        return authUserFromNumber;
    }
    return authUserFromNumber;
}

export async function getUser(userId: string): Promise<DataSnapshot> {
    // console.log("getUsername: " + userId);
    return (await admin.database().ref(tournament.Users_DB + "/" + userId).once("value"));
}

export async function getUsername(userId: string): Promise<string> {
    // console.log("getUsername: " + userId);
    return (await getUser(userId)).child(FIELD_USERNAME).val();
}

export async function getPhonenumber(userId: string): Promise<string> {
    // console.log("getPhonenumber: " + userId);
    return (await getUser(userId)).child(FIELD_PHONE).val();
}

export async function getLevel(userId: string): Promise<number> {
    // console.log("getUsername: " + userId);
    const levelname = (await getUser(userId)).child(FIELD_LEVELNAME).val();
    console.log("getLevel: " + levelname);
    return PLAYER_LEVEL.indexOf(levelname);
}

export async function deleteUserFromDbCompletely(userId: string): Promise<void> {
    console.log("deleteUserFromDbCompletely: " + userId);
    let arrayOfActiveEventsUserHasEnrolledIn: string[] = await utils.getArrayOfActiveEventsUserHasEnrolledIn(userId);

    let arrStr = "userId --- arrayOfActiveEventsUserHasEnrolledIn \n";
    for (let event of arrayOfActiveEventsUserHasEnrolledIn) {
        arrStr += "\n" + event;
    }
    console.log(arrStr);

    await utils.removeUserDataForProvidedEventList(userId, arrayOfActiveEventsUserHasEnrolledIn);
    await audience.UpdateParentChildConnectionsBeforeUserRemoval(userId);

    let inviteCode = (await admin.database().ref("Users/" + userId + "/inviteCode").once("value")).val();
    if (inviteCode != null)
        await audience.removeInviteCodeFromInviteCodeDb(inviteCode);

    let inviteLink = (await admin.database().ref("Users/" + userId + "/" + audience.FieldInviteLink).once("value")).val();
    if (inviteLink != null) {
        const shortLinkInviteCode = utils.getCodeFromInviteLink(inviteLink);
        await audience.removeShortLinkInviteCodeFromShortLinkInviteCodeDb(shortLinkInviteCode);
    }

    utils.removeUserRecord(userId);

    try {
        await admin.auth().deleteUser(userId);
        console.log(`User with ID ${userId} successfully deleted.`);
    } catch (error) {
        console.error('Error deleting user:', error);
    }
}

export async function getAllUsersFromAuth(): Promise<UserRecord[]> {
    let userRecords: UserRecord[] = [];
    try {
        let listUsersResult = await admin.auth().listUsers();
        return listUsersResult.users;
    } catch (error) {
        console.error('Error listing users:', error);
    }
    return userRecords;
}

export async function getAllUsersFromAuthDescOrderedByCreationTime(): Promise<UserRecord[]> {
    const users = await getAllUsersFromAuth();
    users.sort((a, b) => {
        return new Date(b.metadata.creationTime).getTime() - new Date(a.metadata.creationTime).getTime();
    });
    return users;
}

export async function hasUserJoinedExhibitionEvent(userId: string): Promise<boolean> {
    let activeTournaments: any[] = await tournament.getActiveExhibitionTournaments()
    for (let event of activeTournaments) {
        let players: { [key: string]: boolean } = event.Players;
        console.log("===========players " + JSON.stringify(players));
        console.log("===========userId " + userId);

        if ((players !== undefined) && (players[userId])) {
            return true;
        }
    };
    return false;
}


export async function hasUserPlayedEnoughGamesToCalculateRandAndAvg(userId: string): Promise<boolean> {
    const averageWindowRef = admin.database()
        .ref(tournament.Users_DB + "/" + userId + "/" + tournament.AverageWindow_UserDB);
    const averageWindow = await averageWindowRef
        .once('value');

    const averagesCount = averageWindow.numChildren();

    if (averagesCount >= TotalGamesToAccountForGlobalAverage)
        return true;

    return false;
}

export async function resetCoinsForAllUsers(resetCoinCount: Number): Promise<string> {
    try {
        const snapshot = await admin.database().ref('/Users').once('value');
        const users = snapshot.val();
        
        // Iterate over each user
        Object.keys(users).forEach(async (userId) => {
          const userRef = admin.database().ref(`/Users/${userId}/vault`);
          
          // Update coins value for each user (e.g., increase coins by 100)
          await userRef.update({ coins: resetCoinCount });
        });
    
        return 'Coins updated for all users successfully.';
      } catch (error) {
        console.error('Error updating coins:', error);
        return 'Internal Server Error';
      }
}
