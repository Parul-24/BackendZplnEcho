import * as admin from 'firebase-admin'
import * as tournament from "./tournament";
import * as utils from "./utils";

export const FieldInvitesLeft = "invitesLeft"
export const FieldInviteEventStartTime = "inviteEventStartTime"
export const FieldInviteEventEndTime = "inviteEventEndTime"
export const FieldNumberOfSharesToAllot = "numberOfSharesToAllot"

export async function getInvitesLeft(userId: string | null): Promise<number>{
    let invitesLeftCount = 0;
    
    if (userId === "" || userId === null)
        return invitesLeftCount;

    const userDb = await admin.database().ref("Users/"+userId).once('value');
    let doesFieldExist = userDb.child(FieldInvitesLeft).exists() ? true : false;

    if(doesFieldExist)
        invitesLeftCount = (await userDb.child(FieldInvitesLeft)).val();

    return invitesLeftCount;
}

export async function isInviteLimitReached(userId: string): Promise<boolean>{
    console.log("isInviteLimitReached called for user:" + userId);

    if(await getInvitesLeft(userId) <= 0)
    {
        return true;
    }
    
    return false;
}

export async function decrementInvitesLeft(userId: string): Promise<void>{
    console.log("decrementInvitesLeft for userId:" + userId);

    const parentDb = await admin.database().ref(tournament.Users_DB+'/'+userId);
    await parentDb.child(FieldInvitesLeft).transaction((currentValue) => {
        return currentValue - 1;
    });
}

export async function setInvitesLeftToUserDb(userId: string, numberOfInvitesLeft: number): Promise<void>{
    const updateObject: { [key: string]: number } = {};
    updateObject[FieldInvitesLeft] = numberOfInvitesLeft;
    const userDb = await admin.database().ref("Users/"+userId).once('value');
    await userDb.ref.update(updateObject);
}

export async function setInviteEventTiming(startTime: string, endTime: string) {
  console.log("setInviteEventTiming startTime: " + startTime + " - EndTime: " +  endTime);

    const parametersRef = await admin.database().ref(tournament.GameParameters_DB);
    await parametersRef.update(
        { 
            [FieldInviteEventStartTime]: startTime,
            [FieldInviteEventEndTime]: endTime,
        }
    )
}

export async function clearInviteEvent() {
    console.log("clearInviteEvent called");
  
      const parametersRef = await admin.database().ref(tournament.GameParameters_DB);
      await parametersRef.update(
          { 
              [FieldInviteEventStartTime]: null,
              [FieldInviteEventEndTime]: null,
          }
      )
  }

  export async function setNumberOfSharesToAllot(numberOfSharesToAllot: number) {
    console.log("setNumberOfSharesToAllot numberOfSharesToAllot: " + numberOfSharesToAllot);
  
      const parametersRef = await admin.database().ref(tournament.GameParameters_DB);
      await parametersRef.update(
          { 
              [FieldNumberOfSharesToAllot]: numberOfSharesToAllot,
          }
      )
  }

  export async function getNumberOfSharesToAllot(): Promise<number>{
    let invitesLeftCount = 100;
    
    const parametersRef = await admin.database().ref(tournament.GameParameters_DB).once('value');
    let doesFieldExist = parametersRef.child(FieldNumberOfSharesToAllot).exists() ? true : false;
    console.log("getNumberOfSharesToAllot doesFieldExist " + doesFieldExist + " " + FieldNumberOfSharesToAllot);

    if(doesFieldExist)
    {
        invitesLeftCount = (await parametersRef.child(FieldNumberOfSharesToAllot)).val();
    }
    
    console.log("getNumberOfSharesToAllot invitesLeftCount " + invitesLeftCount);
    setNumberOfSharesToAllot(invitesLeftCount);

    return invitesLeftCount;
}

// export async function getInviteEventStartTime(): Promise<Date | null> {
//     try {
//         const parametersSnapshot = await admin.database().ref(tournament.GameParameters_DB).once('value');
//         const inviteEventStartTime = parametersSnapshot.val()?.[FieldInviteEventStartTime];
    
//         if (!inviteEventStartTime) {
//           throw new Error('inviteEventStartTime not found.');
//         }
    
//         const eventStartTime = new Date(inviteEventStartTime);
//         return eventStartTime;
//     } catch (error) {
//         return null;
//     }
// }

export async function clearGameParameter(fieldName: string): Promise<any | null> {
    console.log("clearGameParameter called for fieldName: " + fieldName);
  
    const parametersRef = await admin.database().ref(tournament.GameParameters_DB);
    await parametersRef.update(
        { 
            [fieldName]: null
        }
    )
  }

export async function getInviteEventEndTime(): Promise<Date | null> {
    try {
        const parametersSnapshot = await admin.database().ref(tournament.GameParameters_DB).once('value');
        const inviteEventEndTime = parametersSnapshot.val()?.[FieldInviteEventEndTime];
    
        if (!inviteEventEndTime) {
          throw new Error('FieldInviteEventEndTime not found.');
        }
    
        const eventEndTime = new Date(inviteEventEndTime);
        return eventEndTime;
    } catch (error) {
        return null;
    }
}

export async function isInviteEventActive(): Promise<boolean> {
    console.log("isInviteEventActive---")

    const eventStartTime = await utils.getGameParameter(FieldInviteEventStartTime);
    const eventEndTime = await utils.getGameParameter(FieldInviteEventEndTime);

    const currentTime = new Date().toISOString();
    console.log("currentTime: " + currentTime + " \nstartTime: " + eventStartTime + " \nendTime: " + eventEndTime)

    return ((eventStartTime !== null && currentTime > eventStartTime) && 
        (eventEndTime !== null && currentTime < eventEndTime)
    );
}

export async function updateInvitesForAllUsers(invitesToSet: number): Promise<void> {
    try {
        const usersSnapshot = await admin.database().ref(tournament.Users_DB).once('value');
        const users = usersSnapshot.val();
    
        if (!users) {
          throw new Error('No users found.');
        }
    
        const promises: any[] = [];
        Object.keys(users).forEach(userId => {
          const userRef = admin.database().ref(`${tournament.Users_DB}/${userId}`);
          promises.push(userRef.update({ 
            [FieldInvitesLeft]: invitesToSet 
        }));
        });
    
        await Promise.all(promises);
        console.log("updateInvitesForAllUsers - added invites : " + invitesToSet);


      } catch (error) {
        console.log("updateInvitesForAllUsers - error - " + error);
      }
    
}

export async function eventCompletionCheck(): Promise<void> {
    console.log("eventCompletionCheck called.");

    const eventEndTime = await utils.getGameParameter(FieldInviteEventEndTime);
    if(eventEndTime !== null)//if there is any ongoing event
    {
        if(!await isInviteEventActive())
        {
            onInviteEventCompleted();
        }
    }
}

export async function onInviteEventCompleted(): Promise<void> {
    console.log("onInviteEventCompleted called.");
    await clearInviteEvent();
    await updateInvitesForAllUsers(0);
}

export async function onInviteEventForcefullyEnded(): Promise<void> {
    console.log("onInviteEventForcefullyEnded called.");
    await clearInviteEvent();
    await updateInvitesForAllUsers(0);
}