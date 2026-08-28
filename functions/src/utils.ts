

import Reference = admin.database.Reference;
import * as admin from "firebase-admin";
import * as audience from "./audience";
import * as vault from "./vault";
import * as leaderboards from './leaderboards';
import * as referralCodes from '../node_modules/referral-codes/index';
import * as tournament from "./tournament";



import DataSnapshot = admin.database.DataSnapshot;
import {
    Tournaments_Users_DB,
    Users_DB,
    Event_Finales_Users_DB,
    Active_Tournaments_DB,
    Coins_Users_DB, GlobalAverage_UserDB
} from "./tournament";

import {Weekly_Coins_Reward} from "./schedule_tasks"



export const DefaultTimeZone = 'Etc/GMT' // 'America/Los_Angeles';
export const DefaultTimeZoneSwift = 0;

export function moveFirebaseRecord(fromPath: Reference, toPath: Reference){
    return new Promise<void>((resolve, reject) => {
        fromPath.once('value').then(snap => {
            return toPath.set(snap.val());
        }).then(() => {
            return fromPath.set(null);
        }).then(() => {
            console.log('Done!');
            resolve();
        }).catch(err => {
            console.log(err.message);
            reject();
        });
    });
}


export const listAllUsers = (nextPageToken?: undefined|string): Promise<Array<string>> => {
    const uids:Array<string> = [];
    // List batch of users, 1000 at a time.
    return admin
        .auth()
        .listUsers(1000, nextPageToken)
        .then((listUsersResult) => {
            listUsersResult.users.forEach((userRecord) => {
                //console.log('user', userRecord.toJSON());
                uids.push(userRecord.uid);
            });
            if (listUsersResult.pageToken) {
                // List next batch of users.
                listAllUsers(listUsersResult.pageToken).then(result=>{
                    uids.concat(result);
                }).catch();
            }
            return uids;
        })
        .catch((error) => {
            console.log('Error listing users:', error);
            return uids;
        });
};

export const deleteUsers = (uids: string[])=>{
    admin
        .auth()
        .deleteUsers(uids)
        .then((deleteUsersResult) => {
            console.log(`Successfully deleted ${deleteUsersResult.successCount} users`);
            console.log(`Failed to delete ${deleteUsersResult.failureCount} users`);
            deleteUsersResult.errors.forEach((err) => {
                console.log(err.error.toJSON());
            });
        })
        .catch((error) => {
            console.log('Error deleting users:', error);
        });
};

export async function CreateUserFromJson(userId: string, userName: string, phone:string, parentId: string, savedAvatarURL: string): Promise<DataSnapshot> {
     await admin.database().ref(Users_DB)
        .child(userId).update({
            userName: userName,
            phone: phone,
            SavedAvatarURL: savedAvatarURL,
            userId: userId,
            parentId: parentId
        }
    )
    return await admin.database().ref(Users_DB+"/"+userId).once('value');
}

export async function SetUsernameOfUser(userId: string, userName: string): Promise<DataSnapshot> {
    await admin.database().ref(Users_DB)
       .child(userId).update({
           userName: userName
       }
   )
   return await admin.database().ref(Users_DB+"/"+userId).once('value');
}


export async function PlayerExtraConfiguration(snapshot:DataSnapshot ): Promise<boolean>{

    let phoneNumber = ''
    if (snapshot.key !== null) {
        const au = await admin.auth().getUser(snapshot.key);
        phoneNumber = au.phoneNumber !== undefined?au.phoneNumber:''
    }
    if (snapshot.child("registrationComplete").exists() &&
        snapshot.child("registrationComplete").val()===1)
        return false;

    if (snapshot.child("registrationLink").exists() &&
        snapshot.child("registrationLink").val()!=="") {
        console.log("Created user:"+snapshot.key+" with RegistrationLink =>"+snapshot.child("registrationLink").val())

        await audience.setParentId(snapshot.key, snapshot.child("registrationLink").val());
    }

    await vault.InitializeVault(snapshot.key, true);

    console.log("Setting initial "+ Weekly_Coins_Reward +" coins for"+snapshot.key);
    const refreshDb = await admin.database().ref(Users_DB+"/"+snapshot.key).once('value');

    await refreshDb.ref.update({

        [Coins_Users_DB]: Weekly_Coins_Reward,
        registrationComplete: 1,
        phone: phoneNumber

    });
    return true;
}


export async function PlayerExtraConfigurationById(userId:string ) {
    const userData = await admin.database().ref(Users_DB+'/'+userId).once('value');
    if (userData === null)
        return;

    return PlayerExtraConfiguration(userData);
}

export async function ModifyUserProfile(userId: string, data:any) {
    return admin.database().ref(Users_DB+'/'+userId).update(data);
}

export async function ResetAllUsersData(onlyActives: boolean): Promise<any>{
//    const userIds = await listAllUsers();


//    for (const userId of userIds){
//        console.log("Reset User: "+userId);
//        await ResetUserData(userId, true, true);
//    }
    let userIdsLen = 0;
    await admin.database().ref(Users_DB)
        .orderByKey()
        .on('child_added',
            function (snapshot)
    {
        let userId = snapshot.key;
        userIdsLen ++;

        ResetUserData(userId, true, true)
            .then(()=>{
                console.log("Reset User: "+userId);
        }).catch((err)=>{
            console.warn("Reset User ERROR: "+userId+" : "+err);
        });
    });

    await CleanPracticeScores()

    return {usersReset: userIdsLen}
}

export async function ResetUserData(userId: string|null, resetLevel:boolean = false, initializeVault:boolean = false){
    if (userId === null) return;

    const userRef = admin.database().ref(Users_DB+'/'+userId);
    await userRef.child(Event_Finales_Users_DB).remove();
    await userRef.child(Tournaments_Users_DB).remove();

    if (resetLevel) await leaderboards.resetPlayerLevel(userId);

    if (initializeVault) await vault.InitializeVault(userId, false);


    await userRef.update({
        coins: 0,
        coinsValue:0.0,
        [Coins_Users_DB]: Weekly_Coins_Reward,
        highestScoreEver: 0,
        [GlobalAverage_UserDB]: 0
    });
}



//#region Practice Scores

export async function CleanPracticeScores(){
    return admin.database()
        .ref(Users_DB).orderByKey().on('child_added',
            function(snapshot) {
                console.log("Cleaning Practice for "+snapshot.key);
                snapshot.ref.update({
                    practiceGlobalAverage: 0,
                    practiceSeriesTotal: 0,
                    currentPracticeGameIndex: 0,
                    currentPracticeGameSet: 0,
                    PracticeAverageWindow: null

                }).then (()=>{
                    console.log("Clean Practice DONE for "+snapshot.key);
                }).catch((err)=>{
                    console.warn(err)
                });}
        );

}
//#endregion

export function changeTimeZone(date: string|Date, timeZone:string = DefaultTimeZone) {
    if (typeof date === 'string') {
        return new Date(
            new Date(date).toLocaleString('en-US', {
                timeZone,
            }),
        );
    }

    return new Date(
        date.toLocaleString('en-US', {
            timeZone,
        }),
    );
}

export async function getCoinsValuesParameter(rank: number): Promise<number>{
    const coinsVal = await admin.database().ref("Parameters/coinsValues/"+rank).once('value');
    return coinsVal.val();
}

export async function checkActiveEventId(eventId: string): Promise<number> {
    const eventData = await admin.database().ref(Active_Tournaments_DB+'/'+eventId).once('value');
    return eventData.exists()?1:0

}

export async function checkUserId(userId: string): Promise<number> {
    const userData = await admin.database().ref(Users_DB+'/'+userId).once('value');
    return userData.exists()?1:0

}

/***
 * STATES
 *    0 -> Us: No, Ph: No >> 0/null
 *    1 -> Us: Yes, Ph: No >> 1/null
 *    2 -> Us: No, Ph: Yes >> 2/userId
 *    3 -> Us: Yes, Ph: Yes (usrIds not match) >> 3/null
 *    4 -> Us: Yes, Ph: Yes (usrIds match)) >> 4/userId
 * @param userName
 * @param phoneNumber
 */
export async function checkUserName(userName: string, phoneNumber: string|null): Promise<any> {
    console.log("Check userName:"+userName+" with phone:"+phoneNumber)

    const userResponse = await checkUser(userName);
    const phoneResponse = await checkPhone(phoneNumber);

    console.log("json userResponse: " + JSON.stringify(userResponse));
    console.log("json phoneResponse: " + JSON.stringify(phoneResponse));

    let finalResponse = {
        exists: 0,
        userId: null
    } ;

    if(userResponse.exists === 1 && phoneResponse.exists === 1)
    {
        if(userResponse.userId == phoneResponse.userId)
        {
            //both exist - old user
            finalResponse.exists = 1;
            finalResponse.userId = userResponse.userId;
        }else
        {
            //both exists - but belongs to different users.
            finalResponse.exists = 2;
            finalResponse.userId = userResponse.userId;
        }

    }else if(userResponse.exists === 1 && phoneResponse.exists === 0)
    {
        //only user exists, no phone number
        finalResponse.exists = 2;
        finalResponse.userId = userResponse.userId;

    }else if(userResponse.exists === 0 && phoneResponse.exists === 1)
    {
        //only phone number exists, no user
        finalResponse.exists = 2;
        finalResponse.userId = phoneResponse.userId;

    }else if(userResponse.exists === 0 && phoneResponse.exists === 0)
    {
        //both doesnt exist - virgin pair
        finalResponse.exists = 0;
        finalResponse.userId = null;
    }

    // if (userResponse.userId === phoneResponse.userId && finalResponse.exists>0){
    //     finalResponse.exists += 1; //STATE 4

    // }
    // if (finalResponse.exists % 2 === 0 ) //STATES 2,4
    //     finalResponse.userId = phoneResponse.userId

    return finalResponse;

}

async function checkUser(userName: string|null): Promise<any> {
    if (userName === null) return {exists:0, userId: null};

    const normalizedInput = String(userName).trim().toLowerCase();
    const userData = await admin.database().ref(Users_DB).once('value');

    const databaseName = admin.database().ref().toString();
    console.log(`Firebase Realtime Database Name: ${databaseName}`);

    let result = {exists: 0, userId: ""};
    userData.forEach((user) => {
        const storedUserName = String(user.child("userName").val() ?? "").trim().toLowerCase();
        if (storedUserName === normalizedInput) {
            result.exists = 1;
            result.userId = user.key as string;
            console.log("checkUser ========================= user: " + user.key);
            return true;
        }
        return false;
    });
    return result;
}

export async function checkPhone(phoneNumber: string|null): Promise<any> {
    if (phoneNumber === null) return {exists:0, userId: null};

    let user;
    let doesPhoneNumberExists = false;
    try {
        user = await admin.auth().getUserByPhoneNumber(phoneNumber);
        doesPhoneNumberExists = true;
      } catch (error) {
        // console.error('Error checking phone number:', error);
      }

    console.log("checkPhone ========================= user: " + user?.uid + " -doesPhoneNumberExists: " + doesPhoneNumberExists);
      
    // const phoneData = await admin.database()
    //     .ref(Users_DB)
    //     .orderByChild("phone").equalTo(phoneNumber).once('value');

    // let result = {exists: phoneData.exists()?1:0, userId: null};

    let result = {exists: doesPhoneNumberExists?1:0, userId: user?user.uid: null};

    // phoneData.forEach((user)=>{
    //     result.userId = user.child("userId").val();
    //     return true;
    // });
    return result;
}

export async function checkUserPin(userName: string, pin:string):Promise<any>{
    const userData = await admin.database().ref(Users_DB).orderByChild("userName").equalTo(userName).once('value');
    console.log("UserData:"+userData.exists())

    if (userData.exists()){
        let result = 0;
        let userId = null;
        userData.forEach((user)=>{
            const userPin = user.child("userPin").val();
            result = pin === userPin?1:0;
            userId = user.key;
            if (result===1)
                return true;
            return false;
        });

        return {correct:result,userId:userId}

    }
    return {correct:0,userId:null};
}

export async function createUserPin(userId: string, pin: string) {

    await admin.database()
        .ref(Users_DB+'/'+userId)
        .update({userPin:pin});

}

export async function updateUserActivity(userId: string){
    return admin.database()
        .ref(Users_DB+'/'+userId)
        .update({lastActivity:Date.now()})
}

export function parseInteger(value: string) {
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    } else {
      return NaN;
    }
  }

export function generateInviteCode(): string {
    let inviteId: string[] = [];
  
    inviteId = referralCodes.generate({
        length: 6,
        count: 1
      });

      return inviteId[0];
  }
  
export async function getArrayOfActiveEventsUserHasEnrolledIn(userId: string): Promise<string[]> {
    let arrayOfActiveEventsUserHasEnrolledIn:string[] = [];
    let activeTournamentsSS = (await admin.database().ref("Active_Tournaments").once("value"));
    activeTournamentsSS.forEach(aT => {
      var playersSS = aT.child("Players");
      playersSS.forEach(element => {
        if(userId === element.key)
        {
          arrayOfActiveEventsUserHasEnrolledIn.push(String(aT.key));
          return;
        }
      });
    });
    return arrayOfActiveEventsUserHasEnrolledIn;
  }

export async function removeUserDataForProvidedEventList(userId: string, arrayOfActiveEventsUserHasEnrolledIn: string[]): Promise<void> {
    // - users in Active_Tournaments.
    arrayOfActiveEventsUserHasEnrolledIn.forEach(async aT => {
        let activeTournamentPath = "Active_Tournaments/" + aT;
        await admin.database().ref(activeTournamentPath + "/Players/" + userId).remove()

        // update numberOfPlayers count
        await admin.database().ref(activeTournamentPath).transaction((event) => {
            if (event) {
                if (!event.numberOfPlayers) {
                    event.numberOfPlayers = 0;
                }
                event.numberOfPlayers -= 1;
            }
            return event;
        })
    });

    // - users in Audience.NOT IMPORTANT

    // firestore
    arrayOfActiveEventsUserHasEnrolledIn.forEach(async element => {
        await removeUserRecordFromLeaderboard(userId, element);
    });
    await removeUserRecordFromLeaderboard(userId, leaderboards.Audience_Leaderboard);
    await removeUserRecordFromLeaderboard(userId, leaderboards.HighScore_Leaderboard);
    await removeUserRecordFromLeaderboard(userId, leaderboards.Jackpot_Leaderboard);

}

export async function removeUserRecordFromLeaderboard(userId: string, leaderboardId: string): Promise<void> {

    let collectionPath = admin.firestore().collection(leaderboardId);

    console.log("Removine user from leaderboard -- userId:" + userId + " leaderboardId:" + leaderboardId);

    // - firestore database event.
    await collectionPath.doc(userId).delete();

    //- firestore database update the count
    let documentName = "counter";
    const documentKey = "count";
    await admin.firestore().runTransaction(async (transaction) => {
        const documentRef = collectionPath.doc(documentName);
        const documentSnapshot = await transaction.get(documentRef);
        const currentValue = documentSnapshot.get(documentKey);
        const updatedValue = currentValue - 1;
        const updateObject: { [key: string]: number } = {};
        updateObject[documentKey] = updatedValue;
        transaction.update(documentRef, updateObject);
    });
}

export async function removeUserRecord(userId: string): Promise<void> {
    await admin.database().ref("Users/").child(userId).remove();
}

export function isValidEmail(email: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailPattern.test(email)) {
        return true;
    } else {
        return false;
    }
}

export function getCodeFromInviteLink(inviteLink: string): string {

    const parts = inviteLink.split('/');
    const codeStr = parts[parts.length - 1];
    return codeStr;
}

export async function clearAllFirestoreCollections(): Promise<void> {
    try {
        const db = admin.firestore();

        // Delete collections
        const collections = await db.listCollections();
        console.log("clearAllFirestoreCollections collections: " + collections.length)
        for (const collection of collections) {
            const querySnapshot = await collection.get();
            querySnapshot.forEach(async (documentSnapshot) => {
                await documentSnapshot.ref.delete();
            });
        }
    } catch (error) {
        console.error("Error deleting Firestore data:", error);
    }
}

export async function clearAllAuthenticatedUsers(): Promise<void> {
    try {
        const listUsersResult = await admin.auth().listUsers();
        const deletePromises = listUsersResult.users.map(user => admin.auth().deleteUser(user.uid));
        await Promise.all(deletePromises);
        console.log('All authenticated users deleted.');
      } catch (error) {
        console.error('An error occurred while deleting users:', error);
      }
}

export async function clearRecordFromRealtimeDatabase(pathToRecord: string): Promise<void> {
    try {
        const recordRef = admin.database().ref(pathToRecord);
        await recordRef.remove();
        console.log(pathToRecord + ' cleared.');
    } catch (error) {
        console.error('Error clearing: ' + pathToRecord + " - Error: " + error);
    }
}

export function subtractMinutesFromCron(cronExpression: string, minutes: number): string {
    const parts = cronExpression.split(" ");
    const minutePart = parseInt(parts[0]);
  
    let newMinute = minutePart - minutes;
    if (newMinute < 0) {
      newMinute += 60;
    }
  
    parts[0] = newMinute.toString();
  
    const newCronExpression = parts.join(" ");
    return newCronExpression;
  }
  
  export async function isUserAuthenticated(userId: string): Promise<boolean> {
    try {
        // const userRecord = await admin.auth().getUser(userId);
        return true;
      } catch (error) {
        return false;
      }
  }

  export function getDateFromString(datetimeString: string): Date {
    const eventEndTime = new Date(datetimeString);
    return eventEndTime;
  }

  export function isRootUser(userId: string): boolean {
    return (userId === audience.RootUserId);
  }

  export function comparePhoneNumbers(phone1: string, phone2: string): boolean {
    if(phone1 === null || phone2 === null)
        return false;
    
    const cleanedPhone1 = phone1.replace('+', '');
    const cleanedPhone2 = phone2.replace('+', '');
    return cleanedPhone1 === cleanedPhone2;
}

export async function setGameParameter(fieldName: string, value: any): Promise<any | null> {
    const parametersRef = await admin.database().ref(tournament.GameParameters_DB);
    await parametersRef.update(
        { 
            [fieldName]: value
        }
    )
}

export async function getGameParameter(fieldName: string): Promise<any | null> {
    try {
        const parametersSnapshot = await admin.database().ref(tournament.GameParameters_DB).once('value');
        const fieldVal = parametersSnapshot.val()?.[fieldName];
    
        if (!fieldVal) {
          throw new Error('getGameParameter {' + fieldName + '} not found.');
        }
    
        return fieldVal;
    } catch (error) {
        return null;
    }
}

export function addHoursToDate(date: Date, hours: number): Date {
    let result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
}

export function getTodayStart(): Date {
    let now = new Date();
    now.setHours(0, 0, 0, 0); // Set hours, minutes, seconds, and milliseconds to 0
    return now;
}

export function getSecondsSinceStartOfDayPST(): number {

    const now = new Date();
    const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const startOfDay = new Date(pstTime);
    startOfDay.setHours(0, 0, 0, 0);
    const secondsPassed = Math.floor((pstTime.getTime() - startOfDay.getTime()) / 1000);
    console.log(secondsPassed);
    return secondsPassed;

}

// ...existing code...

export const ECHO_PRO_BASE_URL = "https://echopro.vip"; //"https://zpln-3be94.web.app";
export const ECHO_PRO_CORPORATE_INVITE_CODE = "A8K3M9Q2";
export const ECHO_PRO_CORPORATE_INVITE_LINK = `${ECHO_PRO_BASE_URL}/${ECHO_PRO_CORPORATE_INVITE_CODE}`;

/**
 * Generates Echo Pro invite code using user initials + random chars
 * Jane Doe => JD87Yu5O (8 chars total)
 */
export function generateEchoProInviteCode(firstName: string, lastName: string): string {
  const firstInitial = (firstName?.[0] || "X").toUpperCase();
  const lastInitial = (lastName?.[0] || "X").toUpperCase();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let randomPart = "";
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${firstInitial}${lastInitial}${randomPart}`; // e.g. JD87Yu5O
}

export function generateEchoProInviteLink(inviteCode: string): string {
  return `${ECHO_PRO_BASE_URL}/${inviteCode}`;
}

