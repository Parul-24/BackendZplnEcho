import { STAGING, appOptions } from "./environments";
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import * as tournament from './tournament';
import * as tournament_card from './tournament_cards';

import * as leaderboards from './leaderboards';
import * as practice_games from './practice_games'

import * as vault from './vault'
import * as schedule from './schedule_tasks'

//import * as network from './network';
import * as audience from "./audience";

import * as utils from './utils';
import * as userUtils from './user_utils';
import * as reporting from "./reporting";
import * as mailer from "./mailer";
import * as controlled_invites from "./controlled_invites"
import * as appVersionChecker from "./appVersionChecker"
import * as requireDbRecords from "./requireDbRecords"
import * as environments from "./environments"

import { Event_Data } from './classes/event_data';
// import { debug } from "firebase-functions/logger";
import { Users_DB } from "./tournament";
import { createDynamicLinkForInviteCode } from "./dynamic_links_handler";
import { getCodeFromInviteLink } from "./utils";
import { getInviteCodeFromShortlinkInviteCode } from "./audience";
const { normalizeInviteCodeCandidate, extractParentInviteCodeCandidateFromRequestData } = require("./invite_link_utils");
import * as analytics_apis from "./analytics_apis";
import * as ingame_popups from "./ingame_popups";
//import * as tournament_cards from "./tournament_cards";
const Busboy = require('busboy');


const cors = require("cors")({
  origin: ["https://zpln-3be94.web.app","https://echopro.vip"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
});

admin.initializeApp(appOptions);

//#region Schedules

const DAILY_RECAP_CRON_EXPRESSION = "1 0 * * *";
const PRE_DAILY_RECAP_BUFFER_CRON_EXPRESSION = utils.subtractMinutesFromCron(DAILY_RECAP_CRON_EXPRESSION, 5);

export const scheduledPreDailyRecapBuffer = functions.runWith({ timeoutSeconds: 300, memory: "1GB" }).pubsub.schedule(PRE_DAILY_RECAP_BUFFER_CRON_EXPRESSION)
  .timeZone("America/Los_Angeles")
  .onRun(tournament.preDailyRecapBuffer);

export const scheduledDailyRecap = functions.runWith({ timeoutSeconds: 300, memory: "1GB" }).pubsub.schedule(DAILY_RECAP_CRON_EXPRESSION)//"every 24 hours")
  .timeZone("America/Los_Angeles")
  .onRun(tournament.dailyRecap);

const WEEKLY_RECAP_CRON_EXPRESSION = "2 0 * * 1";//weekly->"2 0 * * 1"//hourly->"2 * * * *"//every 2 hours->"0 */2 * * *"
const PRE_WEEKLY_RECAP_BUFFER_CRON_EXPRESSION = utils.subtractMinutesFromCron(WEEKLY_RECAP_CRON_EXPRESSION, 5);

export const scheduledPreWeeklyRecapBuffer = functions.runWith({ timeoutSeconds: 300, memory: "1GB" }).pubsub.schedule(PRE_WEEKLY_RECAP_BUFFER_CRON_EXPRESSION)
  .timeZone("America/Los_Angeles")//"America/Los_Angeles")//Etc/UTC
  .onRun(schedule.preWeeklyRecapBuffer);

export const scheduledWeeklyRecap = functions.runWith({ timeoutSeconds: 300, memory: "1GB" }).pubsub.schedule(WEEKLY_RECAP_CRON_EXPRESSION)//"every week")
  .timeZone("America/Los_Angeles")//"America/Los_Angeles")//Etc/UTC
  .onRun(schedule.weeklyRecap);

const MINUTELY_CRON_EXPRESSION = "* * * * *";
export const minutelyJob = functions.runWith({ timeoutSeconds: 300, memory: "1GB" }).pubsub.schedule(MINUTELY_CRON_EXPRESSION)
  .timeZone("America/Los_Angeles")
  .onRun(schedule.minutelyJob);

export const dailyRefreshMiningRanks = schedule.dailyRefreshMiningRanks;

//#endregion

//#region Registration
export const OnUserC = functions.runWith({ memory: "512MB" }).database.ref('/Users/{userID}').onCreate(async (snapshot, context) => {
  //currentUserID = String(snapshot.key);
  //currentParents.push(currentUserID);
  console.log("Created user:" + snapshot.key + " proceeding to Extra Conf with RegistrationLink " + snapshot.child("registrationLink").exists())
  await utils.PlayerExtraConfiguration(snapshot);

  //await UpdatePlayerFlowTotal(String(snapshot.key));

  //await network.createNetworkList(snapshot);
  //  await SortPlayersWithRanks();
  //  await UpdateAllUsersData();
  //  CalculateTopRanksOfEachCatagory();
  //  await SendAlertToClients();

  console.log('user created ' + snapshot.key);
});

export const CreateEchoProUserAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  let userId: string | null = String(request.query.userId);
  if (request.query.userId === undefined || userId === null) {
    response.send("Error: no UserId");
    return;
  }
  let userName: string | null = String(request.query.userName);
  if (request.query.userName === undefined || userName === null) {
    response.send("Error: no UserName");
    return;
  }
  let FirstName: string | null = String(request.query.firstName);
  if (request.query.firstName === undefined || FirstName === null) {
    response.send("Error: no FirstName");
    return;
  }
  let LastName: string | null = String(request.query.lastName);
  if (request.query.lastName === undefined || LastName === null) {
    response.send("Error: no LastName");
    return;
  }
  let phone: string | null = String(request.query.phone);
  if (request.query.phone === undefined || phone === null) {
    response.send("Error: no Phone");
    return;
  }
  let parentId: string | null = String(request.query.parentId);
  if (request.query.parentId === undefined || parentId === null) {
    response.send("Error: no parentId");
    return;
  }

  let savedAvatarURL: string | null = String(request.query.savedAvatarURL);
  if (request.query.savedAvatarURL === undefined || savedAvatarURL === null) {
    response.send("Error: no savedAvatarURL");
    return;
  }

  console.log("CreateUser ---- " + userId + " " + userName + " " + phone + " " + parentId + " " + savedAvatarURL)
  const snapshot = await utils.CreateUserFromJson(userId, userName, phone, parentId, savedAvatarURL);

  // Keep parent -> child mapping synced at registration time.
  await audience.addChildToParentChildrenIds(parentId, userId, tournament.Users_DB);
  await audience.addUserToSpillTree(parentId, userId);

  response.status(200).send(snapshot.toJSON());
  return;
});

export const SetUsernameOfUser = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  let userId: string | null = String(request.query.userId);
  if (request.query.userId === undefined || userId === null) {
    response.send("Error: no UserId");
    return;
  }
  let userName: string | null = String(request.query.userName);
  if (request.query.userName === undefined || userName === null) {
    response.send("Error: no UserName");
    return;
  }

  console.log("SetUsernameOfUser ---- " + userId + " " + userName)

  const snapshot = await utils.SetUsernameOfUser(userId, userName);
  response.status(200).send(snapshot.toJSON());
  return;
});

export const GetUser = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  let userId: string | null = String(request.query.userId);
  if (request.query.userId === undefined || userId === null) {
    response.send("Error: no UserId");
    return;
  }

  const userPath = Users_DB + "/" + userId + "/";
  const userDb = (await admin.database().ref(Users_DB + "/" + userId).once("value")).val();

  let doesUserExist = true;
  if (userDb == null)
    doesUserExist = false;

  const phone = (await admin.database().ref(userPath + "phone").once("value")).val();
  const SavedAvatarURL = (await admin.database().ref(userPath + "SavedAvatarURL").once("value")).val();
  const userName = (await admin.database().ref(userPath + "userName").once("value")).val();

  let levelName = (await admin.database().ref(userPath + "levelName").once("value")).val();
  if (levelName == null)
    levelName = "LEVEL 1"

  let globalAverage = (await admin.database().ref(userPath + "globalAverage").once("value")).val();
  if (globalAverage == null)
    globalAverage = 0;

  const dataToSend =
  {
    Success: doesUserExist,
    Data:
    {
      phone: phone,
      SavedAvatarURL: SavedAvatarURL,
      userName: userName,
      levelName: levelName,
      globalAverage: globalAverage
    }
  };

  response.status(200).send(JSON.stringify(dataToSend));
  return;
});

export const FinalRegistrationStep = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  let userId: string | null = String(request.query.userId);
  if (request.query.userId === undefined) {
    response.send("Error: no UserId");
    return;
  }

  await utils.PlayerExtraConfigurationById(userId);
  response.send("1")
  return;
});


function extractParentInviteCodeFromRequest(request: functions.Request): string {
  const data = getRequestData(request);
  return extractParentInviteCodeCandidateFromRequestData(data);
}

async function getUpdateParentIdUserSummary(userId: string): Promise<Record<string, unknown>> {
  const userSnapshot = await admin.database().ref(`${Users_DB}/${userId}`).once("value");

  if (!userSnapshot.exists()) {
    return {
      exists: false,
      userId,
      userName: "",
      firstName: "",
      lastName: "",
      phone: "",
      parentUid: ""
    };
  }

  return {
    exists: true,
    userId,
    userName: String(userSnapshot.child("userName").val() || ""),
    firstName: String(userSnapshot.child("firstName").val() || ""),
    lastName: String(userSnapshot.child("lastName").val() || ""),
    phone: String(userSnapshot.child("phone").val() || ""),
    parentUid: String(userSnapshot.child(audience.FieldParentUid).val() || "")
  };
}

async function getParentSummaryByUid(parentUid: string): Promise<Record<string, unknown>> {
  if (!parentUid) {
    return {
      exists: false,
      parentUid: "",
      userName: "",
      firstName: "",
      lastName: "",
      phone: ""
    };
  }

  const parentSnapshot = await admin.database().ref(`${Users_DB}/${parentUid}`).once("value");
  if (!parentSnapshot.exists()) {
    return {
      exists: false,
      parentUid,
      userName: "",
      firstName: "",
      lastName: "",
      phone: ""
    };
  }

  return {
    exists: true,
    parentUid,
    userName: String(parentSnapshot.child("userName").val() || ""),
    firstName: String(parentSnapshot.child("firstName").val() || ""),
    lastName: String(parentSnapshot.child("lastName").val() || ""),
    phone: String(parentSnapshot.child("phone").val() || "")
  };
}

async function diagnoseUpdateParentIdFailure(userId: string, parentInviteCode: string): Promise<Record<string, unknown>> {
  if (userId === audience.RootUserId) {
    return { code: "ROOT_USER_NOT_ALLOWED", message: "Root user cannot be assigned a parent." };
  }

  const parentUid = await audience.getParentUidFromParentCode(parentInviteCode);
  if (!parentUid) {
    return {
      code: "PARENT_NOT_FOUND",
      message: "Parent invite code was not found.",
      parentInviteCode
    };
  }

  if (parentUid === userId) {
    return {
      code: "SELF_REFERRAL_NOT_ALLOWED",
      message: "User cannot use their own invite code.",
      parentUid
    };
  }

  if (await audience.checkIfParentExist(userId)) {
    return {
      code: "PARENT_ALREADY_SET",
      message: "User already has a parent assigned.",
      parentUid
    };
  }

  if (!await audience.canInviteCodeBeRedeemed(parentInviteCode)) {
    return {
      code: "INVITE_NOT_REDEEMABLE",
      message: "Invite code cannot be redeemed right now (limit reached or invite event inactive).",
      parentUid
    };
  }

  return {
    code: "ASSIGNMENT_FAILED",
    message: "Unable to assign parent due to an unknown validation or write failure.",
    parentUid
  };
}

export const UpdateParentId = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    const data = getRequestData(request);
    const userId = firstNonEmpty(data.userId, data.uid);

    if (!userId) {
      response.status(400).json({
        success: false,
        issue: {
          code: "MISSING_USER_ID",
          message: "Missing UserId"
        }
      });
      return;
    }

    const incomingParentCode = normalizeInviteCodeCandidate(extractParentInviteCodeFromRequest(request));
    console.log("UpdateParentId request", { userId, incomingParentCode });
    if (!incomingParentCode) {
      response.status(400).json({
        success: false,
        user: await getUpdateParentIdUserSummary(userId),
        issue: {
          code: "MISSING_PARENT_INVITE_CODE",
          message: "Missing Parent Invite Code"
        }
      });
      return;
    }

    const attemptedInviteCodes: string[] = [incomingParentCode];
    let resolvedInviteCode = incomingParentCode;

    let linked = await audience.setParentId(userId, resolvedInviteCode, true);

    if (!linked) {
      const realParentInviteCode = normalizeInviteCodeCandidate(await getInviteCodeFromShortlinkInviteCode(incomingParentCode));
      if (realParentInviteCode && realParentInviteCode !== incomingParentCode) {
        resolvedInviteCode = realParentInviteCode;
        attemptedInviteCodes.push(realParentInviteCode);
        linked = await audience.setParentId(userId, resolvedInviteCode, true);
      }
    }

    const user = await getUpdateParentIdUserSummary(userId);

    if (linked) {
      response.status(200).json({
        success: true,
        user,
        parent: {
          inviteCodeUsed: resolvedInviteCode
        },
        attemptedInviteCodes
      });
      return;
    }

    const issue = await diagnoseUpdateParentIdFailure(userId, resolvedInviteCode);

    if (issue.code === "PARENT_ALREADY_SET") {
      const existingParent = await getParentSummaryByUid(String(issue.parentUid || ""));
      response.status(200).json({
        success: true,
        noOp: true,
        user,
        existingParent,
        issue,
        attemptedInviteCodes
      });
      return;
    }

    response.status(200).json({
      success: false,
      user,
      issue,
      attemptedInviteCodes
    });
  } catch (error) {
    console.error("UpdateParentId error:", error);
    response.status(500).json({
      success: false,
      issue: {
        code: "INTERNAL_ERROR",
        message: String(error)
      }
    });
  }
});

export const ChangeUserParentAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    const q: any = request.method === "GET" ? request.query : request.body;
    const userId = String(q.userId || q.uid || "").trim();
    const newParentUserId = String(q.newParentUserId || q.newParentUid || q.parentUid || "").trim();

    if (!userId) {
      response.status(400).json({ error: "Missing userId" });
      return;
    }

    if (!newParentUserId) {
      response.status(400).json({ error: "Missing newParentUserId" });
      return;
    }

    const result = await audience.changeUserParentByUserIds(userId, newParentUserId);

    response.status(200).json({
      success: true,
      userId: result.userId,
      oldParentUid: result.oldParentUid,
      newParentUid: result.newParentUid,
      spillOldParentUid: result.spillOldParentUid,
      spillNewParentUid: result.spillNewParentUid,
      newSpillDepth: result.newSpillDepth
    });
  } catch (err: any) {
    const message = String(err?.message || err || "Unknown error");
    const status = message.includes("not found") ? 404 : 400;
    console.error("ChangeUserParentAPI error:", err);
    response.status(status).json({ error: message });
  }
});

export const CheckIfParentExist = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  if (request.query.userId === undefined) {
    response.send("Missing UserId");
    return;
  }

  const userId = String(request.query.userId);
  let doesParentExist = await audience.checkIfParentExist(userId);
  response.send({ doesParentExist });
});


export const CheckUserId = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId);
  if (request.query.userId === undefined) {
    response.send({
      errorno: 5001,
      message: "Error missing userId"
    });
    return;
  }

  const result: number = await utils.checkUserId(userId);

  response.send({
    errorno: -1,
    message: result
  });

});

export const CheckUserName = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  console.log("CheckUserName --- userName:" + request.query.userName + " phoneNumber:" + request.query.phoneNumber);

  const userName = String(request.query.userName);
  if (request.query.userName === undefined) {
    response.send({
      errorno: 5001,
      message: "Error missing userId"
    });
    return;
  }

  let phoneNumber: string | null = String(request.query.phoneNumber);
  if (request.query.phoneNumber === undefined || phoneNumber === "") {
    phoneNumber = null;
  }
  const result: any = await utils.checkUserName(userName, phoneNumber);

  response.send({
    errorno: -1,
    message: result.exists,
    userId: result.userId
  });

});

// Trigger when a new user node is created
// export const OnUserCreated_UpdateParentAndMining = functions.database
//   .ref(`${tournament.Users_DB}/{userId}`)
//   .onCreate(async (snapshot, context) => {
//     const userId = context.params.userId as string;
//     if (!userId) return null;

//     // If user has parentUid, add this user to parent's childrenIds
//     const parentUid = snapshot.child('parentUid').val();
//     if (parentUid) {
//       try {
//         await admin.database().ref(`Users/${parentUid}/childrenIds`).transaction((children) => {
//           if (children === null || children === undefined) {
//             const obj: any = {};
//             obj[userId] = true;
//             return obj;
//           }
//           children[userId] = true;
//           return children;
//         });
//       } catch (err) {
//         console.error("OnUserCreated: failed updating parent's childrenIds", parentUid, err);
//       }

//       // // recalc parent's mining rate and its ancestors (sector-1 affected)
//       // await vault.calculateAndUpdateMiningRateForUser(parentUid).catch((err) => {
//       //   console.error("OnUserCreated: calc mine rate parent failed", parentUid, err);
//       // });
//       // await vault.updateMiningRateForAncestors(parentUid).catch((err) => {
//       //   console.error("OnUserCreated: calc mine rate ancestors failed for", parentUid, err);
//       // });
//     }

//     // initialize or recalc mining rate for the new user as well
//     // await vault.calculateAndUpdateMiningRateForUser(userId).catch((err) => {
//     //   console.error("OnUserCreated: calc mine rate new user failed", userId, err);
//     // });

//     return null;
//   });


export const CheckIfUserExistForPhoneNumber = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  console.log("CheckIfUserExistForPhoneNumber --- " + request.query.phoneNumber);

  let phoneNumber: string | null = String(request.query.phoneNumber);
  if (request.query.phoneNumber === undefined || phoneNumber === "") {
    phoneNumber = null;
  }
  
  const phoneResponse = await utils.checkPhone(phoneNumber);
  console.log("json phoneResponse: " + JSON.stringify(phoneResponse));

  let userAlreadyExists = false;
  if(phoneResponse.exists)
    userAlreadyExists = true;

  response.send(userAlreadyExists);
});

export const CheckUserPin = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userName = String(request.query.userName);
  if (request.query.userName === undefined) {
    response.send({
      errorno: 5001,
      message: "Error missing userName"
    });
    return;
  }
  const pin = String(request.query.pin);
  if (request.query.pin === undefined) {
    response.send({
      errorno: 5001,
      message: "Error missing PIN"
    });
    return;
  }

  const result: any = await utils.checkUserPin(userName, pin);

  response.send({
    errorno: -1,
    message: result.correct,
    userId: result.userId
  });

});

export const CreateUserPin = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId);
  if (request.query.userId === undefined) {
    response.send({
      errorno: 5001,
      message: "Error missing userId"
    });
    return;
  }
  const pin = String(request.query.pin);
  if (request.query.pin === undefined) {
    response.send({
      errorno: 5001,
      message: "Error missing PIN"
    });
    return;
  }

  await utils.createUserPin(userId, pin);

  response.send({
    errorno: -1,
    message: 1
  });

});

export const IsUserAuthenticated = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  if (request.query.userId === undefined) {
    response.send("Missing UserId.");
    return;
  }

  try {
    //const userRecord = await admin.auth().getUser(String(request.query.userId));
    response.send('true');
  } catch (error) {
    response.send('false');
  }
});

export const GetUserIdFromUsernameAndNumber = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  if (request.query.username === undefined) {
    response.send("Missing Username.");
    return;
  }

  if (request.query.number === undefined) {
    response.send("Missing Number.");
    return;
  }

  let authUserFromNumber;
  try {
    authUserFromNumber = await admin.auth().getUserByPhoneNumber(String(request.query.number));
  } catch (error) {
    response.send('Not Present');//user with the passed phonenumber doesn't exist
    return;
  }

  const userVal = await admin.database().ref(Users_DB + "/" + authUserFromNumber.uid).once('value');;

  if (userVal.child("userName").exists()) {
    const userName = userVal.child("userName").val();
    if (userName === String(request.query.username)) {
      response.send(authUserFromNumber.uid);
      return;
    }else {
      response.send('Not Present');//username match failed
      return;
    }
  }else {
    response.send('Not Present');//username doens't exist for the user. 
    return;
  }


  // const usersRef = admin.database().ref(Users_DB);
  // await usersRef.once('value', async (snapshot) => {

  //   const users = await snapshot.val();

  //   const matchedUser = Object.keys(users).filter((userId) => {
  //     const user = users[userId];
  //     return user.userName === request.query.username && user.phone === request.query.number;
  //   });

  //   if (matchedUser.length > 0) {
  //     response.send(matchedUser[0]);
  //   } else {
  //     response.send('Not Present');
  //   }
  // }, (error) => {
  //   console.error('Error retrieving users:', error);
  //   response.send('Error retrieving users');
  // });
});

export const GetUserIdFromUsername = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userName = String(request.query.userName || "").trim();
  if (!userName) {
    response.status(400).send({ errorno: 5001, message: "Error missing userName", userId: null });
    return;
  }

  const result: any = await utils.checkUserName(userName, null);
  if (result.userId) {
    response.send({ errorno: -1, message: "Found", userId: result.userId });
  } else {
    response.send({ errorno: 5002, message: "Not Present", userId: null });
  }
});

export const GetInviteCode = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId);

  if (request.query.userId === undefined || userId === null || userId.length === 0) {
    response.status(404).send("");//Error: no UserId.
    return;
  }

  await audience.createInviteCodeIfDoesntAlreadyExists(userId);

  const inviteLinkSS = await admin.database().ref(`${tournament.Users_DB}/${userId}/${audience.FieldInviteLink}`).once("value");
  if (inviteLinkSS.exists()) {
    const inviteLinkCode = getCodeFromInviteLink(inviteLinkSS.val());
    response.send(inviteLinkCode);
    return;
  }
  else {
    response.status(404).send("");//Invite code not found.
    return;
  }
});

export const GetInviteLink = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId);

  if (request.query.userId === undefined || userId === null || userId.length === 0) {
    response.status(404).send("Missing Username.");//Error: no UserId.
    return;
  }

  await audience.createInviteCodeIfDoesntAlreadyExists(userId);

  const inviteLinkSS = await admin.database().ref(`${tournament.Users_DB}/${userId}/${audience.FieldInviteLink}`).once("value");
  if (inviteLinkSS.exists())
    response.send(inviteLinkSS.val());
  else
    response.status(404).send("Invite code not found.");//Invite code not found.
});

export const GetUserByInviteCodeAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    const data = getRequestData(request);
    const incomingCode = extractParentInviteCodeCandidateFromRequestData(data);

    if (!incomingCode) {
      response.status(400).json({
        success: false,
        issue: {
          code: "MISSING_INVITE_CODE",
          message: "Missing inviteCode/code"
        }
      });
      return;
    }

    const userId = await audience.getParentUidFromParentCode(incomingCode);
    if (!userId) {
      response.status(404).json({
        success: false,
        issue: {
          code: "INVITE_CODE_NOT_FOUND",
          message: "No user found for this invite code."
        },
        inviteCode: incomingCode
      });
      return;
    }

    const userSnapshot = await admin.database().ref(`${Users_DB}/${userId}`).once("value");
    if (!userSnapshot.exists()) {
      response.status(404).json({
        success: false,
        issue: {
          code: "USER_NOT_FOUND",
          message: "Invite code resolved, but user record was not found."
        },
        inviteCode: incomingCode,
        userId
      });
      return;
    }

    response.status(200).json({
      success: true,
      inviteCode: incomingCode,
      user: {
        userId,
        userName: String(userSnapshot.child("userName").val() || ""),
        firstName: String(userSnapshot.child("firstName").val() || ""),
        lastName: String(userSnapshot.child("lastName").val() || ""),
        phone: String(userSnapshot.child("phone").val() || ""),
        parentUid: String(userSnapshot.child(audience.FieldParentUid).val() || ""),
        inviteCode: String(userSnapshot.child(audience.FieldInviteCode).val() || ""),
        inviteLink: String(userSnapshot.child(audience.FieldInviteLink).val() || "")
      }
    });
  } catch (error) {
    console.error("GetUserByInviteCodeAPI error:", error);
    response.status(500).json({
      success: false,
      issue: {
        code: "INTERNAL_ERROR",
        message: String(error)
      }
    });
  }
});

function parseRequestBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    const trimmedBody = body.trim();
    if (!trimmedBody) return {};

    try {
      const parsed = JSON.parse(trimmedBody);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore invalid JSON and fall back to an empty object.
    }
  }

  if (body && typeof body === "object") {
    return body as Record<string, unknown>;
  }

  return {};
}

function getRequestData(request: functions.Request): Record<string, unknown> {
  const parsedBody = parseRequestBody(request.body);
  const query = (request.query || {}) as Record<string, unknown>;
  return request.method === "POST"
    ? { ...parsedBody, ...query }
    : { ...query, ...parsedBody };
}

function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const candidate = asTrimmedString(value);
    if (candidate.length > 0) return candidate;
  }
  return "";
}

function normalizeDateValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isFallbackInviteLink(inviteLink: string): boolean {
  const raw = String(inviteLink || "").trim();
  if (!raw) return false;

  const lowered = raw.toLowerCase();
  if (lowered.startsWith("?parent-id=") || lowered.includes("parent-id=") || lowered.includes("parent-user-name=")) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.hostname !== "t5sgz.app.link") return false;
  const hasParentId = parsed.searchParams.has("parent-id");
  const hasParentUserName = parsed.searchParams.has("parent-user-name");
  return hasParentId || hasParentUserName;
}

function isExpectedInviteLinkFormat(inviteLink: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(String(inviteLink || "").trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname !== "t5sgz.app.link") return false;
  if ((parsed.search || "").length > 0) return false;

  const path = parsed.pathname || "";
  const expectedRegex = /^\/(?:[A-Za-z0-9_-]+\/)?invited-[A-Za-z0-9]{4,}$/;
  return expectedRegex.test(path);
}

function findInvalidInviteLinkReason(userNode: any): string {
  const inviteLink = firstNonEmpty(userNode?.inviteLink);

  if (!inviteLink) return "missing_invite_link";

  const lowered = inviteLink.toLowerCase();
  if (lowered.includes("error") || lowered.includes("eroor")) return "contains_error_text";
  if (isFallbackInviteLink(inviteLink)) return "fallback_query_link";
  if (!isExpectedInviteLinkFormat(inviteLink)) return "invalid_invite_link_format";

  return "";
}

export const NormalizeFreeUserAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    const data = getRequestData(request);
    const userId = firstNonEmpty(data.userId, data.uid);

    if (!userId) {
      response.status(400).json({ error: "Missing userId" });
      return;
    }

    const userRef = admin.database().ref(`${tournament.Users_DB}/${userId}`);
    const snapshot = await userRef.once("value");
  const isNewUser = !snapshot.exists();
    const current = snapshot.val() || {};

    const email = firstNonEmpty(data.email, current.email);
    const firstName = firstNonEmpty(data.firstName, current.firstName);
    const lastName = firstNonEmpty(data.lastName, current.lastName);
    const phone = firstNonEmpty(data.phone, current.phone);
    const savedAvatarURL = firstNonEmpty(data.SavedAvatarURL, data.savedAvatarURL, current.SavedAvatarURL);
    const parentInviteCode = firstNonEmpty(data.parentInviteCode, current.parentInviteCode);
    const parentUid = firstNonEmpty(data.parentUid, data.parentId, current.parentUid, current.parentId);
    const parentId = firstNonEmpty(data.parentId, data.parentUid, current.parentId, current.parentUid, parentUid);

    const userName = firstNonEmpty(
      data.userName,
      current.userName,
      `${firstName} ${lastName}`.trim(),
      firstName,
      userId
    );

    const createdAt = normalizeDateValue(data.createdAt) ?? normalizeDateValue(current.createdAt) ?? Date.now();

    const updates: Record<string, unknown> = {
      userId,
      email,
      firstName,
      lastName,
      phone,
      userName,
      SavedAvatarURL: savedAvatarURL,
      parentInviteCode,
      parentUid,
      parentId,
      createdAt,
      isEchoPro: false,
      level: 1,
      levelName: "Player",
      invitesLeft: 0
    };

    if (!snapshot.child("inviteCode").exists()) {
      const inviteCode = firstNonEmpty(data.inviteCode, current.inviteCode);
      if (inviteCode) {
        updates[audience.FieldInviteCode] = inviteCode;
      }
    }

    if (!snapshot.child("inviteLink").exists()) {
      const inviteLink = firstNonEmpty(data.inviteLink, current.inviteLink);
      if (inviteLink) {
        updates[audience.FieldInviteLink] = inviteLink;
      }
    }

    await userRef.update(updates);

    await audience.createInviteCodeIfDoesntAlreadyExists(userId);

    let welcomeBonus = { coins: 0, zplnTokens: 0 };
    //if (isNewUser) {
      const welcomeCoins = 100;
      const welcomeZplnTokens = 100;

      await Promise.all([
        admin.database()
          .ref(`${tournament.Users_DB}/${userId}/${vault.Vault_User_DB}/${vault.Coins_Vault_User_DB}`)
          .transaction((curr) => Number(curr || 0) + welcomeCoins),
        admin.database()
          .ref(`${tournament.Users_DB}/${userId}/${vault.Vault_User_DB}/${vault.ZplnMinned_Vault_User_DB}`)
          .transaction((curr) => Number(curr || 0) + welcomeZplnTokens)
      ]);

      welcomeBonus = { coins: welcomeCoins, zplnTokens: welcomeZplnTokens };
   // }

    const refreshed = await userRef.once("value");
    const normalized = refreshed.val() || {};

    response.status(200).json({
      success: true,
      userId,
      isNewUser,
      welcomeBonus,
      user: {
        email: normalized.email || "",
        firstName: normalized.firstName || "",
        isEchoPro: Boolean(normalized.isEchoPro),
        lastName: normalized.lastName || "",
        parentInviteCode: normalized.parentInviteCode || "",
        parentUid: normalized.parentUid || "",
        phone: normalized.phone || "",
        userId: normalized.userId || userId,
        userName: normalized.userName || "",
        SavedAvatarURL: normalized.SavedAvatarURL || "",
        inviteCode: normalized.inviteCode || "",
        inviteLink: normalized.inviteLink || "",
        invitesLeft: Number(normalized.invitesLeft || 0),
        parentId: normalized.parentId || "",
        createdAt: Number(normalized.createdAt || createdAt),
        level: Number(normalized.level || 1),
        levelName: normalized.levelName || "Player"
      }
    });
  } catch (error) {
    console.error("NormalizeFreeUserAPI error:", error);
    response.status(500).json({ error: String(error) });
  }
});

export const ResetAndReallocateFreeInviteLinksAPI = functions.runWith({ timeoutSeconds: 540, memory: "1GB" }).https.onRequest(async (request, response) => {
  try {
    const data = getRequestData(request);
    const confirm = firstNonEmpty(data.confirm, data.action);
    const dryRun = String(firstNonEmpty(data.dryRun, "false")).toLowerCase() === "true";

    if (confirm !== "RESET_FREE_LINKS") {
      response.status(400).json({
        error: "Missing confirmation token",
        requiredConfirmValue: "RESET_FREE_LINKS"
      });
      return;
    }

    const usersSnapshot = await admin.database().ref(tournament.Users_DB).once("value");
    const users = usersSnapshot.val() || {};
    const userIds = Object.keys(users);

    const summary = {
      dryRun,
      scanned: 0,
      regenerated: 0,
      skippedMissing: 0,
      failed: 0
    };

    const samples: Array<{ userId: string; skipped: boolean; reason?: string; oldInviteCode: string; newInviteCode: string; oldInviteLink: string; newInviteLink: string; }> = [];

    for (const userId of userIds) {
      summary.scanned += 1;

      const userNode = users[userId];
      if (!userNode) {
        summary.skippedMissing += 1;
        continue;
      }

      if (dryRun) {
        summary.regenerated += 1;
        continue;
      }

      try {
        const result = await audience.resetAndRegenerateFreeInviteForUser(userId);
        if (result.skipped) {
          summary.skippedMissing += 1;
          continue;
        }

        summary.regenerated += 1;
        if (samples.length < 25) {
          samples.push(result);
        }
      } catch (error) {
        summary.failed += 1;
        console.error("ResetAndReallocateFreeInviteLinksAPI failed for user:", userId, error);
      }
    }

    response.status(200).json({
      success: true,
      summary,
      samples
    });
  } catch (error) {
    console.error("ResetAndReallocateFreeInviteLinksAPI error:", error);
    response.status(500).json({ error: String(error) });
  }
});

export const RegenerateInvalidFreeInviteLinksAPI = functions.runWith({ timeoutSeconds: 540, memory: "1GB" }).https.onRequest(async (request, response) => {
  try {
    const data = getRequestData(request);
    const confirm = firstNonEmpty(data.confirm, data.action);
    const dryRun = String(firstNonEmpty(data.dryRun, "false")).toLowerCase() === "true";

    if (confirm !== "REGENERATE_INVALID_FREE_LINKS") {
      response.status(400).json({
        error: "Missing confirmation token",
        requiredConfirmValue: "REGENERATE_INVALID_FREE_LINKS"
      });
      return;
    }

    const usersSnapshot = await admin.database().ref(tournament.Users_DB).once("value");
    const users = usersSnapshot.val() || {};
    const userIds = Object.keys(users);

    const summary = {
      dryRun,
      scanned: 0,
      invalidDetected: 0,
      regenerated: 0,
      failed: 0
    };

    const samples: Array<{
      userId: string;
      reason: string;
      oldInviteCode: string;
      oldInviteLink: string;
      newInviteCode: string;
      newInviteLink: string;
    }> = [];

    for (const userId of userIds) {
      summary.scanned += 1;
      const userNode = users[userId] || {};
      const reason = findInvalidInviteLinkReason(userNode);
      if (!reason) {
        continue;
      }

      summary.invalidDetected += 1;
      const oldInviteCode = firstNonEmpty(userNode.inviteCode);
      const oldInviteLink = firstNonEmpty(userNode.inviteLink);

      if (dryRun) {
        if (samples.length < 50) {
          samples.push({
            userId,
            reason,
            oldInviteCode,
            oldInviteLink,
            newInviteCode: oldInviteCode,
            newInviteLink: oldInviteLink
          });
        }
        continue;
      }

      try {
        let refreshed: admin.database.DataSnapshot | null = null;
        let newInviteCode = oldInviteCode;
        let newInviteLink = oldInviteLink;
        let remainingIssue = reason;

        for (let attempt = 0; attempt < 3; attempt++) {
          if (oldInviteLink && !oldInviteLink.includes("?") && oldInviteLink.toLowerCase() !== "error") {
            const oldShortCode = getCodeFromInviteLink(oldInviteLink);
            if (oldShortCode && !oldShortCode.includes("=") && !oldShortCode.includes("?")) {
              await audience.removeShortLinkInviteCodeFromShortLinkInviteCodeDb(oldShortCode).catch(() => undefined);
            }
          }

          await admin.database().ref(`${tournament.Users_DB}/${userId}`).update({
            [audience.FieldInviteLink]: null
          });

          await audience.createInviteCodeIfDoesntAlreadyExists(userId);

          refreshed = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
          newInviteCode = firstNonEmpty(refreshed.child(audience.FieldInviteCode).val());
          newInviteLink = firstNonEmpty(refreshed.child(audience.FieldInviteLink).val());

          remainingIssue = findInvalidInviteLinkReason({
            inviteCode: newInviteCode,
            inviteLink: newInviteLink
          });

          if (!remainingIssue) {
            break;
          }
        }

        if (remainingIssue) {
          summary.failed += 1;
          console.warn("RegenerateInvalidFreeInviteLinksAPI still invalid after retries:", {
            userId,
            reason: remainingIssue,
            newInviteLink
          });
        } else {
          summary.regenerated += 1;
        }

        if (samples.length < 50) {
          samples.push({
            userId,
            reason,
            oldInviteCode,
            oldInviteLink,
            newInviteCode,
            newInviteLink
          });
        }
      } catch (error) {
        summary.failed += 1;
        console.error("RegenerateInvalidFreeInviteLinksAPI failed for user:", userId, error);
      }
    }

    response.status(200).json({
      success: true,
      summary,
      samples
    });
  } catch (error) {
    console.error("RegenerateInvalidFreeInviteLinksAPI error:", error);
    response.status(500).json({ error: String(error) });
  }
});

export const RefreshAllMiningRanksAPI = functions.runWith({ timeoutSeconds: 540, memory: "1GB" }).https.onRequest(async (request, response) => {
  try {
    const data = getRequestData(request);
    const confirm = firstNonEmpty(data.confirm, data.action);
    const dryRun = String(firstNonEmpty(data.dryRun, "false")).toLowerCase() === "true";
    const batchSizeInput = Number(firstNonEmpty(data.batchSize, "50"));
    const batchSize = Number.isFinite(batchSizeInput)
      ? Math.max(1, Math.min(100, Math.floor(batchSizeInput)))
      : 50;

    if (confirm !== "REFRESH_MINING_RANKS") {
      response.status(400).json({
        error: "Missing confirmation token",
        requiredConfirmValue: "REFRESH_MINING_RANKS"
      });
      return;
    }

    const usersSnapshot = await admin.database().ref(tournament.Users_DB).once("value");
    const users = usersSnapshot.val() || {};
    const userIds = Object.keys(users);

    const summary = {
      dryRun,
      scanned: userIds.length,
      refreshed: 0,
      failed: 0,
      batchSize
    };

    const samples: Array<{ userId: string; miningRank: number; miningRate: number; lastCalculatedAt: number; }> = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      if (dryRun) {
        summary.refreshed += batch.length;
      } else {
        const batchResults = await Promise.all(
          batch.map(async (userId) => {
            try {
              const result = await vault.getMiningRankSnapshot(userId, true);
              if (!result) {
                summary.failed += 1;
                return;
              }

              summary.refreshed += 1;
              if (samples.length < 25) {
                samples.push({
                  userId,
                  miningRank: Number(result.newMiningRank || 1),
                  miningRate: Number(result.miningRate || 0),
                  lastCalculatedAt: Number(result.lastCalculatedAt || Date.now())
                });
              }
            } catch (error) {
              summary.failed += 1;
              console.error("RefreshAllMiningRanksAPI failed for user:", userId, error);
            }
          })
        );

        void batchResults;
      }

      if (i + batchSize < userIds.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    response.status(200).json({
      success: true,
      summary,
      samples
    });
  } catch (error) {
    console.error("RefreshAllMiningRanksAPI error:", error);
    response.status(500).json({ error: String(error) });
  }
});

export const DeleteUserAccountByNumber = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  if (request.query.phone === undefined) {
    response.send("Missing Phone");
    return;
  }

  let phone = String(request.query.phone);
  if (!(await userUtils.isPhoneNumberPresentInAuth(phone))) {
    response.send("Phone not present in Db: " + phone);
    return;
  }
  
  let userId = await userUtils.getUserIdByPhoneNumber(phone);
  await userUtils.deleteUserFromDbCompletely(userId);
  response.send('Removed user: ' + userId);
});

export const DeleteUserAccount = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  if (request.query.userId === undefined) {
    response.send("Missing UserId");
    return;
  }

  let userId = String(request.query.userId);
  if (!(await userUtils.isUserPresentInDb(userId))) {
    response.send("UserId not present in Db: " + userId);
    return;
  }

  await userUtils.deleteUserFromDbCompletely(userId);
  response.send('Removed user: ' + userId);
});
//#endregion

//#region Events & Score

export const JoinTournament = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const tournamentId = String(request.query.eventId);
  const userId = String(request.query.userId);

  tournament.joinTournament(tournamentId, userId).then((result) => {
    if (result == 0) {
      response.send(true);
    } else {
      //response.send(false);
      response.send(result);
    }

    //  if (result == 0) {
    //   response.send(0);
    // } else if (result == 1) {
    //   response.send(1);
    // } else if (result == 2) {
    //   response.send(2);
    // } else {
    //   response.send(-1);
    // }

    // let ret = 
    // {
    //   "Code" : "-1",
    //   "ResultText": "Error"
    // }

    // if (result == 0) {
    //   ret.ResultText = "Successfully joined."
    // } else if (result == 1) {
    //   ret.ResultText = "You do not meet the eligibility criteria for this event. Please try again."
    // } else if (result == 2) {
    //   ret.ResultText = "You cannot be in two exhibition events simultaneously."
    // } else {
    //   ret.ResultText = "Code not found."
    // }

    // ret.Code = result + ""
    // response.send(ret);



  }).catch();
});

export const JoinExhibitionTournament = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const tournamentId = String(request.query.eventId);
  const userId = String(request.query.userId);

  tournament.joinTournament(tournamentId, userId).then((result) => {

    let ret = 
    {
      "Code" : "-1",
      "ResultText": "Error"
    }

    if (result == 0) {
      ret.ResultText = "Successfully joined."
    } else if (result == 1) {
      ret.ResultText = "You do not meet the eligibility criteria for this event. Please try again."
    } else if (result == 2) {
      ret.ResultText = "You cannot be in two exhibition events simultaneously."
    } else {
      ret.ResultText = "Code not found."
    }

    ret.Code = result + ""
    response.send(ret);

  }).catch();
});

export const JoinProTournament = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const tournamentId = String(request.query.eventId);
  const userId = String(request.query.userId);

  tournament.joinTournament(tournamentId, userId).then((result) => {

    let ret = 
    {
      "Code" : "-1",
      "ResultText": "Error"
    }

    if (result == 0) {
      ret.ResultText = "Successfully joined."
    } else if (result == 1) {
      ret.ResultText = "You do not meet the eligibility criteria for this event. Please try again."
    } else {
      ret.ResultText = "Error"
    }

    ret.Code = result + ""
    response.send(ret);

  }).catch();
});

export const StartTournamentGame = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const tournamentId = String(request.query.eventId);
  const userId = String(request.query.userId);

  // tournament.startTournamentGame(tournamentId, userId).then((result) => {
  //   const resp: { [id: string]: any } = {};
  //   resp["action"] = "StartTournamentGame"
  //   resp["eventId"] = tournamentId;
  //   resp["userId"] = userId;
  //   resp["errorno"] = result.state;
  //   resp["message"] = result.msg;
  //   console.log("Start Tournament Game: " + JSON.stringify(resp));

  //   response.send(resp);
  // }).catch((err) => {
  //   console.error("StartTournament ERROR: " + err);
  //   response.send(err);
  // });

   tournament.startTournamentGame(tournamentId, userId).then((result) => {
    const resp: { [id: string]: any } = {};
    resp["action"] = "StartTournamentGame";
    resp["eventId"] = tournamentId;
    resp["userId"] = userId;
    resp["currentGame"] = result.currentGame;
    resp["currentAttempt"] = result.currentAttempt;
    resp["HasNextGame"] = result.HasNextGame;
    resp["average"] = result.average;
    resp["total"] = result.total;
    resp["CurrentAttemptTotal"] = result.CurrentAttemptTotal;
    response.status(200).json(resp);
  }).catch((err) => {
    response.status(500).json({ error: err });
  });
});



export const GetActiveTournaments = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {
    response.set('Access-Control-Allow-Origin', '*');
    tournament.getActiveTournaments().then((snapshot) => {
      const orderedElements: admin.database.DataSnapshot[] = []
      snapshot.forEach((d) => {
        orderedElements.push(d)
      });
      response.send(JSON.stringify(orderedElements));
    }).catch(err => {
      response.send({
        errorno: 4001,
        message: err.message
      });
    });
  });

export const GetActiveTournamentsForPlayer = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  // response.set('Access-Control-Allow-Origin', '*');
  const userId = String(request.query.userId);
  if (request.query.userId === undefined || userId === "") {
    response.send("Error: no UserId");
    return;
  }

  let orderedElements: admin.database.DataSnapshot[] = [];
  orderedElements = await leaderboards.getOrderedListOfEvents(userId);

  var arrOfOrderedElements: any[];
  arrOfOrderedElements = orderedElements.map(item => item.val());
  orderedElements = tournament.setTimeRemainingForEvents(arrOfOrderedElements);
  response.send(JSON.stringify(orderedElements));
});

export const GetActiveTournamentsCall = functions.runWith({ memory: "512MB" }).https.onCall((data, context) => {
  tournament.getActiveTournaments().then((snapshot) => {
    return snapshot.toJSON();
  }).catch(err => {
    return ({
      errorno: 4001,
      message: err.message
    });
  });
});

export const GetCurrentEventAverage = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const eventId = String(request.query.eventId);
  if (request.query.eventId === undefined) {
    response.send({
      errorno: 5001,
      message: "Error missing eventId"
    });
    return;
  }

  const userId = String(request.query.userId);
  const gameId = request.query.gameId === undefined ? 3 : Number(request.query.gameId);
  console.log("GetCurrentEventAverage: " + userId + " - " + eventId + " - " + gameId)

  //tournament.setIsCompletedIfNeeded(eventId, userId).then().catch();
  
  const calculated = await tournament.calculateAverage(eventId, userId, gameId, true);
  console.log("GetCurrentEventAverage: Result: AVG:" + calculated.average + " TOTAL:" + calculated.total + " is PreGame for game " + gameId)
  response.send({
    errorno: -1,
    average: calculated.average,
    total: calculated.total
  });
  return;
});

export const AddScoreToTournament = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const tournamentId = String(request.query.eventId);
  if (request.query.eventId === undefined) {
    response.send({
      errorno: 5001,
      message: "Error missing eventId"
    });
    return;
  }
  const phaseId = 1;

  const userId = String(request.query.userId);
  const highScore = Number(request.query.highScore);
  const credits = request.query.credits === undefined ? 0 : Number(request.query.credits);
  const coins = request.query.coins === undefined ? 0 : Number(request.query.coins);

  const gameId = request.query.gameId === undefined ? await tournament.getCurrentGameOfTournament(tournamentId, phaseId, userId) : Number(request.query.gameId);

  console.log("AddScoreToTournament - eventId:" + request.query.eventId + " userId:" + request.query.userId + " highScore:" + request.query.highScore + " credits:" + request.query.credits + " coins:" + request.query.coins + " gameId:" + request.query.gameId);

  tournament.addScoreToPlayer(tournamentId, phaseId, gameId, userId, highScore, credits, coins)
    .then((result) => {
      if (result.scorePosted < 0) {
        response.send({
          errorno: 7001,
          message: "No possible to add score"
        });
      } else {
       response.status(200).json(result);
      }
    }).catch();
  /*}).catch();*/
});
//#endregion

//#region Prices
export const AcceptPrizeForTournament = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const tournamentId = String(request.query.eventId);
  const userId = String(request.query.userId);
  if (request.query.eventId === undefined || request.query.userId === undefined) {
    response.send({
      errorno: 1001,
      message: "Error missing eventId or PlayerId"
    });
    return;
  }
  tournament.acceptPlayerPrize(tournamentId, userId).then(
    (proceed) => {
      if (proceed >= 0)
        response.send({
          errorno: -1,
          message: "Accepted Prize total credits " + proceed
        });
      else
        response.send({
          errorno: 10001,
          message: "Error Accepting Prize " + proceed
        });
    }).catch();
});

export const GetPendingEventFinale = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  const userId = String(request.query.userId);

  tournament.getPendingAcceptanceEventFinaleForUser(userId).then((snapshot) => {
    response.send(snapshot);
  }).catch(err => {
    response.send({
      errorno: 4001,
      message: err.message
    });
  });
});

//#endregion

export const RequestWeeklyReward = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  if (request.query.userId === undefined) {
    response.send("Missing UserId");
    return;
  }

  const userId = String(request.query.userId);
  if (await audience.requestWeeklyAction(userId)) {
    response.send("1")
  } else {
    response.send("0")
  }
});

export const CanRequestWeeklyReward = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  if (request.query.userId === undefined) {
    response.send("Missing UserId");
    return;
  }

  const userId = String(request.query.userId);
  if (await schedule.canRequestWeeklyRewardByUserId(userId)) {
    response.send("1")
  } else {
    response.send("0")
  }
});

//#region NewEvent
export const CreateTopPlayerEvent = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  console.log("zpln --- CreateTopPlayerEvent");
  let delayInDays: number = Number(request.query.delayInDays);

  if (request.query.delayInDays === undefined) {
    delayInDays = 0;
  }
  tournament_card.createTopPlayerEvent(delayInDays)
    .then((resp) => response.send(resp))
    .catch(() => response.send("Error"));
});

export const CreateHighScoreEvent = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  console.log("zpln --- CreateHighScoreEvent");
  let delayInDays: number = Number(request.query.delayInDays);

  if (request.query.delayInDays === undefined) {
    delayInDays = 0;
  }
  tournament_card.createHighScoreEvent(delayInDays)
    .then((resp) => response.send(resp))
    .catch(() => response.send("Error"));
});

export const CreateSponsoredEvent = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  console.log("zpln --- CreateSponsoredEvent");
  let delayInDays: number = Number(request.query.delayInDays);

  if (request.query.delayInDays === undefined) {
    delayInDays = 0;
  }
  tournament_card.createSponsoredEvent(delayInDays)
    .then((resp) => response.send(resp))
    .catch(() => response.send("Error"));
});

export const GetSampleSponsoredEventData = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  let data = { ...tournament_card.SponsoredEventDataTemplate };
  response.send(data);
});
//--------------------New Event functions end here-----------------------//

// Create sponsored event using tournament_cards.createSponsoredEvent and SponsoredEventDataTemplate.
// Accepts POST (body JSON) or GET/POST query params. Query overrides body.
// export const CreateSponsoredEventAPI = functions.https.onRequest(async (request, response) => {
//   try {
//     const body: any = request.method === "POST" ? (request.body || {}) : {};
//     const q: any = request.query || {};
//     const src = { ...body, ...q }; // query overrides body

//     const parseNumber = (v: any, def: any = undefined) => {
//       if (v === undefined || v === null || v === "") return def;
//       const n = Number(v);
//       return isNaN(n) ? def : n;
//     };
//     const parseBool = (v: any, def: any = undefined) => {
//       if (v === undefined || v === null || v === "") return def;
//       if (typeof v === "boolean") return v;
//       const s = String(v).toLowerCase();
//       if (s === "true" || s === "1" || s === "yes") return true;
//       if (s === "false" || s === "0" || s === "no") return false;
//       return def;
//     };
//     const parseJSONorArray = (v: any, def: any = undefined) => {
//       if (v === undefined || v === null || v === "") return def;
//       if (Array.isArray(v)) return v;
//       if (typeof v === "string") {
//         try { return JSON.parse(v); } catch { return v.split(",").map((s: string) => s.trim()).filter(Boolean); }
//       }
//       return v;
//     };

//     // build override payload (allow same fields as tournament_cards)
//     const overrides: any = {};
//     const fields = [
//       "name","brandLogoImage","brandText","brandTextImage","coinsCost","coinsJackpot","creditprizeScreen",
//       "isAudienceEvent","isBrandEvent","isEchoEvent","isExhibitionEvent","isHighScoreEvent","isJackpotEvent","isZplnEvent",
//       "redirectURL","totalAttemptsAllowed","videoURL","visitSponsorReward","joinBackgroundImage","finaleBackgroundImage",
//       "startDate","remainsHours","numberOfPrizes","gameSeeds","gameSongs","gameThemes","prizes","numberOfPlayers","numberOfPhases",
//       "eventOrder","eventType"
//     ];
//     for (const f of fields) {
//       if (src[f] === undefined) continue;
//       if (["coinsCost","coinsJackpot","visitSponsorReward","remainsHours","numberOfPrizes","numberOfPlayers","numberOfPhases","eventOrder","eventType","totalAttemptsAllowed"].includes(f)) {
//         overrides[f] = parseNumber(src[f]);
//       } else if (["isAudienceEvent","isBrandEvent","isEchoEvent","isExhibitionEvent","isHighScoreEvent","isJackpotEvent","isZplnEvent"].includes(f)) {
//         overrides[f] = parseBool(src[f]);
//       } else if (["gameSeeds","gameSongs","gameThemes","prizes"].includes(f)) {
//         overrides[f] = parseJSONorArray(src[f]);
//       } else {
//         overrides[f] = src[f];
//       }
//     }

//     const delayInDays = parseNumber(src.delayInDays, 0) || 0;

//     const result = await tournament_cards.createSponsoredEvent(delayInDays, overrides);

//     response.status(200).json({ state: 0, result });
//   } catch (err) {
//     console.error("CreateSponsoredEvent error:", err);
//     response.status(500).json({ state: -1, error: String(err) });
//   }
// });

//

export const CreateSponsoredEventAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    // Helper parsers
    const parseNumber = (v: any, def: any = undefined) => {
      if (v === undefined || v === null || v === "") return def;
      const n = Number(v);
      return isNaN(n) ? def : n;
    };
    const parseBool = (v: any, def: any = undefined) => {
      if (v === undefined || v === null || v === "") return def;
      if (typeof v === "boolean") return v;
      const s = String(v).toLowerCase();
      if (s === "true" || s === "1" || s === "yes") return true;
      if (s === "false" || s === "0" || s === "no") return false;
      return def;
    };
    const parseJSONorArray = (v: any, def: any = undefined) => {
      if (v === undefined || v === null || v === "") return def;
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try { return JSON.parse(v); } catch { return v.split(",").map((s: string) => s.trim()).filter(Boolean); }
      }
      return v;
    };

    // aggregate source object from query + body/form-data
    const src: any = { ...request.query };

    // If multipart/form-data -> use Busboy to parse fields
    const contentType = (request.headers['content-type'] || '').toString();
    if (contentType.indexOf('multipart/form-data') !== -1) {
      await new Promise<void>((resolve, reject) => {
        const busboy = new Busboy({ headers: request.headers });
        busboy.on('field', (fieldname: string, val: any) => {
          // prefer last value if duplicated
          src[fieldname] = val;
        });
        // ignore files for now; if you expect files handle 'file' events here
        busboy.on('file', (_name: string, _file: any) => {
          // consume or discard stream to avoid hanging
          _file.on('data', () => { });
          _file.on('end', () => { });
        });
        busboy.on('finish', () => resolve());
        busboy.on('error', (err: any) => reject(err));
        (request as any).pipe(busboy);
      });
    } else {
      // non-multipart: body already parsed by firebase functions (JSON or urlencoded)
      const body = request.body || {};
      Object.assign(src, body);
    }

    // fields allowed to override (same as tournament_cards)
    const fields = [
      "name","brandLogoImage","brandText","brandTextImage","coinsCost","coinsJackpot","creditprizeScreen",
      "isAudienceEvent","isBrandEvent","isEchoEvent","isExhibitionEvent","isHighScoreEvent","isJackpotEvent","isZplnEvent",
      "redirectURL","totalAttemptsAllowed","videoURL","visitSponsorReward","joinBackgroundImage","finaleBackgroundImage",
      "startDate","remainsHours","numberOfPrizes","gameSeeds","gameSongs","gameThemes","prizes","numberOfPlayers","numberOfPhases",
      "eventOrder","eventType"
    ];

    const overrides: any = {};
    for (const f of fields) {
      if (src[f] === undefined) continue;
      if (["coinsCost","coinsJackpot","visitSponsorReward","remainsHours","numberOfPrizes","numberOfPlayers","numberOfPhases","eventOrder","eventType","totalAttemptsAllowed"].includes(f)) {
        overrides[f] = parseNumber(src[f]);
      } else if (["isAudienceEvent","isBrandEvent","isEchoEvent","isExhibitionEvent","isHighScoreEvent","isJackpotEvent","isZplnEvent"].includes(f)) {
        overrides[f] = parseBool(src[f]);
      } else if (["gameSeeds","gameSongs","gameThemes","prizes"].includes(f)) {
        overrides[f] = parseJSONorArray(src[f]);
      } else {
        overrides[f] = src[f];
      }
    }

    const delayInDays = parseNumber(src.delayInDays, 0) || 0;

    const result = await tournament_card.createSponsoredEvent(delayInDays, overrides);

    response.status(200).json({ state: 0, result });
  } catch (err) {
    console.error("CreateSponsoredEventAPI error:", err);
    response.status(500).json({ state: -1, error: String(err) });
  }
});

//#endregion





//#region  Utils for management

export const GetAllUsers = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {
    response.set('Access-Control-Allow-Origin', '*');
    admin.database().ref("Users/").once("value").then((snapshot) => {
      response.send(snapshot.toJSON());
    }).catch(err => {
      response.send({
        errorno: 4001,
        message: err.message
      });
    });
  });



export const CleanUserAuth = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  utils.listAllUsers().then(uids => {
    //console.log(uids);
    utils.deleteUsers(uids);
  }).catch();

});

//endregion

//#region Leaderboards
export const GetPlayerList = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  console.log(request.query.eventId);
  const tournamentId = String(request.query.eventId);

  let limit = 10
  if (request.query.limit !== undefined) {
    limit = Number(request.query.limit);
  }

  leaderboards.getEventLeaderboard(tournamentId, null, limit).then((result) => {
    return response.send(result)
  }).catch(() => { return response.send("Error") });
});


export const CleanPracticeScores = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {

    utils.CleanPracticeScores().then(() => {
      response.send("OK");
    }).catch((err) => {
      response.send(err);
    });

    return;


  });

export const CleanLeaderboards = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {

    let exceptActive: boolean = String(request.query.exceptActive) === 'true';
    if (request.query.exceptActive === undefined) {
      exceptActive = true;
    }

    let resetGeneral: boolean = String(request.query.resetGeneral) === 'true';
    if (request.query.resetGeneral === undefined) {
      resetGeneral = false;
    }

    console.log("Call Clean Leaderboards " + exceptActive + " " + resetGeneral)
    const res = await leaderboards.CleanAllLeaderboards(exceptActive, resetGeneral);

    response.status(200).send(res);

  });

export const ResetHighScoreLeaderboard = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {
    await leaderboards.resetHighScoreLeaderboard();
    response.status(200).send("{status:1}");
  });

export const ResetJackpotLeaderboard = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {
    await leaderboards.resetJackpotLeaderboard();
    response.status(200).send("{status:1}");
  });

export const GetPlayerLeaderboardRank = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {

    const userId: string | null = String(request.query.userId);
    if (request.query.userId === undefined) {
      response.send("Error: no UserId");
      return;
    }

    const eventId: string | null = String(request.query.eventId);
    if (request.query.eventId === undefined) {
      response.send("Error: no EventId");
      return;
    }


    leaderboards.getPlayerAnyLeaderboardRank(eventId, userId)
      .then((result) => {
        response.send(result);
        return;
      })
      .catch(() => {
        response.send("Error: Impossible to retrieved Data");
        return;
      });


  });


export const GetHighScoreLeaderboard = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  /*if (request.query.userId === undefined){
    response.send("Error");
    return;
  }*/

  let limit = 50
  let userId: string | null = String(request.query.userId);
  if (request.query.userId === undefined) {
    userId = null;
    limit = 25
  }

  leaderboards.getHighScoreLeaderboard(userId, limit).then((result) => {
    return response.send(result)
  }).catch(() => { response.send("Error"); return; });

});

export const GetEventLeaderboard = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {

    if (request.query.eventId === undefined) {
      response.send("Error");
      return;
    }

    let limit = 50;
    const eventId = String(request.query.eventId);
    let userId: string | null;
    if (request.query.userId === undefined) {
      userId = null;
      limit = 25;
    } else {
      userId = String(request.query.userId);
    }

    leaderboards.getEventLeaderboard(eventId, userId, limit).then((result) => {
      return response.send(result)
    }).catch();

  });

export const GetJackpotLeaderboard = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {

    let userId = null;
    if (request.query.userId !== undefined)
      userId = String(request.query.userId);

    leaderboards.getJackpotLeaderboard(userId, 50).then((result) => {
      return response.send(result)
    }).catch();

  });

export const GetAudienceLeaderboard = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {
    let limit = 50;
    let userId: string | null = String(request.query.userId);
    if (request.query.userId === undefined) {
      userId = null;
      limit = 25
    }
    leaderboards.getAudienceLeaderboard(userId, limit).then((result) => {
      return response.send(result)
    }).catch();

  });

export const GetCoinBasedLeaderboard = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {
    
    let limit = 50;
    if (request.query.limit === undefined) {
      limit = 25;
    } else {
      limit = Number(request.query.limit);
    }
    
    
    let userId = null;
    if (request.query.userId !== undefined)
      userId = String(request.query.userId);

    leaderboards.getCoinBasedLeaderboard_NonScalable(userId, limit).then((result) => {
      return response.send(result)
    }).catch();


  });

export const GetAllLeaderboardsForPlayer = functions.runWith({ memory: "512MB" }).https.onRequest(
  async (request, response) => {

    const userId = String(request.query.userId);
    if (request.query.userId === undefined || userId === "") {
      response.send("Error: no UserId");
      return;
    }

    let orderedElements: admin.database.DataSnapshot[] = [];
    orderedElements = await leaderboards.getOrderedListOfEvents(userId);

    let leaderboardLimit = 50;

    let arrOfAllLeaderboards: any[] = [];
    const allPromises: Promise<any>[] = [];

    orderedElements.forEach(s => {
      let isJackpotEvent = s.child("isJackpotEvent").val();
      let isHighScoreEvent = s.child("isHighScoreEvent").val();

      if (isJackpotEvent) {
        allPromises.push(leaderboards.getJackpotLeaderboard(null, leaderboardLimit));
      } else if (isHighScoreEvent) {
        allPromises.push(leaderboards.getHighScoreLeaderboard(null, leaderboardLimit));
      } else {
        let eventId = s.child("eventId").val();
        allPromises.push(leaderboards.getEventLeaderboard(eventId, null, leaderboardLimit));
      }
    });
    arrOfAllLeaderboards = await Promise.all(allPromises);

    //adding event IDs to each LB record
    const arrayOfOrderedElements: any[] = [];
    orderedElements.forEach((s, index) => {
      {
        var newObj = {
          "TournamentId": s.key,
          "Data": arrOfAllLeaderboards[index]
        }
        arrayOfOrderedElements.push(newObj);
      }
    });

    response.send(JSON.stringify(arrayOfOrderedElements));
  });


//endregion

//#region Practice Games

export const NextPracticeGame = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  const userId = String(request.query.userId);

  if (request.query.userId === undefined || userId === "") {
    response.send({ status: "error", message: "UserId not defined" })
    return;
  }

  const result = await practice_games.getNextPracticeGameInfo(userId);
  response.send(result);
  return;
});

export const GetPracticeGameFromGameIndex = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  let gameIndex = Number(request.query.gameIndex);
  if(isNaN(gameIndex))
    gameIndex = 0;

  if(gameIndex < 0 || gameIndex > 2 || gameIndex === null)
    gameIndex = 0;

  const result = await practice_games.getPracticeGameFromGameIndex(gameIndex);
  response.send(result);
  return;
});
//#endregion

//#region Vault and Levels
export const AddCoinsFromAction = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId: string | null = String(request.query.userId);
  if (request.query.userId === undefined) {
    response.status(500).send("Error. Missing UserId");
    return;
  }
  let action: string | null = String(request.query.action);
  if (request.query.action === undefined || request.query.action === null) {
    action = "video"
  }
  const coins: number | null = Number(request.query.coins);
  if (request.query.coins === undefined
    || coins === null
    || isNaN(coins)
    || Number(request.query.coins) <= 0) {
    response.status(200).send("No coins added for action=" + action);
    return;
  }

  console.log("Added Coins (" + coins + ") for action=" + action);

  try {
    const result = await vault.AddCoinsToVault(userId, coins);

    // normalize response
    if (typeof result === "number") {
      // legacy / error numeric response
      if (result < 0) {
        response.status(500).json({ error: "AddCoinsToVault failed", code: result });
        return;
      }
      // numeric positive/zero — return as coins with zero zpln fields
      response.status(200).json({
        coins: result,
        CurrentGameZplnMinned: 0,
        NeoZplnMined: 0
      });
      return;
    }

    // expected object shape: { updatedCoins, CurrentGameZplnMinned, NeoZplnMined } or { updatedCoins, zplnAdded, zplnTotal }
    const updatedCoins = Number((result as any).updatedCoins ?? (result as any).updated ?? 0);
    const CurrentGameZplnMinned = Number((result as any).CurrentGameZplnMinned ?? (result as any).zplnAdded ?? 0);
    const NeoZplnMined = Number((result as any).NeoZplnMined ?? (result as any).zplnTotal ?? 0);

    response.status(200).json({
      coins: updatedCoins,
      CurrentGameZplnMinned,
      NeoZplnMined
    });
  } catch (reason) {
    response.status(500).send("Error: " + reason);
  }
});

export const GetVaultAndLevel = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId: string | null = String(request.query.userId);
  if (request.query.userId === undefined) {
    response.status(500).send("Error. Missing UserId");
    return;
  }

  vault.GetUserLevelAndVault(userId).then((result) => {
    utils.updateUserActivity(userId).then(() => {
      return response.status(200).send(result)
    }
    ).catch((err) => { response.status(500).send("Error: " + err); return; })
  }).catch((reason) => { response.status(500).send("Error: " + reason); return; });

});

export const ResetVaults = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  let migrate: boolean = String(request.query.exceptActive) === 'true';

  if (request.query.migrate === undefined)
    migrate = true

  vault.InitializeAllPlayersVault(migrate).then((result) => {
    response.send(result); return;

  }).catch((reason) => { response.send("Error: " + reason); return; });

});

export const ResetAllUsersData = functions.runWith({
  timeoutSeconds: 300,
  memory: "1GB"
})
  .https.onRequest(async (request, response) => {
    request.setTimeout(300000);
    if (request.query.yesSure === undefined) {
      response.send("Error. You are not completely sure, type yesSure=sure");
      return;
    }

    let onlyActives: boolean = String(request.query.onlyActives) === 'true';

    if (request.query.onlyActives === undefined)
      onlyActives = false

    utils.ResetAllUsersData(onlyActives).then((result) => {
      response.send(result); return;

    }).catch((reason) => { response.send("Error: " + reason); return; });

  });

export const ConvertCoinsIntoCash = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId: string | null = String(request.query.userId);
  if (request.query.userId === undefined) {
    response.send("Error. Missing UserId");
    return;
  }

  const res = await vault.ConvertCoinsIntoCash(userId);

  if (res >= 0) {
    response.status(200).send({ cash: res });
    return;
  } else {
    response.status(501).send("Error: " + res);
    return;
  }


});

export const ConvertCoinsIntoCashForAllUsers = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  const res = await vault.ConvertCoinsIntoCashForAllUsers();

  if (res >= 0) {
    response.status(200).send({ users: res });
    return;
  } else {
    response.status(501).send("Error: " + res);
    return;
  }
});

export const ResetCash = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId: string | null = String(request.query.userId);
  if (request.query.userId === undefined) {
    response.send("Error. Missing UserId");
    return;
  }

  let limit: number | null = Number(request.query.limit);
  if (request.query.limit === undefined) {
    limit = 20;
  }

  const res = await vault.ResetCashVault(userId, limit);

  if (res) {
    response.status(200).send({ cash: res });
    return;
  } else {
    response.status(501).send("Error: " + res);
    return;
  }
});

export const ResetCashForAll = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  let limit: number | null = Number(request.query.limit);
  if (request.query.limit === undefined) {
    limit = 20;
  }

  const res = await vault.ResetCashForAllUsers(limit);

  if (res) {
    response.status(200).send({ reset: res });
    return;
  } else {
    response.status(501).send("Error: " + res);
    return;
  }
});

export const CalculateAllUsersMakaRewardsAPI = functions.runWith({ timeoutSeconds: 540, memory: "1GB" }).https.onRequest(async (request, response) => {
  try {
    const dryRun = String(request.query.dryRun || "false").toLowerCase() === "true";
    const batchSizeInput = Number(request.query.batchSize || 50);
    const batchSize = Number.isFinite(batchSizeInput) ? Math.max(1, Math.min(100, Math.floor(batchSizeInput))) : 50;

    const result = await vault.calculateAllUsersTeamGrowthRewardsForBatch(!dryRun, batchSize);

    response.status(200).json({
      success: true,
      dryRun,
      batchSize,
      processed: result.processed,
      totalMaka: result.totalMaka,
      totalCash: result.totalCash,
      totalRewards: result.totalRewards,
      nonQualifiedUserMakaTotal: result.nonQualifiedUserMakaTotal,
      nonQualifiedUserCashTotal: result.nonQualifiedUserCashTotal,
      users: result.users.slice(0, 50)
    });
    return;
  } catch (error) {
    console.error("CalculateAllUsersMakaRewardsAPI error:", error);
    response.status(500).json({ success: false, error: String(error) });
    return;
  }
});

export const ResetMakaForAll = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const res = await vault.ResetMakaForAllUsers();

  if (res >= 0) {
    response.status(200).send({ reset: res });
    return;
  } else {
    response.status(501).send("Error: " + res);
    return;
  }
});

export const AddLiraToVault = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  const userId = String(request.query.userId);
  const lira = Number(request.query.lira);
  let score = Number(request.query.score);
  let gameIndex = Number(request.query.practiceGameIndex);
  let setIndex = Number(request.query.practiceSetIndex);

  if (request.query.userId === undefined || userId === "") {
    response.send({ status: "error", message: "UserId not defined" })
    console.error("No UserId defined");
    return;
  }

  if (request.query.score === undefined || score === null) {
    score = 0
  }

  if (request.query.practiceGameIndex === undefined || gameIndex === null) {
    console.warn("practiceGameIndex not defined");
    gameIndex = 0;
  }

  if (request.query.practiceSetIndex === undefined || setIndex === null) {
    console.warn("practiceSetIndex not defined")
    setIndex = 0;
  }

  let practiceScores = { practiceGlobalAverage: 0, practiceSerieTotal: 0 }
  if (score > 0)
    practiceScores = await practice_games.addPracticeGameScore(userId, score, gameIndex, setIndex);
  vault.AddLiraToVault(userId, lira).
    then((result) => {
      console.log("Add lira to " + userId + " : " + result + " : " + JSON.stringify(practiceScores));

      if (result < 0)
        response.send({ status: "error", lira: 0, ...practiceScores })
      else
        response.send({ status: "ok", lira: result, ...practiceScores });

      return;
    }).catch();

});

export const ConvertLiraToCoins = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  const userId = String(request.query.userId);
  const coins = Number(request.query.coins);

  if (request.query.userId === undefined || userId === "") {
    response.send({ status: "error", message: "UserId not defined" })
    return
  }

  vault.ConvertLiraIntoCoins(userId, coins).
    then((result) => {

      if (result < 0)
        response.send({ status: "error", lira: 0 })
      else
        response.send({ status: "ok", lira: result });
      return;
    }).catch();
});

export const RedeemVaultWithAmount = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  const userId = String(request.query.userId);
  if (request.query.userId === undefined || userId === "") {
    response.send(false);
    return;
  }

  const email = String(request.query.email);
  if (request.query.email === undefined || email === "") {
    response.send(false);
    return;
  }

  const redeemAmount = Number(request.query.redeemAmount);
  if (redeemAmount <= 0) {
    response.send(false);
    return;
  }

  let redeemResult = await vault.redeemVaultWithAmount(userId, email, redeemAmount);
  response.send(redeemResult);
});
//#endregion

//#region Reports
export const CreateReports = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response): Promise<any> => {
  await reporting.generateReports()
  response.send("Done");
  return;
});

export const CreateDAUReport = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response): Promise<any> => {
  const pathResult = await reporting.createReportLastWeekDAU(new Date('2023-02-28'))
  response.status(200).send("Created at: " + pathResult);
  return;
});
//endregion

//#region Testing
export const TestGetEventFromDatabase = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response): Promise<any> => {
  const eventId = String(request.query.eventId);
  try {
    const evt = await Event_Data.get_from_database(eventId);
    response.send(JSON.stringify(evt));
    return;
  } catch (e) {
    console.error(e);
    response.send("ERROR: " + e);
  }

});

export const ManualDailyEnd = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response): Promise<any> => {

  try {
    await tournament.dailyRecap(null);
    response.send("OK");
    return;
  } catch (e) {
    console.error(e);
    response.send("ERROR: " + e);
  }

});
//#endregion

//#region For Internal Use
export const ResetCoinsForAllUsers = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  response.set('Access-Control-Allow-Origin', '*');

  let resetCoinCount = 200;
  let queryParamCoinCount: string | null = String(request.query.coinCount);
  if (queryParamCoinCount != undefined) {
    let parsedCoinCount = utils.parseInteger(queryParamCoinCount);
    if (isNaN(parsedCoinCount)) {
      response.send({
        errorno: 1111,
        message: "Please enter a valid count for coins."
      });
      return;
    }
    resetCoinCount = parsedCoinCount;
  }

  const retStr = await userUtils.resetCoinsForAllUsers(resetCoinCount);
  response.send(retStr);
});

export const AddRegistrationCodeForAllUsers = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  admin.database().ref("Users").once("value").then((snapshot) => {
    snapshot.forEach(element => {
      let user = element.val();
      const userRef = admin.database().ref(`Users/${user.userId}/RegistrationCode`);
      let RegistrationCodeForUser = utils.generateInviteCode();
      userRef.set(RegistrationCodeForUser)
        .then(() => {
          console.log(`Updated Registration code for user ${user.userId} - ${RegistrationCodeForUser}`);
        })
        .catch((error) => {
          console.error(`Error updating Registration code for user ${user.userId}:`, error);
        });
    });

    response.send("Registration code updated for all users.");

  }).catch(err => {
    response.send({
      errorno: 4001,
      message: err.message
    });
  });
});

export const DeleteAllUsersAndUserSpecificData = functions.runWith({
  timeoutSeconds: 300
}).https.onRequest(async (request, response) => {

  const pwd = String(request.body.pwd);

  if(STAGING)
  {
    if (!(pwd === "Ediiie911")) {
      response.send(`Unauthorized`);
      return;
    }
  }
  else
  {
    if (!(pwd === "MasterEdiiie911")) {
      response.send(`Unauthorized`);
      return;
    }
  }

  // if (STAGING) {
    //clear authenticated users
    await utils.clearAllAuthenticatedUsers();

    //clear relevant records from realtime database
    await utils.clearRecordFromRealtimeDatabase("Audience");
    await utils.clearRecordFromRealtimeDatabase("InviteCodes");
    await utils.clearRecordFromRealtimeDatabase("ShortlinkCodes");
    await utils.clearRecordFromRealtimeDatabase("Users");

    //clear firestore database
    await utils.clearAllFirestoreCollections();

    response.send(`DeleteAllUsersAndUserSpecificData Done`);
  // } else {
  //   response.send(`Not allowed on PROD`);
  // }
});

export const DeleteCompleteFirestoreDb = functions.runWith({
  timeoutSeconds: 300
}).https.onRequest(async (request, response) => {

  const pwd = String(request.body.pwd);

  if (STAGING) {
    if (!(pwd === "Ediiie911")) {
      response.send(`Unauthorized`);
      return;
    }
  }
  else {
    if (!(pwd === "MasterEdiiie911")) {
      response.send(`Unauthorized`);
      return;
    }
  }

  //clear firestore database
  await utils.clearAllFirestoreCollections();

  response.send(`DeleteCompleteFirestoreDb Done`);
});

function getInternalAdminPassword(request: functions.https.Request): string {
  const body = (request.body && typeof request.body === "object") ? request.body as Record<string, unknown> : {};
  const fromBody = String(body.pwd || "").trim();
  if (fromBody) return fromBody;
  return String(request.query.pwd || "").trim();
}

function isInternalAdminAuthorized(request: functions.https.Request): boolean {
  const pwd = getInternalAdminPassword(request);
  if (!pwd) return false;
  if (STAGING) return pwd === "Ediiie911";
  return pwd === "MasterEdiiie911";
}

function sanitizeBackupLabel(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 80);
}

export const BackupSpillTreeAPI = functions.runWith({ timeoutSeconds: 300, memory: "1GB" }).https.onRequest(async (request, response) => {
  response.set("Access-Control-Allow-Origin", "*");

  if (!isInternalAdminAuthorized(request)) {
    response.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    const sourcePath = String(request.query.sourcePath || "SpillTree").replace(/^\/+/, "") || "SpillTree";
    const backupLabel = sanitizeBackupLabel(String(request.query.backupLabel || ""));
    const backupKey = backupLabel || `${Date.now()}`;
    const backupPath = `Backups/SpillTree/${backupKey}`;

    const sourceSnap = await admin.database().ref(sourcePath).once("value");
    const backupPayload = {
      sourcePath,
      createdAt: Date.now(),
      nodeExists: sourceSnap.exists(),
      data: sourceSnap.exists() ? sourceSnap.val() : null,
    };

    await admin.database().ref(backupPath).set(backupPayload);

    response.status(200).json({
      success: true,
      sourcePath: `/${sourcePath}`,
      backupPath: `/${backupPath}`,
      backupKey,
      nodeExists: sourceSnap.exists(),
    });
    return;
  } catch (error) {
    console.error("BackupSpillTreeAPI error:", error);
    response.status(500).json({ success: false, error: String(error) });
    return;
  }
});

export const RebuildSpillTreeAPI = functions.runWith({ timeoutSeconds: 540, memory: "1GB" }).https.onRequest(async (request, response) => {
  response.set("Access-Control-Allow-Origin", "*");

  if (!isInternalAdminAuthorized(request)) {
    response.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    const q: any = request.method === "GET" ? request.query : request.body;
    const rootPath = String(q.rootPath || tournament.Users_DB).replace(/^\/+/, "") || tournament.Users_DB;
    const clearExisting = String(q.clearExisting || "true").toLowerCase() === "true";

    if (clearExisting) {
      await admin.database().ref(audience.SpillTree_DB).remove();
    }

    const result = await audience.backfillSpillTree(rootPath);
    response.status(200).json({
      success: true,
      rootPath,
      clearExisting,
      spillTreePath: `/${audience.SpillTree_DB}`,
      result,
    });
    return;
  } catch (error) {
    console.error("RebuildSpillTreeAPI error:", error);
    response.status(500).json({ success: false, error: String(error) });
    return;
  }
});

export const RestoreSpillTreeAPI = functions.runWith({ timeoutSeconds: 540, memory: "1GB" }).https.onRequest(async (request, response) => {
  response.set("Access-Control-Allow-Origin", "*");

  if (!isInternalAdminAuthorized(request)) {
    response.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    const q: any = request.method === "GET" ? request.query : request.body;
    const backupKey = String(q.backupKey || "").trim();
    const backupPathRaw = String(q.backupPath || "").trim();
    const targetPath = String(q.targetPath || audience.SpillTree_DB).replace(/^\/+/, "") || audience.SpillTree_DB;

    if (!backupKey && !backupPathRaw) {
      response.status(400).json({ success: false, error: "Missing backupKey or backupPath" });
      return;
    }

    const backupPath = backupPathRaw
      ? backupPathRaw.replace(/^\/+/, "")
      : `Backups/SpillTree/${backupKey}`;

    const backupSnap = await admin.database().ref(backupPath).once("value");
    if (!backupSnap.exists()) {
      response.status(404).json({ success: false, error: "Backup not found", backupPath: `/${backupPath}` });
      return;
    }

    const backupValue = backupSnap.val();
    const restoreData = (backupValue && typeof backupValue === "object" && Object.prototype.hasOwnProperty.call(backupValue, "data"))
      ? (backupValue as Record<string, unknown>).data
      : backupValue;

    await admin.database().ref(targetPath).set(restoreData ?? null);

    response.status(200).json({
      success: true,
      backupPath: `/${backupPath}`,
      targetPath: `/${targetPath}`,
      restoredAt: Date.now(),
    });
    return;
  } catch (error) {
    console.error("RestoreSpillTreeAPI error:", error);
    response.status(500).json({ success: false, error: String(error) });
    return;
  }
});
//#endregion



// export const GetMiningData = functions.https.onRequest(async (request, response) => {
//   const userId = String(request.query.userId || "");
//   if (!userId) {
//     response.status(400).json({ error: "missing userId" });
//     return;
//   }

//   try {
//     const miningData = await vault.calculateAndUpdateMiningRateForUser(userId);
//     if (!miningData) {
//       response.status(404).json({ error: "user not found" });
//       return;
//     }

//     const payload = {
//       Action: "GetMiningData",
//       UserId: userId,
//       PlayRankEnergy: miningData.playRankEnergy,
//       StarbornEnergy: miningData.starbornEnergy,
//       ArchitectEnergy: miningData.architectEnergy,
//       SolarisEnergy: miningData.solarisEnergy,
//       ApolloEnergy: miningData.apolloEnergy,
//       LightmasterEnergy: miningData.lightmasterEnergy,
//       TotalEnergy: miningData.totalEnergy,
//       MiningRate: miningData.miningRate,
//       Sector1Total: miningData.sector1Total,
//       CelestialCount: miningData.Celestialcount,
//       StarbornCount: miningData.Starborncount,
//       ArchitectCount: miningData.Architectcount,
//       SolarisCount: miningData.Solariscount,
//       ApolloCount: miningData.Apollocount,
//       NewMiningRank: miningData.newMiningRank,
//       playerRank: miningData.playerRank
//     };

//     response.status(200).json(payload);
//   } catch (err) {
//     console.error("GetMiningData error for user:", userId, err);
//     response.status(500).json({ error: "Internal Server Error" });
//   }
// });

export const GetMiningData = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId || "");
  if (!userId) {
    response.status(400).json({ error: "missing userId" });
    return;
  }

  const forceRefresh = String(request.query.forceRefresh || "").toLowerCase() === "true";

  try {
    const { children: actualChildren } = await getActualChildrenDetails(userId);
    const actualChildrenCount = actualChildren.length;
    const { childIds: miningChildrenIds } = await getMiningChildrenDetails(userId);
    const isQualified = actualChildrenCount >= 5;

    // Qualified users persist rank/mining/reward updates to vault.
    // Non-qualified users receive preview-only computed values.
    const miningData = await vault.getMiningRankSnapshot(userId, forceRefresh, isQualified);
    if (!miningData) {
      response.status(404).json({ error: "user not found" });
      return;
    }

    const payload = {
      Action: "GetMiningData",
      UserId: userId,
      isEchoUser: miningData.isEchoUser,
      actualChildrenCount,
      spillTreeChildrenCount: miningChildrenIds.length,
      isQualified,
      persistedToVault: isQualified,

      playRankEnergy: miningData.playRankEnergy,
      agentEnergy: miningData.agentEnergy,
      builderEnergy: miningData.builderEnergy,
      specialistEnergy: miningData.specialistEnergy,
      architectEnergy: miningData.architectEnergy,
      phantom1Energy: miningData.phantom1Energy,
      phantom2Energy: miningData.phantom2Energy,
      phantom3Energy: miningData.phantom3Energy,
      phantom4Energy: miningData.phantom4Energy,

      totalEnergy: miningData.totalEnergy,
      miningRate: miningData.miningRate,
      sector1Total: miningData.sector1Total,

      playerCount: miningData.playerCount,
      agentCount: miningData.agentCount,
      builderCount: miningData.builderCount,
      specialistCount: miningData.specialistCount,
      architectCount: miningData.architectCount,
      phantom1Count: miningData.phantom1Count,
      phantom2Count: miningData.phantom2Count,
      phantom3Count: miningData.phantom3Count,
      phantom4Count: miningData.phantom4Count,
      actualPlayerCount: miningData.actualPlayerCount,
      actualAgentCount: miningData.actualAgentCount,
      actualBuilderCount: miningData.actualBuilderCount,
      actualSpecialistCount: miningData.actualSpecialistCount,
      actualArchitectCount: miningData.actualArchitectCount,
      actualPhantom1Count: miningData.actualPhantom1Count,
      actualPhantom2Count: miningData.actualPhantom2Count,
      actualPhantom3Count: miningData.actualPhantom3Count,
      actualPhantom4Count: miningData.actualPhantom4Count,

      newMiningRank: miningData.newMiningRank,
      playerRank: miningData.playerRank,
      agentMakaReward: miningData.agentMakaReward,
      builderMakaReward: miningData.builderMakaReward,
      specialistMakaReward: miningData.specialistMakaReward,
      architectMakaReward: miningData.architectMakaReward,
      phantom1CashReward: miningData.phantom1CashReward,
      phantom2CashReward: miningData.phantom2CashReward,
      phantom3CashReward: miningData.phantom3CashReward,
      phantom4CashReward: miningData.phantom4CashReward,
      fromCache: miningData.fromCache,
      lastCalculatedAt: miningData.lastCalculatedAt
    };

    response.status(200).json(payload);
  } catch (err) {
    console.error("GetMiningData error for user:", userId, err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

export const GetMyTop5Players = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const q: any = request.method === "GET" ? request.query : request.body;
  const userId = String(q.userId || q.uid || "").trim();

  if (!userId) {
    response.status(400).json({ error: "missing userId" });
    return;
  }

  try {
    const result = await vault.getTopPlayersInSpillTreeByMiningRank(userId, 3, 5);
    response.status(200).json({
      Action: "GetMyTop5Players",
      UserId: userId,
      MaxLevel: 3,
      Limit: 5,
      TotalCandidates: result.totalCandidates,
      Players: result.players
    });
  } catch (err) {
    console.error("GetMyTop5Players error for user:", userId, err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

export const GetUserNotificationsAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId || "");
  const limit = Number(request.query.limit || 20);
  const unreadOnly = String(request.query.unreadOnly || "false").toLowerCase() === "true";

  if (!userId) {
    response.status(400).json({ error: "missing userId" });
    return;
  }

  try {
    const result = await vault.getUserNotifications(userId, limit, unreadOnly);
    response.status(200).json({
      Action: "GetUserNotificationsAPI",
      UserId: userId,
      Summary: result.summary,
      Notifications: result.notifications
    });
  } catch (err) {
    console.error("GetUserNotificationsAPI error for user:", userId, err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

export const MarkNotificationAsReadAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId || "");
  const notificationId = String(request.query.notificationId || "");

  if (!userId || !notificationId) {
    response.status(400).json({ error: "missing userId or notificationId" });
    return;
  }

  try {
    const success = await vault.markUserNotificationAsRead(userId, notificationId);
    const result = await vault.getUserNotifications(userId, 20, false);
    response.status(success ? 200 : 404).json({
      Action: "MarkNotificationAsReadAPI",
      UserId: userId,
      NotificationId: notificationId,
      Success: success,
      Summary: result.summary
    });
  } catch (err) {
    console.error("MarkNotificationAsReadAPI error for user:", userId, err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

export const MarkAllNotificationsAsReadAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId || "");

  if (!userId) {
    response.status(400).json({ error: "missing userId" });
    return;
  }

  try {
    const summary = await vault.markAllUserNotificationsAsRead(userId);
    response.status(200).json({
      Action: "MarkAllNotificationsAsReadAPI",
      UserId: userId,
      Summary: summary
    });
  } catch (err) {
    console.error("MarkAllNotificationsAsReadAPI error for user:", userId, err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

export const SendEmail = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  const email = String(request.query.email);

  if (utils.isValidEmail(email)) {
    mailer.sendEmail(email, 'Mail Subject', 'This is my content');
    response.send("Test Mail Func Ended.");
  } else {
    response.send(`${email} is not a valid email address.`);
  }
});

export const TestWeeklyReset = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  await schedule.weeklyRecap(null);
  response.send("Weekly Reset Done");
});

export const IsStagingEnvironment = functions.runWith({ memory: "512MB" }).https.onRequest(async (req, res) => {
  res.send(environments.STAGING);
});

// export const TestAddAudiencePointsToGenealogy = functions.https.onRequest(async (request, response) => {

//   const userId = String(request.query.userId);
//   const isReset = Boolean(request.query.isReset);
//   const globalAvg = Number(request.query.globalAvg);

//   await audience.addAudiencePointsToGenealogy(userId, 0, isReset, globalAvg);
//   response.send("Done");
// });


// export const TestSubtractMinutesFromCron = functions.https.onRequest(async (request, response) => {

//   const originalCronExpression = String(request.query.originalCronExpression);
//   const subtractMinutesBy = Number(request.query.subtractMinutesBy);

//   const subtractedCronExpression = utils.subtractMinutesFromCron(originalCronExpression, subtractMinutesBy);

//   console.log("Original Cron Expression:", originalCronExpression);
//   console.log("Subtracted Cron Expression:", subtractedCronExpression);

//   response.send("Done: (" + originalCronExpression + ") - (" + subtractMinutesBy +  ") = (" + subtractedCronExpression + ")");
// });

//Controlled invitation links event
export const StartControlledShareLinkEventForAllUsers = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  const currentTime = new Date();
  console.log("currentTime.toISOString : " + currentTime.toISOString());

  const startDatetimeUTCString = request.query.startDatetimeUTCString as string;

  let numberOfHoursEventShouldRun = 24;
  let queryParamNumberOfHoursEventShouldRun: number | null = Number(request.query.numberOfHoursEventShouldRun);

  if (queryParamNumberOfHoursEventShouldRun > 0) {
    numberOfHoursEventShouldRun = queryParamNumberOfHoursEventShouldRun;
  }else
  {
    response.send({
      errorno: 1111,
      message: "Please enter valid number of days."
    });
    return;
  }

  //number of shares param
  let numberOfSharesToAllot = await controlled_invites.getNumberOfSharesToAllot();
  let queryParamNumberOfSharesToAllot: number | null = Number(request.query.numberOfSharesToAllot);
  if (queryParamNumberOfSharesToAllot != null && queryParamNumberOfSharesToAllot >= 0) {
    numberOfSharesToAllot = queryParamNumberOfSharesToAllot;
  }else
  {
    response.send({
      errorno: 1111,
      message: "Please enter valid number of shares."
    });
    return;
  }


  //save event start and end datetime
  const startDatetime = new Date(startDatetimeUTCString);
  let endDatetime = new Date(startDatetime);
  endDatetime.setHours(endDatetime.getHours() + numberOfHoursEventShouldRun);
  await controlled_invites.setInviteEventTiming(startDatetime.toISOString(), endDatetime.toISOString());
  
  //set invite counts to all users
  await controlled_invites.updateInvitesForAllUsers(numberOfSharesToAllot);
  await controlled_invites.setNumberOfSharesToAllot(numberOfSharesToAllot);

  response.send("StartControlledShareLinkEventForAllUsers---");
  
});

export const StopControlledShareLinkEventForAllUsers = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  controlled_invites.onInviteEventForcefullyEnded();
  response.send("StopControlledShareLinkEventForAllUsers---");
});

export const InvitesLeftWithUser = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId);
  if (request.query.userId === undefined || userId === "") {
    response.send("Error: no UserId");
    return;
  }

  const numberOfInvitesLeft = await controlled_invites.getInvitesLeft(userId);
  response.send({numberOfInvitesLeft});//.toString()
});

export const IsInviteCodeValid = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const inviteCode = String(request.query.inviteCode);

  console.log("IsInviteCodeValid called - inviteCode: " + inviteCode);

  const parentUid = await audience.getParentUidFromParentCode(inviteCode);
  if (!parentUid) {
    response.send({ valid: false });
    return;
  }

  const parentName = await userUtils.getUsername(parentUid);
  response.send({ valid: true, parentUid, parentName });
});

export const GetCurrentTimeInISO = functions.runWith({ memory: "512MB" }).https.onRequest(async (req, res) => {
  const hours = Number(req.query.hours);
  const currentTime = new Date();
  const convertedDatetime = new Date(currentTime);
  // startDatetime.setDate(startDatetime.getDate() + numberOfDaysEventShouldRun);
  convertedDatetime.setHours(convertedDatetime.getHours() + hours);
  res.send("input: " + currentTime.toISOString() + " -- output after adding: " + convertedDatetime.toISOString());
});


export const BackupFirestoreCollection = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {

      let collection: string | null = String(request.query.collection);
      if (request.query.collection === undefined || collection === null) {
          response.send("Error: no collection");
          return;
      }

      const collectionRef = admin.firestore().collection(collection);
      const snapshot = await collectionRef.get();

      const data: any[] = [];
      snapshot.forEach((doc) => {
          data.push(doc.data());
      });

      // For example, you can save the backup to a file in Cloud Storage
      // const bucket = admin.storage().bucket('your-bucket');
      // const file = bucket.file('backup.json');
      // await file.save(JSON.stringify(data));

      response.status(200).send(JSON.stringify(data));
  } catch (error) {
      console.error('Error creating backup:', error);
      response.status(500).send('Backup failed');
  }
});

//remove all Event_Finales whose hasPrize is false - for all the users in RD
export const RemoveUserEventsFromRdWhoHasPrizeIsFalse = functions.runWith({ memory: "512MB" }).https.onRequest(async (req, res) => {
  try {

    const snapshot = await admin.database().ref('/Users').once('value');
    const users = snapshot.val();

    // Iterate over each user
    Object.keys(users).forEach(async (userId) => {
      const eventFinalesRef = admin.database().ref(`/Users/${userId}/Event_Finales`);

      const eventFinaleSS = await eventFinalesRef.once('value');
      const eventFinales = eventFinaleSS.val();

      if (eventFinales) {
        // Iterate through each event under Event_Finales
        Object.keys(eventFinales).forEach(async eventKey => {
          const event = eventFinales[eventKey];

          // Check if hasPrize is false
          if (event.hasPrize === false) {
            console.log(`Event ${eventKey} has no prize.`);
            await eventFinalesRef.update({ [eventKey]: null });         
           }
        });
      } else {
        // console.log("Event_Finales node doesn't exist.");
      }
    })
    res.status(200).send("Check completed.");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error occurred.");
  }
});

export const GetDefaultPrizeData = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    const q = request.method === "GET" ? request.query : request.body;
    const eventType = Number(q.eventType);
    const eligibility = String(q.eligibility || "Celestial");
    const count = q.count ? Math.max(1, Math.min(500, Number(q.count))) : 50;

    if (isNaN(eventType)) {
      response.status(400).json({ error: "Missing or invalid eventType" });
      return;
    }

    const prizes = tournament_card.getDefaultPrizeDataByType(eventType, eligibility, count);
    response.status(200).json({ eventType, eligibility, count: prizes.length, prizes });
  } catch (err) {
    console.error("GetDefaultPrizeData error:", err);
    response.status(500).json({ error: String(err) });
  }
});


export const NeedUpdate = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  const platform = String(request.query.platform);
  if (request.query.platform === undefined || platform === null) {
    response.send("platform missing");
    return;
  }

  const version = String(request.query.version);
  if (request.query.version === undefined || version === null) {
    response.send("version missing");
    return;
  }

  const doesTheAppNeedAnUpdate = await  appVersionChecker.NeedUpdate(platform, version);

  response.send(doesTheAppNeedAnUpdate);
});

export const CreateRequiredDbRecordsAfterReset = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

  await requireDbRecords.updateRequiredFields();
  response.send("Done");
});

export const Analytics_GetListOfAllUsernameAndPhonenumbersFromDB = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  var list = await analytics_apis.analytics_getListOfAllUsernameAndPhonenumbersFromDB();
  response.send(list);
});

export const Analytics_GetPlayersFromCoinBasedLbExceedingChipsCount = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  let coinCountValue = Number(request.query.coinCountValue);
  if (request.query.coinCountValue === undefined || coinCountValue === null) {
    coinCountValue = 1000;
  }

  var list = await analytics_apis.analytics_getPlayersFromCoinBasedLbExceedingChipsCount(coinCountValue);
  response.send(list);
});

export const Analytics_GetPlayersJoinedAfterGivenTime = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const time = String(request.query.time);
  var list = await analytics_apis.analytics_getPlayersJoinedAfterGivenTime(time);
  response.send(list);
});

export const Analytics_GetPlayersAtWave = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const phone = String(request.query.phone);
  if (request.query.phone === undefined || phone === "") {
    response.send("Error: no number");
    return;
  }

  let waveNumber = 1;
  waveNumber = Number(request.query.waveNumber);

  var list = await analytics_apis.analytics_getPlayersAtWave(phone, waveNumber);
  response.send(list);
});
//

export const TestIsUserCallingApiAuthenticated = functions.runWith({ memory: "512MB" }).https.onRequest(async (req, res) => {

  // Check if the user is authenticated
  const authHeader = req.headers.authorization;
  console.log("-0-0-TestIsUserCallingApiAuthenticated authHeader:" + authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(403).send('Unauthorized <br>--- authHeader OR Bearer absent.');
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];
  
  admin.auth().verifyIdToken(idToken)
    .then((decodedToken) => {
      const uid = decodedToken.uid;
      res.status(200).send('Function executed successfully. <br> uid:' + uid + "<br> decodedToken:" + decodedToken);
    })
    .catch((error) => {
      res.status(403).send('Unauthorized <br>--- Error verifying ID token:' + error);
    });
});

export const TestCreateDynamicLinkForInviteCode = functions.runWith({ memory: "512MB" }).https.onRequest(async (req, res) => {

  const inviteCode = String(req.query.inviteCode || '').trim();
  if (!inviteCode) {
    res.status(400).json({
      success: false,
      error: 'Missing inviteCode'
    });
    return;
  }

  try {
    const userName = String(req.query.userName || '').trim();
    const inviteLink = await createDynamicLinkForInviteCode(inviteCode, userName);

    if (inviteLink === 'Error') {
      res.status(500).json({
        success: false,
        error: 'Failed to create dynamic link',
        inviteCode,
        userName
      });
      return;
    }

    res.status(200).json({
      success: true,
      inviteCode,
      userName,
      inviteLink
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error)
    });
  }
});

export const TestABC = functions.runWith({ memory: "512MB" }).https.onRequest(async (req, res) => {
  // const userId = String(req.query.userId);

  // res.send(await controlled_invites.isInviteEventActive());
  const val = await controlled_invites.getNumberOfSharesToAllot();
  res.send(val+"");


  // res.send("TestABC success!!");
});

export const TestDecrementInviteCount = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId);
  controlled_invites.decrementInvitesLeft(userId);
  response.send('Done');
});


export const TestGetRealtimeDatabaseName = functions.runWith({ memory: "512MB" }).https.onRequest(async (req, res) => {
  const databaseName = admin.database().ref().toString();
    console.log(`Firebase Realtime Database Name: ${databaseName}`);
  res.send(`Firebase Realtime Database Name: ${databaseName}`);
});

exports.watchCoinValueChanges = functions.database.ref('/Users/{UID}/vault/coins')
  .onUpdate((change, context) => {
    const newValue = change.after.val();
    const previousValue = change.before.val();

    if (newValue !== previousValue) {
      console.log(`Coin value changed for user ${context.params.UID}. New value: ${newValue} . from ${previousValue}`);
      // Add your logic here, such as sending notifications or triggering further actions.
    }

    return null;
  });

exports.watchSavedAvatarURLChanges = functions.database.ref('/Users/{UID}/SavedAvatarURL')
.onUpdate((change, context) => {
  const newValue = change.after.val();
  const previousValue = change.before.val();

  if (newValue !== previousValue) {
    console.log(`SavedAvatarURL changed for user ${context.params.UID}. New value: ${newValue} . from ${previousValue}`);
    // Add your logic here, such as sending notifications or triggering further actions.
  }

  return null;
});

export const watchActiveTournaments = functions.runWith({ memory: "512MB" }).database.ref('/Active_Tournaments/{tournamentId}')
  .onCreate(async (snapshot, context) => {
 
    console.log('New item added::', snapshot.key);

    await snapshot.ref.update({
      [tournament.ENTRY_ALLOWED_PARAM]: {
        [tournament.LOWER_LIMIT]: -1,
        [tournament.UPPER_LIMIT]: 11,
      },
      IsEventCompleted: false
    })
  });

  //#region Db Triggers

/**
 * Trigger: keep /Parameters/GlobalMining in sync with per-user vault/NeoZplnMining
 *
 * - Listens to changes at: /Users/{userId}/vault/NeoZplnMining
 * - Computes delta = after - before and applies it atomically to /Parameters/GlobalMining via a transaction.
 * - Use this rather than scanning all users on each small update.
 *
 * Also provides an admin callable HTTP endpoint to recompute & reconcile GlobalMining from scratch.
 */
  // Keep Parameters/GlobalMining in sync when a user's NeoZplnMining changes.
export const OnUserNeoZplnMiningUpdated = functions.database
  .ref(`${tournament.Users_DB}/{userId}/${vault.Vault_User_DB}/${vault.ZplnMinned_Vault_User_DB}`)
  .onWrite(async (change, context) => {
    try {
      const beforeVal = Number(change.before.val() || 0);
      const afterVal = Number(change.after.val() || 0);
      const delta = afterVal - beforeVal;
      if (delta === 0) return null;

      const globalRef = admin.database().ref('/Parameters/GlobalMining');
      await globalRef.transaction((current) => {
        const curNum = Number(current) || 0;
        const updated = curNum + delta;
        return Number(updated.toFixed(6));
      });

      console.log(`Applied NeoZplnMining delta ${delta} for user ${context.params.userId}`);
      return null;
    } catch (err) {
      console.error("OnUserNeoZplnMiningUpdated error:", err);
      return null;
    }
  });
  //#endregion

  export const GetIngamePopupsList = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const list = await ingame_popups.getIngamePopupsList();
    let str = JSON.stringify(list);
    response.send(str);
  });

  export const AddIngamePopup = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const img = String(request.query.img);
    if (request.query.img === undefined || img === null) {
      response.send("Error: no img");
      return;
    }
    await ingame_popups.addIngamePopupsList(img);
    response.send("popup added: " + img);
  });

  export const GetPlayerGameplayCountForTournament = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId);
    if (request.query.userId === undefined || userId === null) {
      response.send("Error: no userId");
      return;
    }

    const eventId = String(request.query.eventId);
    if (request.query.eventId === undefined || eventId === null) {
      response.send("Error: no eventId");
      return;
    }

    const gameCount = await tournament.getGameplayCount(userId, eventId);
    console.log("GetPlayerGameplayCountForTournament --- gameCount: " + gameCount);
    response.send(gameCount+"");
  });

  export const GetGameSetCountCompletedByPlayerForTournament = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId);
    if (request.query.userId === undefined || userId === null) {
      response.send("Error: no userId");
      return;
    }

    const eventId = String(request.query.eventId);
    if (request.query.eventId === undefined || eventId === null) {
      response.send("Error: no eventId");
      return;
    }

    const gameSetCount = await tournament.getGameSetCompletedCount(userId, eventId);
    console.log("GetGameSetCountCompletedByPlayerForTournament --- gameSetCount: " + gameSetCount);
    response.send(gameSetCount+"");
  });

  export const GetNextExhibitionGameSongName = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId);
    if (request.query.userId === undefined || userId === null) {
      response.send("Error: no userId");
      return;
    }

    const eventId = String(request.query.eventId);
    if (request.query.eventId === undefined || eventId === null) {
      response.send("Error: no eventId");
      return;
    }

    const songLink = await tournament.getNextExhibitionGameSongName(userId, eventId);
    console.log("getNextExhibitionGameSongName --- songName: " + songLink);
    response.send(songLink);
  });

  export const GetLeaderboardBackup = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const eventId = String(request.query.eventId);
    if (request.query.eventId === undefined || eventId === null) {
      response.send("Error: no eventId");
      return;
    }

    await leaderboards.getLeaderboardBackup(eventId);
    response.send('Done');
  });

  export const GetWavescoreDataForUser = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId);
    if (request.query.userId === undefined || userId === null) {
      response.send("Error: no userId");
      return;
    }

    const jsonData = await audience.getWavescoreDataForUser(userId);
    response.send(jsonData);
  });
  
  export const GetLevel1PlayersDataForUser = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId);
    if (request.query.userId === undefined || userId === null) {
      response.send("Error: no userId");
      return;
    }

    const pageNumber = Number(request.query.pageNumber);
    if (request.query.pageNumber === undefined || pageNumber === null) {
      response.send("Error: no pageNumber");
      return;
    }

    const jsonData = await audience.getLevel1PlayersDataForUser(userId, pageNumber);
    response.send(jsonData);
  });

  function getChildIdsFromRawValue(childrenRaw: unknown): string[] {
    const childIdSet = new Set<string>();

    if (Array.isArray(childrenRaw)) {
      for (const item of childrenRaw) {
        const id = String(item || "").trim();
        if (id) childIdSet.add(id);
      }
      return Array.from(childIdSet);
    }

    if (childrenRaw && typeof childrenRaw === "object") {
      for (const key of Object.keys(childrenRaw)) {
        const id = String(key || "").trim();
        if (id) childIdSet.add(id);
      }

      for (const value of Object.values(childrenRaw)) {
        if (typeof value === "string") {
          const id = value.trim();
          if (id) childIdSet.add(id);
        }
      }
    }

    return Array.from(childIdSet);
  }

  async function getActualChildrenDetails(userId: string): Promise<{ childIds: string[]; children: any[] }> {
  const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
  if (!userSnap.exists()) {
    return { childIds: [], children: [] };
  }

  const childrenSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}/childrenIds`).once("value");
  if (!childrenSnap.exists()) {
    return { childIds: [], children: [] };
  }

  const childrenRaw = childrenSnap.val();
  const childIdSet = new Set<string>();

  if (Array.isArray(childrenRaw)) {
    for (const item of childrenRaw) {
      const id = String(item || "").trim();
      if (id) childIdSet.add(id);
    }
  } else if (childrenRaw && typeof childrenRaw === "object") {
    for (const key of Object.keys(childrenRaw)) {
      const id = String(key || "").trim();
      if (id) childIdSet.add(id);
    }

    for (const value of Object.values(childrenRaw)) {
      if (typeof value === "string") {
        const id = value.trim();
        if (id) childIdSet.add(id);
      }
    }
  }

  const childIds = Array.from(childIdSet);
  if (childIds.length === 0) {
    return { childIds: [], children: [] };
  }

  const childSnapshots = await Promise.all(
    childIds.map((id) => admin.database().ref(`${tournament.Users_DB}/${id}`).once("value"))
  );

  const children = childSnapshots
    .filter((snap) => snap.exists())
    .map((snap) => {
      const firstName = String(snap.child("firstName").val() || "").trim();
      const lastName = String(snap.child("lastName").val() || "").trim();
      const userName = String(snap.child("userName").val() || "").trim();
      const name = `${firstName} ${lastName}`.trim() || userName;
      const savedAvatarURL = String(snap.child("SavedAvatarURL").val() || "").trim();
      const miningRankEnum = Number(
        snap.child(`${vault.Vault_User_DB}/${vault.MiningRank_Vault_User_DB}`).val() || 1
      );
      const miningRank = vault.getMiningRankDisplayName(miningRankEnum);

      return {
        userId: String(snap.key || ""),
        name,
        userName,
        firstName,
        lastName,
        SavedAvatarURL: savedAvatarURL,
        profilePicture: savedAvatarURL,
        miningRankEnum,
        miningRank,
        isEchoPro: snap.child(userUtils.FieldIsEchoPro).val() === true
      };
    });

  const normalizedChildIds = children
    .map((child) => String(child.userId || "").trim())
    .filter((id) => id !== "");

  return { childIds: normalizedChildIds, children };
}

  async function getMiningChildrenDetails(userId: string): Promise<{ childIds: string[]; children: any[] }> {
    const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
    if (!userSnap.exists()) {
      return { childIds: [], children: [] };
    }

    const spillTreeChildrenSnap = await admin.database().ref(`${audience.SpillTree_DB}/${userId}/childrenIds`).once("value");
    const childIds = getChildIdsFromRawValue(spillTreeChildrenSnap.val());

    if (childIds.length === 0) {
      return { childIds: [], children: [] };
    }

    const childSnapshots = await Promise.all(
      childIds.map((id) => admin.database().ref(`${tournament.Users_DB}/${id}`).once("value"))
    );

    const children = childSnapshots
      .filter((snap) => snap.exists())
      .map((snap) => {
        const firstName = String(snap.child("firstName").val() || "").trim();
        const lastName = String(snap.child("lastName").val() || "").trim();
        const userName = String(snap.child("userName").val() || "").trim();
        const name = `${firstName} ${lastName}`.trim() || userName;
        const savedAvatarURL = String(snap.child("SavedAvatarURL").val() || "").trim();
        const miningRankEnum = Number(
          snap.child(`${vault.Vault_User_DB}/${vault.MiningRank_Vault_User_DB}`).val() || 1
        );
        const miningRank = vault.getMiningRankDisplayName(miningRankEnum);

        return {
          userId: String(snap.key || ""),
          name,
          userName,
          firstName,
          lastName,
          SavedAvatarURL: savedAvatarURL,
          profilePicture: savedAvatarURL,
          miningRankEnum,
          miningRank,
          isEchoPro: snap.child(userUtils.FieldIsEchoPro).val() === true
        };
      });

    return { childIds, children };
  }

export const GetChildrenDetailsAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userId = String(q.userId || q.uid || "").trim();

      if (!userId) {
        response.status(400).json({ error: "Missing userId" });
        return;
      }

      const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
      if (!userSnap.exists()) {
        response.status(404).json({ error: "User not found" });
        return;
      }

      const { children } = await getActualChildrenDetails(userId);

      response.status(200).json({
        success: true,
        userId,
        totalChildren: children.length,
        children
      });
    } catch (err) {
      console.error("GetChildrenDetailsAPI error:", err);
      response.status(500).json({ error: "Internal Server Error" });
    }
  });

  export const Test_addAudiencePointsToGenealogy = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId);
    if (request.query.userId === undefined || userId === null) {
      response.send("Error: no userId");
      return;
    }

    const isReset = String(request.query.isReset);
    if (request.query.isReset === undefined || isReset === null) {
      response.send("Error: no isReset");
      return;
    }

    const isResetBool = (isReset === "true");
    if (isResetBool)
      await audience.addResetAudiencePointsToGenealogy(userId, 0, 111);
    else
      await audience.addAudiencePointsToGenealogy(userId, 0, false, 111);

    response.send("done");
  });


  export const GetRankAndGlobalAverageForUser = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId);
    if (request.query.userId === undefined || userId === null) {
      response.send("Error: no userId");
      return;
    }

    const usersRef = admin.database().ref(tournament.Users_DB);
    const playerData = await usersRef.child(String(userId)).once('value');
    const averageScore = playerData.child(tournament.GlobalAverage_UserDB).exists() ?
        playerData.child(tournament.GlobalAverage_UserDB).val() : 0;

    let levelAndLevelName = await leaderboards.GetLevelAndRankForUser(userId, averageScore);

    let ret = { 
      "levelName": "Unknown", 
      "level": 0,
      "average": 0,
      playRankEnum: 1,
      playRankName: "Celestial"
    }

    if(levelAndLevelName.levelName === "Pending")
    {
      levelAndLevelName.levelName = "Celestial";
    }

    const playRankEnum = vault.determinePlayRankFromAverage(averageScore);
    const playRankName = vault.determinePlayRankNameFromAverage(averageScore);
    
    ret.levelName = levelAndLevelName.levelName;
    ret.level = levelAndLevelName.level;
    ret.average = averageScore;
    ret.playRankEnum= playRankEnum;
    ret.playRankName= playRankName;

    response.send(ret);
  });

//   export const GetRankAndGlobalAverageForUser = functions.https.onRequest(async (request, response) => {
//   const userId = String(request.query.userId);
//   if (request.query.userId === undefined || userId === null) {
//     response.send("Error: no userId");
//     return;
//   }

//   try {
//     const usersRef = admin.database().ref(tournament.Users_DB);
//     const playerData = await usersRef.child(String(userId)).once('value');

//     const averageScore = playerData.child(tournament.GlobalAverage_UserDB).exists()
//       ? Number(playerData.child(tournament.GlobalAverage_UserDB).val())
//       : 0;

//     // Map PlayRank from globalAverage using vault helpers
//     // PlayRankEnum: 1 Celestial, 2 Alpha, 3 Delta, 4 Sigma, 5 Omega, 6 Genius
//     const playRankEnum = vault.determinePlayRankFromAverage(averageScore);
//     const playRankName = vault.determinePlayRankNameFromAverage(averageScore);

//     const ret = {
//       levelName: playRankName,       // Play rank name
//       level: playRankEnum,           // PlayRankEnum
//       average: averageScore
//     };

//     response.status(200).json(ret);
//   } catch (err) {
//     console.error("GetRankAndGlobalAverageForUser error:", err);
//     response.status(500).json({ error: "Internal Server Error" });
//   }
// });

  export const TimeRemainingForEventToEnd = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {

    console.log("---------------1");
    const eventId = String(request.query.eventId);
    const eventIdVal = (await admin.database().ref(tournament.Active_Tournaments_DB + "/" + eventId).once('value')).val();
    const remainingHours = eventIdVal.remainsHours;

    let myObj: { [key: string]: any } = {};
    const todayStart = utils.getTodayStart();
    // myObj.todayStart = todayStart;
    const endDateTime = utils.addHoursToDate(todayStart, remainingHours);
    // myObj.endDateTime = endDateTime;
    let secondsRemaining = Math.floor((endDateTime.getTime() - todayStart.getTime()) / 1000);
    // myObj.minutesRemaining = secondsRemaining/60;
    const secondsPassedToday = utils.getSecondsSinceStartOfDayPST();
    // myObj.minutesPassedToday = secondsPassedToday/60;
    secondsRemaining -= secondsPassedToday;
    // myObj.actual_timeRemainingInHours = (secondsRemaining/3600);
    // myObj.actual_timeRemainingInMinutes = (secondsRemaining/60);
    // myObj.actual_timeRemainingInSeconds = (secondsRemaining);
    myObj.timeRemainingInSeconds = (secondsRemaining);

    response.send(
      myObj
    );
  });

  export const GetCoinsForUser = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId);
    if (request.query.userId === undefined || userId === null) {
      response.send("Error: no userId");
      return;
    }
    
    const userDb = await admin.database().ref("Users/" + userId + "/vault").once('value');
    if (!userDb.exists()) 
    {
      response.send({
        "coins": 0
        });
      return;
    }

    const currentCoins = userDb.child("coins").val();
    response.send({
      "coins": currentCoins
      });
  });

  export const GetCashVaultDetails = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId || "");
  if (!userId) {
    response.status(400).json({ error: "Missing userId" });
    return;
  }

  try {
    const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
    if (!userSnap.exists()) {
      response.status(404).json({ error: "User not found" });
      return;
    }

    const vaultSnap = userSnap.child(vault.Vault_User_DB);
    const coins = Number(vaultSnap.child(vault.Coins_Vault_User_DB).val() || 0);
    const cash = Number(vaultSnap.child(vault.Cash_Vault_User_DB).val() || 0);
    const cashAmountReceived = Number(vaultSnap.child(vault.CashAmountReceived).val() || 0);
    const cashBalance = cash - cashAmountReceived;
    const zplnMinned = Number(vaultSnap.child(vault.ZplnMinned_Vault_User_DB).val() || 0);
    const isEchoMember = vaultSnap.child(vault.isEchoMember_Vault_User_DB).exists()
      ? Boolean(vaultSnap.child(vault.isEchoMember_Vault_User_DB).val())
      : false;

 // New token vaults (return 0 if absent)
    const bonk = Number(vaultSnap.child(vault.Bonk_Vault_User_DB).val() || 0);
    const zdlt = Number(vaultSnap.child(vault.Zdlt_Vault_User_DB).val() || 0);
    const digi = Number(vaultSnap.child(vault.Digi_Vault_User_DB).val() || 0);
    const pvs  = Number(vaultSnap.child(vault.Pvs_Vault_User_DB).val() || 0);

    const globalSnap = await admin.database().ref("/Parameters/GlobalMining").once("value");
    const globalMining = Number(globalSnap.exists() ? globalSnap.val() : 0);

    const walletInfo = await vault.getUserWalletInfo(userId);
    //const isWalletIDAvailable = !!(walletInfo.solanaPrimary || walletInfo.evmPrimary);

    response.status(200).json({
      [vault.Coins_Vault_User_DB]: coins,
      [vault.Cash_Vault_User_DB]: cash,
      [vault.CashAmountReceived]: cashAmountReceived,
      [vault.CashBalance]: cashBalance,
      [vault.ZplnMinned_Vault_User_DB]: zplnMinned,
      [vault.Bonk_Vault_User_DB]: bonk,
      [vault.Zdlt_Vault_User_DB]: zdlt,
      [vault.Digi_Vault_User_DB]: digi,
      [vault.Pvs_Vault_User_DB]: pvs,
      GlobalMining: globalMining,
      IsEchoMember: isEchoMember,
     // isWalletIDAvailable,
      solanaWalletId: walletInfo.solanaPrimary || null,
      evmWalletId: walletInfo.evmPrimary || null
    });
  } catch (err) {
    console.error("GetCashVaultDetails error:", err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});


export const GetBlockchainAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId || "");
  if (!userId) {
    response.status(400).json({ error: "Missing userId" });
    return;
  }

  try {
    const vaultSnap = await admin.database()
      .ref(`${tournament.Users_DB}/${userId}/${vault.Vault_User_DB}`)
      .once("value");

    if (!vaultSnap.exists()) {
      response.status(404).json({ error: "User vault not found" });
      return;
    }

    const bonk = Number(vaultSnap.child(vault.Bonk_Vault_User_DB).val() || 0);
    const zdlt = Number(vaultSnap.child(vault.Zdlt_Vault_User_DB).val() || 0);
    const digi = Number(vaultSnap.child(vault.Digi_Vault_User_DB).val() || 0);
    const pvs  = Number(vaultSnap.child(vault.Pvs_Vault_User_DB).val() || 0);
    const maka = Number(vaultSnap.child(vault.Maka_Vault_User_DB).val() || 0);
    const zplnMinned = Number(vaultSnap.child(vault.ZplnMinned_Vault_User_DB).val() || 0);
    const miningRate = Number(vaultSnap.child(vault.miningRate_Vault_User_DB).val() || 0);
    const isEchoMember = vaultSnap.child(vault.isEchoMember_Vault_User_DB).exists()
      ? Boolean(vaultSnap.child(vault.isEchoMember_Vault_User_DB).val())
      : false;

    const globalSnap = await admin.database().ref("/Parameters/GlobalMining").once("value");
    const globalMining = Number(globalSnap.exists() ? globalSnap.val() : 0);

    const walletInfo = await vault.getUserWalletInfo(userId);
    //const isWalletIDAvailable = !!(walletInfo.solanaPrimary || walletInfo.evmPrimary);
    const savedWalletId = walletInfo.solanaPrimary || walletInfo.evmPrimary || null;

    response.status(200).json({
      userId,
      bonk,
      zdlt,
      digi,
      pvs,
      maka,
      miningRate,
      [vault.ZplnMinned_Vault_User_DB]: zplnMinned,
      GlobalMining: globalMining,
      IsEchoMember: isEchoMember,
     // isWalletIDAvailable,
      savedWalletId,
      solanaWalletId: walletInfo.solanaPrimary || null,
      evmWalletId: walletInfo.evmPrimary || null,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("GetBlockchainAPI error:", err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});


  export const PaidToUser = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId);
    if (request.query.userId === undefined || userId === null) {
      response.send("Error: no userId");
      return;
    }

    const amountPaidBack = Number(request.query.amountPaidBack);
    if (request.query.amountPaidBack === undefined || amountPaidBack === null) {
      response.send("Error: no amountPaidBack");
      return;
    }
    
    const userDb = await admin.database().ref("Users/" + userId + "/vault").once('value');
    let vaultVal = userDb.val();

    if(userDb.child(vault.CashAmountReceived).val() === null)
      vaultVal.cashAmountReceived = 0;
    
    const cashBalance = vaultVal.cash - vaultVal.cashAmountReceived;
    if((cashBalance - amountPaidBack) < 0)
    {
      response.send(false);//Failed: Not enough balance
      return;
    }

    vaultVal.cashAmountReceived = vaultVal.cashAmountReceived + amountPaidBack;
    console.log("PaidToUser: " + JSON.stringify(vaultVal))
    await userDb.ref.update(vaultVal);

    response.send(true);
  });


  export const PayMe = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId);
    if (request.query.userId === undefined || userId === null) {
      response.send("Error: no userId");
      return;
    }

    const userDb = (await admin.database().ref("Users/" + userId).once('value')).val();

    let cashAmountReceived = userDb.vault.cashAmountReceived;
    cashAmountReceived = (cashAmountReceived === undefined) ? 0 : userDb.vault.cashAmountReceived;
    
    const time = new Date();
    let retObj = {
      "timestamp": String(time),
      "userId": userId,
      "userName": userDb.userName,
      "phone": userDb.phone,
      "total_cash_earned": userDb.vault.cash,
      "total_cash_received": cashAmountReceived,
      "balance_remaining": userDb.vault.cash - cashAmountReceived
    }

    const payMeRef = await admin.database().ref("PayMe");
    await payMeRef.push(retObj);
    console.log("PayMe Clicked: " + JSON.stringify(retObj));
    response.send(true);
  });

  export const ClearUserAveragesAndRankForAllUsers = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    try {
  
      const usersRef = await admin.database().ref(Users_DB);
      const snapshot = await usersRef.once('value');
      
      const updates: { [key: string]: any } = {};
      
      snapshot.forEach(userSnapshot => {
          const userId = userSnapshot.key;
          updates[`${userId}/level`] = -1;
          updates[`${userId}/levelName`] = "No Rank";
          updates[`${userId}/globalAverage`] = 0;
          updates[`${userId}/AverageWindow`] = [];
      });
      
      await usersRef.update(updates);
      
      response.status(200).send('Done');
  } catch (error) {
      console.error('ClearUserAveragesAndRankForAllUsers Failed:', error);
      response.status(500).send('Failed');
  }
  });


  //Get pro event List API
export const GetProBrandEventList = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    try {
        const list = await tournament.getProBrandEventList();
        response.status(200).json(list);
    } catch (err) {
        console.error("Error in GetProBrandEventList:", err);
        response.status(500).send("Internal Server Error");
    }
});

//GetEchoEventList

///GetCurrentGameStatusOfEventAPI

export const GetCurrentGameStatusOfEventAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId);
    const eventId = String(request.query.eventId);

    try {
        const result = await tournament.CurrentGameStatusOfEvent(userId, eventId);
        response.status(200).json(result);
    } catch (err) {
        console.error("Error in GetCurrentGameStatusOfEvent:", err);
        response.status(500).send("Internal Server Error");
    }
});
////GetCurrentGameStatusOfEventAPI____END


export const GetUserWinningHistory = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    const q = request.method === "GET" ? request.query : request.body;
    const userId = String(q.userId || q.uid || "");
    const days = q.days ? Math.max(1, Math.min(30, Number(q.days))) : 7;
    const limit = q.limit ? Math.max(1, Math.min(200, Number(q.limit))) : 100;

    if (!userId) {
      response.status(400).json({ error: "Missing userId" });
      return;
    }

    const now = Date.now();
    const since = now - days * 24 * 60 * 60 * 1000;

    const ref = admin.database().ref(`${tournament.Users_DB}/${userId}/WinningHistory`);
    const snap = await ref.orderByChild("timestamp").startAt(since).limitToLast(limit).once("value");

    const items: any[] = [];
    snap.forEach((child) => {
      const v = child.val() || {};
      const ts = Number(v.timestamp || 0);
      if (ts >= since && ts <= now) {
        items.push({
          id: child.key,
          eventId: v.eventId,
          eventName: v.eventName,
          eventType: v.eventType,
          rank: v.rank,
          prizeRaw: v.prizeRaw || null,
          prizeCredited: v.prizeCredited || null,
          miningRate: v.miningRate ?? null,
          timestamp: ts,
          iso: new Date(ts).toISOString()
        });
      }
      return false;
    });

    items.sort((a, b) => b.timestamp - a.timestamp);
    response.status(200).json({ userId, days, since, now, count: items.length, items });
  } catch (err) {
    console.error("GetUserWinningHistory error:", err);
    response.status(500).json({ error: String(err) });
  }
});


// ...existing imports top ensure vault enum exported...
// Replace previous VaultWithdrawalAPI implementation:
export const VaultWithdrawalAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    const q = request.method === "GET" ? request.query : request.body;
    const userId = String(q.userId || q.uid || "").trim();
    const tokenTypeId = Number(q.tokenTypeId); // enum id
    const amountToWithdraw = Number(q.amountToWithdraw || q.amount || 0);
    const tokenNetwork = vault.getWalletNetworkForTokenType(tokenTypeId);
    const legacyWalletIdFromReq = String(q.walletId || "").trim();
    let walletId = legacyWalletIdFromReq;
    const requestedNetwork = String(q.walletType || q.network || q.walletNetwork || "").trim().toLowerCase();
    const solanaWalletIdFromReq = String(q.solanaWalletId || (requestedNetwork === "solana" ? legacyWalletIdFromReq : "") || "").trim();
    const evmWalletIdFromReq = String(q.evmWalletId || (requestedNetwork === "evm" ? legacyWalletIdFromReq : "") || "").trim();

    if (!userId) { response.status(400).json({ error: "Missing userId" }); return; }
    if (!Number.isInteger(tokenTypeId)) { response.status(400).json({ error: "Missing or invalid tokenTypeId" }); return; }
    if (!Number.isFinite(amountToWithdraw) || amountToWithdraw <= 0) { response.status(400).json({ error: "Invalid amountToWithdraw" }); return; }
    if (!tokenNetwork) { response.status(400).json({ error: "Unsupported tokenTypeId" }); return; }

    // Validate token enum
    const tokenEntry = vault.listWithdrawalTokenTypes().find(t => t.id === tokenTypeId);
    if (!tokenEntry) { response.status(400).json({ error: "Unsupported tokenTypeId" }); return; }


      if (String(q.debug || "") === "1") {
      const info = await vault.getVaultBalance(userId, tokenTypeId);
      response.status(200).json({ debug: true, userId, tokenTypeId, token: info.name, key: info.key, path: info.path, balance: info.balance });
      return;
    }
 console.log("VaultWithdrawalAPI:req", {
      method: request.method,
      userId,
      tokenTypeId,
      amountToWithdraw,
   tokenNetwork,
   walletId,
   solanaWalletIdFromReq,
   evmWalletIdFromReq
    });

    // User data

    const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
    if (!userSnap.exists()) { response.status(404).json({ error: "User not found" }); return; }
    const userName = userSnap.child("userName").val() || userId;
    const globalAverage = Number(userSnap.child("globalAverage").val() || 0);
    const miningRate = Number(userSnap.child(`vault/${vault.miningRate_Vault_User_DB}`).val() || 0);

    // Persist explicit chain wallets (if provided)
    if (solanaWalletIdFromReq) {
      await vault.setWalletPrimaryForNetwork(userId, "solana", solanaWalletIdFromReq);
    }
    if (evmWalletIdFromReq) {
      await vault.setWalletPrimaryForNetwork(userId, "evm", evmWalletIdFromReq);
    }

    const walletInfo = await vault.getUserWalletInfo(userId);

    if (!walletId) {
      walletId = tokenNetwork === "evm"
        ? (evmWalletIdFromReq || walletInfo.evmPrimary || "")
        : (solanaWalletIdFromReq || walletInfo.solanaPrimary || "");
    }

    if (!walletId) {
      response.status(400).json({
        error: tokenNetwork === "evm"
          ? "EVM walletId required for maka withdrawals"
          : "Solana walletId required for this token withdrawal"
      });
      return;
    }

    if (tokenNetwork === "evm") {
      await vault.setWalletPrimaryForNetwork(userId, "evm", walletId);
    } else {
      await vault.setWalletPrimaryForNetwork(userId, "solana", walletId);
    }

    // Perform withdrawal (debit)
    const debitRes = await vault.WithdrawTokenFromVault(userId, tokenTypeId, amountToWithdraw);
    if (!debitRes.success) {
      response.status(400).json({ error: "Withdrawal failed", details: debitRes.error });
      return;
    }

    // Record history
    await vault.addWithdrawalHistory(userId, {
      token: debitRes.tokenName,
      amount: amountToWithdraw,
      walletId,
      walletNetwork: tokenNetwork,
      miningRate
    });

    // Last withdrawal date (after current)
    const lastWithdrawalTimestamp = await vault.getLastWithdrawalTimestamp(userId);

    // Winning history since last withdrawal (if any), else empty list
    let winningSinceTs = lastWithdrawalTimestamp ?? 0;
    if (!winningSinceTs) {
      // optional fallback: last 30 days if no prior withdrawal
      winningSinceTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    }

    const winRef = admin.database().ref(`${tournament.Users_DB}/${userId}/WinningHistory`);
    const winSnap = await winRef.orderByChild("timestamp").startAt(winningSinceTs).once("value");

    const winningHistory: any[] = [];
    winSnap.forEach(c => {
      const v = c.val() || {};
      winningHistory.push({
        id: c.key,
        eventId: v.eventId,
        eventName: v.eventName,
        eventType: v.eventType,
        rank: v.rank,
        prizeRaw: v.prizeRaw || v.prize || null,
        prizeCredited: v.prizeCredited || null,
        timestamp: v.timestamp || 0
      });
      return false;
    });
    winningHistory.sort((a, b) => b.timestamp - a.timestamp);

    // Email template
    const subject = `ZPLN | Withdrawal | ${userName} | ${debitRes.tokenName.toUpperCase()} ${amountToWithdraw}`;
    const readableDate = new Date().toUTCString();
    const winRows = winningHistory.slice(0, 40).map(w => {
      return `<tr><td>${w.eventName || w.eventId || ""}</td><td>${w.rank ?? ""}</td><td>${new Date(w.timestamp).toUTCString()}</td><td><code>${JSON.stringify(w.prizeCredited || w.prizeRaw || {})}</code></td></tr>`;
    }).join("");
    const html = `
      <div style="font-family:Arial;max-width:700px;margin:auto;">
        <h2 style="margin:0 0 8px;">Withdrawal Request</h2>
        <p style="margin:0 0 12px;color:#555;">${readableDate}</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td>User</td><td><strong>${userName}</strong></td></tr>
          <tr><td>UserId</td><td>${userId}</td></tr>
          <tr><td>GlobalAverage</td><td>${globalAverage}</td></tr>
          <tr><td>MiningRate</td><td>${miningRate}</td></tr>
          <tr><td>Wallet Network</td><td>${tokenNetwork.toUpperCase()}</td></tr>
          <tr><td>WalletId</td><td><strong>${walletId}</strong></td></tr>
          <tr><td>Token</td><td>${debitRes.tokenName.toUpperCase()}</td></tr>
          <tr><td>Amount Requested</td><td><strong>${amountToWithdraw}</strong></td></tr>
          <tr><td>Balance After</td><td>${debitRes.updated}</td></tr>
        </table>
        <hr style="margin:18px 0;border:none;border-top:1px solid #ddd;" />
        <h3 style="margin:8px 0;">Winning History Since Last Withdrawal</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #ccc;padding:4px;">Event</th>
              <th style="text-align:left;border-bottom:1px solid #ccc;padding:4px;">Rank</th>
              <th style="text-align:left;border-bottom:1px solid #ccc;padding:4px;">Date</th>
              <th style="text-align:left;border-bottom:1px solid #ccc;padding:4px;">Prize</th>
            </tr>
          </thead>
          <tbody>${winRows || `<tr><td colspan="4" style="padding:6px;color:#777;">No entries</td></tr>`}</tbody>
        </table>
      </div>
    `;
    await mailer.sendEmail("Ty@playzpln.com", subject, html);

    response.status(200).json({
      ok: true,
      userId,
      userName,
      tokenTypeId,
      token: debitRes.tokenName,
      tokenNetwork,
      amountRequested: amountToWithdraw,
      balanceAfter: debitRes.updated,
      walletId,
      lastWithdrawalTimestamp,
      winningHistoryCount: winningHistory.length,
     // isWalletIDAvailable: !!(walletInfo.solanaPrimary || walletInfo.evmPrimary),
      isSolanaWalletIDAvailable: !!walletInfo.solanaPrimary,
      isEvmWalletIDAvailable: !!walletInfo.evmPrimary,
      availableTokenTypes: vault.listWithdrawalTokenTypes()
    });
  } catch (err) {
    console.error("VaultWithdrawalAPI error:", err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

export const ListWithdrawalTokenTypes = functions.runWith({ memory: "512MB" }).https.onRequest(async (_req, res) => {
  res.status(200).json({ tokens: vault.listWithdrawalTokenTypes() });
});


export const GetUserRanksAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId || "");
  if (!userId) {
    response.status(400).json({ error: "Missing userId" });
    return;
  }

  try {
    // Fetch user node
    const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
    if (!userSnap.exists()) {
      response.status(404).json({ error: "User not found" });
      return;
    }

    // PlayRank from globalAverage
    const globalAverage = Number(userSnap.child("globalAverage").val() || 0);
    const playRankEnum = await vault.getPlayRankForUser(userId);
    const playRank = playRankEnum !== null ? vault.determinePlayRankNameFromAverage(globalAverage) : "Celestial";

    // MiningRank from vault
    const miningRankEnum = Number(userSnap.child(`${vault.Vault_User_DB}/${vault.MiningRank_Vault_User_DB}`).val() || 1);
    const miningRank = vault.getMiningRankDisplayName(miningRankEnum);

    response.status(200).json({
      Action: "GetUserRanks",
      UserId: userId,
      GlobalAverage: globalAverage,
      PlayRankEnum: playRankEnum ?? 1,
      PlayRank: playRank,
      MiningRankEnum: miningRankEnum,
      MiningRank: miningRank
    });
  } catch (err) {
    console.error("GetUserRanksAPI error:", err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});


// export const ListUsersWithWithdrawalHistory = functions.https.onRequest(async (request, response) => {
//   try {
//     const days = request.query.days ? Math.max(1, Math.min(90, Number(request.query.days))) : 30;
//     const limit = request.query.limit ? Math.max(1, Math.min(1000, Number(request.query.limit))) : 200;
//     const filterUserId = String(request.query.userId || "").trim();
//     const tz = "America/Los_Angeles";
//     const now = Date.now();
//     const since = now - days * 24 * 60 * 60 * 1000;

//     const dayKey = (ts: number) => {
//       const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
//       return fmt.format(new Date(ts)); // YYYY-MM-DD
//     };
//     const todayKey = dayKey(now);
//     const yesterdayKey = dayKey(now - 24 * 60 * 60 * 1000);
//     const labelFor = (key: string) => (key === todayKey ? "Today" : key === yesterdayKey ? "Yesterday" : key);

//     // Read all users (or one user if userId filter provided)
//     const usersRef = filterUserId
//       ? admin.database().ref(`${tournament.Users_DB}/${filterUserId}`)
//       : admin.database().ref(`${tournament.Users_DB}`);

//     const rootSnap = await usersRef.once("value");
//     if (!rootSnap.exists()) {
//       response.status(200).json({ count: 0, groups: [], totalUsers: 0, totalWithdrawals: 0 });
//       return;
//     }

//     type Entry = {
//       userId: string;
//       userName: string;
//       phone: string;
//       walletId: string;
//       token: string;
//       amount: number;
//       miningRate: number;
//       timestamp: number;
//       iso: string;
//     };

//     const entries: Entry[] = [];

//     const handleUserSnapshot = (userSnap: admin.database.DataSnapshot) => {
//       if (!userSnap.exists()) return;
//       const userId = String(userSnap.key);
//       const userName = String(userSnap.child("userName").val() || "");
//       const phone = String(userSnap.child("phone").val() || "");
//       const walletId = String(userSnap.child("wallets/primary").val() || "");

//       const histSnap = userSnap.child("WithdrawalHistory");
//       if (!histSnap.exists()) return;

//       histSnap.forEach((h) => {
//         const v = h.val() || {};
//         const ts = Number(v.timestamp || 0);
//         if (!Number.isFinite(ts) || ts < since) return false;

//         const token = String(v.token || "");
//         const amount = Number(v.amount || 0);
//         const miningRate = Number(v.miningRate || 0);

//         entries.push({
//           userId,
//           userName,
//           phone,
//           walletId,
//           token,
//           amount,
//           miningRate,
//           timestamp: ts,
//           iso: new Date(ts).toISOString()
//         });
//         return false;
//       });
//     };

//     if (filterUserId) {
//       handleUserSnapshot(rootSnap);
//     } else {
//       rootSnap.forEach((u) => {
//         handleUserSnapshot(u);
//         return false;
//       });
//     }

//     // Sort newest first and apply limit
//     entries.sort((a, b) => b.timestamp - a.timestamp);
//     const sliced = entries.slice(0, limit);

//     // Group by date key (LA time)
//     const groupsMap = new Map<string, Entry[]>();
//     for (const e of sliced) {
//       const k = dayKey(e.timestamp);
//       if (!groupsMap.has(k)) groupsMap.set(k, []);
//       groupsMap.get(k)!.push(e);
//     }

//     // Order groups: Today, Yesterday, then by date desc
//     const allKeys = Array.from(groupsMap.keys());
//     allKeys.sort((a, b) => (a === todayKey ? -1 : b === todayKey ? 1 : a === yesterdayKey ? -1 : b === yesterdayKey ? 1 : (a < b ? 1 : -1)));

//     const groups = allKeys.map((k) => ({
//       date: k,
//       dateLabel: labelFor(k),
//       count: groupsMap.get(k)!.length,
//       items: groupsMap.get(k)!
//     }));

//     response.status(200).json({
//       count: sliced.length,
//       days: days,
//       limit: limit,
//       totalUsers: filterUserId ? 1 : (rootSnap.numChildren?.() || 0),
//       totalWithdrawals: entries.length,
//       groups
//     });
//   } catch (err) {
//     console.error("ListUsersWithWithdrawalHistory error:", err);
//     response.status(500).json({ error: "Internal Server Error" });
//   }
// });




export const ListUsersWithWithdrawalHistory = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    const days = request.query.days ? Math.max(1, Math.min(90, Number(request.query.days))) : 30;
    const limit = request.query.limit ? Math.max(1, Math.min(1000, Number(request.query.limit))) : 200;
    const filterUserId = String(request.query.userId || "").trim();

    // Exclude specific userIds
    const excludeUserIds = new Set<string>(["EBzbzMlIelhedPd0CxcYxZwtwOP2"]);
    if (filterUserId && excludeUserIds.has(filterUserId)) {
      response.status(200).json({ count: 0, groups: [], totalUsers: 0, totalWithdrawals: 0 });
      return;
    }

    const tz = "America/Los_Angeles";
    const now = Date.now();
    const since = now - days * 24 * 60 * 60 * 1000;

    // Date key formatter (YYYY-MM-DD in LA time)
    const dayKey = (ts: number) => {
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
      return fmt.format(new Date(ts));
    };

    // Read all users or filtered user
    const usersRef = filterUserId
      ? admin.database().ref(`${tournament.Users_DB}/${filterUserId}`)
      : admin.database().ref(`${tournament.Users_DB}`);

    const rootSnap = await usersRef.once("value");
    if (!rootSnap.exists()) {
      response.status(200).json({ count: 0, groups: [], totalUsers: 0, totalWithdrawals: 0 });
      return;
    }

    type Entry = {
      userId: string;
      userName: string;
      phone: string;
      walletId: string;
      token: string;
      amount: number;
      miningRate: number;
      timestamp: number;
      iso: string;
    };

    const entries: Entry[] = [];

    const handleUserSnapshot = (userSnap: admin.database.DataSnapshot) => {
      if (!userSnap.exists()) return;

      const userId = String(userSnap.key);
      if (excludeUserIds.has(userId)) return;

      const userName = String(userSnap.child("userName").val() || "");
      const phone = String(userSnap.child("phone").val() || "");
      const walletId = String(
        userSnap.child("wallets/solana/primary").val() ||
        userSnap.child("wallets/evm/primary").val() ||
        ""
      );

      const histSnap = userSnap.child("WithdrawalHistory");
      if (!histSnap.exists()) return;

      histSnap.forEach((h) => {
        const v = h.val() || {};
        const ts = Number(v.timestamp || 0);
        if (!Number.isFinite(ts) || ts < since) return false;

        const token = String(v.token || "");
        const amount = Number(v.amount || 0);
        const miningRate = Number(v.miningRate || 0);

        entries.push({
          userId,
          userName,
          phone,
          walletId,
          token,
          amount,
          miningRate,
          timestamp: ts,
          iso: new Date(ts).toISOString()
        });
        return false;
      });
    };

    if (filterUserId) {
      handleUserSnapshot(rootSnap);
    } else {
      rootSnap.forEach((u) => {
        handleUserSnapshot(u);
        return false;
      });
    }

    // Sort newest first and apply limit
    entries.sort((a, b) => b.timestamp - a.timestamp);
    const sliced = entries.slice(0, limit);

    // Group by date (YYYY-MM-DD), most recent first
    const groupsMap = new Map<string, Entry[]>();
    for (const e of sliced) {
      const k = dayKey(e.timestamp);
      if (!groupsMap.has(k)) groupsMap.set(k, []);
      groupsMap.get(k)!.push(e);
    }

    const allKeys = Array.from(groupsMap.keys());
    allKeys.sort((a, b) => (a < b ? 1 : -1)); // descending by date string (YYYY-MM-DD)

    const groups = allKeys.map((k) => ({
      date: k,
      count: groupsMap.get(k)!.length,
      items: groupsMap.get(k)!
    }));

    response.status(200).json({
      count: sliced.length,
      days,
      limit,
      totalUsers: filterUserId ? (excludeUserIds.has(filterUserId) ? 0 : 1) : (rootSnap.numChildren?.() || 0),
      totalWithdrawals: entries.length,
      groups
    });
  } catch (err) {
    console.error("ListUsersWithWithdrawalHistory error:", err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});



export const GetUserVIPStatusAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId || "").trim();
  if (!userId) {
    response.status(400).json({ error: "Missing userId" });
    return;
  }

  try {
    const isVIP = await vault.getOrComputeIsVIP(userId);
    if (isVIP === null) {
      response.status(404).json({ error: "User not found" });
      return;
    }

    response.status(200).json({
      Action: "GetUserVIPStatus",
      UserId: userId,
      isVIP
    });
  } catch (err) {
    console.error("GetUserVIPStatusAPI error:", err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

export const GetTutorialStatus = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const userId = String(request.query.userId || "").trim();
    if (!userId) {
        response.status(400).json({ error: "Missing userId" });
        return;
    }

    try {
        const status = await userUtils.getTutorialStatus(userId);
        response.status(200).json({ userId, tutorial: status });
    } catch (err) {
        console.error("GetTutorialStatus error:", err);
        response.status(500).json({ error: "Internal Server Error" });
    }
});

export const UpdateTutorialStatus = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
    const q = request.method === "GET" ? request.query : request.body;
    const userId = String(q.userId || "").trim();
    const field = String(q.field || "").trim() as userUtils.TutorialFieldKey;
    const value = String(q.value || "").toLowerCase();

    if (!userId) {
        response.status(400).json({ error: "Missing userId" });
        return;
    }
    if (!field) {
        response.status(400).json({ error: "Missing field" });
        return;
    }
    if (value !== "true" && value !== "false") {
        response.status(400).json({ error: "Invalid value. Must be 'true' or 'false'" });
        return;
    }

    try {
        const updatedStatus = await userUtils.updateTutorialStatus(userId, field, value === "true");
        response.status(200).json({ userId, field, updated: value === "true", tutorial: updatedStatus });
    } catch (err: any) {
        if (err?.message?.startsWith("Invalid tutorial field")) {
            response.status(400).json({ error: err.message, validFields: Object.keys(userUtils.TutorialFields) });
            return;
        }
        console.error("UpdateTutorialStatus error:", err);
        response.status(500).json({ error: "Internal Server Error" });
    }
});
// Echo Pro Event APIs
export const GetEchoProInviteCode = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId);

  if (request.query.userId === undefined || userId === null || userId.length === 0) {
    response.status(404).json({ error: "Missing userId" });
    return;
  }

  // Check if user is Echo Pro
  const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
  if (!userSnap.exists() || userSnap.child(userUtils.FieldIsEchoPro).val() !== true) {
    response.status(404).json({ error: "User is not Echo Pro" });
    return;
  }

  await audience.createEchoProInviteCodeIfDoesntAlreadyExists(userId);

  const echoProCodeSnap = await admin.database()
    .ref(`${tournament.Users_DB}/${userId}/${userUtils.FieldEcho}/${userUtils.FieldEchoProInviteCode}`)
    .once("value");

  if (echoProCodeSnap.exists()) {
    const echoProInviteCode = getCodeFromInviteLink(echoProCodeSnap.val());
    response.status(200).send(echoProInviteCode);
  } else {
    response.status(404).json({ error: "Echo Pro invite code not found" });
  }
});

export const GetEchoProInviteLink = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId);

  if (request.query.userId === undefined || userId === null || userId.length === 0) {
    response.status(404).json({ error: "Missing userId" });
    return;
  }

  // Check if user is Echo Pro
  const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
  if (!userSnap.exists() || userSnap.child(userUtils.FieldIsEchoPro).val() !== true) {
    response.status(404).json({ error: "User is not Echo Pro" });
    return;
  }

  await audience.createEchoProInviteCodeIfDoesntAlreadyExists(userId);

  const echoProLinkSnap = await admin.database()
    .ref(`${tournament.Users_DB}/${userId}/${userUtils.FieldEcho}/${userUtils.FieldEchoProInviteLink}`)
    .once("value");

  if (echoProLinkSnap.exists()) {
    response.status(200).send(echoProLinkSnap.val());
  } else {
    response.status(404).json({ error: "Echo Pro invite link not found" });
  }
});

export const GetEchoProInviteCounter = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  const userId = String(request.query.userId);

  if (!userId) {
    response.status(400).json({ error: "Missing userId" });
    return;
  }

  try {
    const count = await audience.getEchoProInviteCounter(userId);
    response.status(200).json({ userId, echoProInvitesUsed: count, maxInvites: 20000, invitesRemaining: Math.max(0, 20000 - count) });
  } catch (err) {
    console.error("GetEchoProInviteCounter error:", err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});
export const GetEchoProReferrerInfo = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const code = String(request.query.code || "").trim();

      if (!code) {
        return response.status(400).json({ error: "Missing code" });
      }

      const referrer = await audience.getEchoProReferrerInfoFromCode(code);

      if (!referrer) {
        return response.status(404).json({ error: "Invalid or unknown invite code" });
      }

      return response.status(200).json({
        success: true,
        referrerUserId: referrer.userId,
        referrerName: referrer.name
      });

    } catch (err) {
      console.error("GetEchoProReferrerInfo error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

// ...existing code...

// function applyEchoCors(req: functions.https.Request, res: functions.Response<any>) {
//   const origin = String(req.headers.origin || "");
//   const allowed = new Set([
//     "https://zpln-3be94.web.app",
//     "https://zpln-3be94.firebaseapp.com",
//     "http://localhost:3000",
//     "http://localhost:5173",
//      "http://localhost:5173"
//   ]);

//   if (allowed.has(origin)) {
//     res.set("Access-Control-Allow-Origin", origin);
//   }
//   res.set("Vary", "Origin");
//   res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
//   res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
//   res.set("Access-Control-Max-Age", "3600");
// }

// ...existing code...

// ...existing code...

export const RegisterEchoProUserAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;

      const userId = String(q.userId || "").trim();
      const phone = String(q.phone || "").trim();
      const firstName = String(q.firstName || "").trim();
      const lastName = String(q.lastName || "").trim();
      const email = String(q.email || "").trim();
      const parentInviteCode = String(q.parentInviteCode || "").trim();
      const savedAvatarURL = String(q.savedAvatarURL || "").trim();
      const userName = `${firstName} ${lastName}`.trim();

      if (!userId) return response.status(400).json({ error: "Missing userId" });
      if (!phone) return response.status(400).json({ error: "Missing phone" });
      if (!firstName) return response.status(400).json({ error: "Missing firstName" });
      if (!lastName) return response.status(400).json({ error: "Missing lastName" });
      if (!email) return response.status(400).json({ error: "Missing email" });
      if (!parentInviteCode) return response.status(400).json({ error: "Missing parentInviteCode" });

      try {
        const authUser = await admin.auth().getUserByPhoneNumber(phone);
        if (authUser.uid && authUser.uid !== userId) {
          return response.status(409).json({
            error: "Phone already registered. Please login.",
            nextAction: "LOGIN"
          });
        }
      } catch {
        // not found - safe to proceed
      }

      const existingUserSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
      if (existingUserSnap.exists()) {
        return response.status(409).json({ error: "User already exists" });
      }

      const parentUid = await audience.getEchoProParentUidFromInviteCode(parentInviteCode);
      if (!parentUid) {
        return response.status(400).json({ error: "Invalid Echo Pro invite code" });
      }

      // Optional: enforce parent invite limit before creating user

      // if (parentUid !== audience.RootUserId) {
      //   const parentInviteCount = await audience.getEchoProInviteCounter(parentUid);
      //   if (parentInviteCount >= 20000) {
      //     return response.status(400).json({ error: "Referrer invite limit reached (20000)" });
      //   }
      // }

      await utils.CreateUserFromJson(userId, userName, phone, parentUid, savedAvatarURL || "");
      await utils.PlayerExtraConfigurationById(userId);

      // NEW: add 100 NeoZplnMining on successful Echo registration
const zplnRef = admin.database().ref(
  `${tournament.Users_DB}/${userId}/${vault.Vault_User_DB}/${vault.ZplnMinned_Vault_User_DB}`
);
await zplnRef.transaction((current) => (Number(current || 0) + 100));

// ...existing code...
await admin.database().ref(`${tournament.Users_DB}/${userId}`).update({
  firstName,
  lastName,
  email,
  parentUid,
  parentId: parentUid,
  parentInviteCode,
  [userUtils.FieldIsEchoPro]: true,
  [`${userUtils.FieldEcho}/${userUtils.FieldEchoParentInviteCounter}`]: 0
});

      // await admin.database().ref(`${tournament.Users_DB}/${userId}`).update({
      //   firstName,
      //   lastName,
      //   email,
      //   parentUid,
      //   parentId: parentUid,
      //   parentInviteCode,
      //   [userUtils.FieldIsEchoPro]: true,
      //   [`${userUtils.FieldEcho}/${userUtils.FieldEchoParentInviteCounter}`]: 0
      // });

      // Also provision the regular game invite code/link for Echo Pro users.
      await audience.createInviteCodeIfDoesntAlreadyExists(userId);
      await audience.createEchoProInviteCodeIfDoesntAlreadyExists(userId, firstName, lastName);

      if (parentUid !== audience.RootUserId) {
        await audience.incrementEchoProInviteCounter(parentUid);
      }

      const userInviteSnap = await admin.database()
        .ref(`${tournament.Users_DB}/${userId}`)
        .once("value");

      const gameInviteCode = String(userInviteSnap.child(audience.FieldInviteCode).val() || "");
      const gameInviteLink = String(userInviteSnap.child(audience.FieldInviteLink).val() || "");

      const echoNodeSnap = await admin.database()
        .ref(`${tournament.Users_DB}/${userId}/${userUtils.FieldEcho}`)
        .once("value");

      const echoInviteCode = String(echoNodeSnap.child(userUtils.FieldEchoProInviteCode).val() || "");
      const echoInviteLink = String(echoNodeSnap.child(userUtils.FieldEchoProInviteLink).val() || "");

      await admin.database().ref(`EchoUsers/${userId}`).set({
        userId,
        userName,
        firstName,
        lastName,
        phone,
        email,
        parentUid,
        parentInviteCode,
        isEchoPro: true,
        inviteCode: gameInviteCode,
        inviteLink: gameInviteLink,
        Echo: {
          echoProInviteCode: echoInviteCode,
          echoProInviteLink: echoInviteLink,
          echoParentInviteCounter: 0
        },
        createdAt: Date.now()
      });

      const echoUserSnap = await admin.database().ref(`EchoUsers/${userId}`).once("value");

      // Keep parent -> child mapping in Users.
      await audience.addChildToParentChildrenIds(parentUid, userId, tournament.Users_DB);
      await audience.addUserToSpillTree(parentUid, userId);

      // Keep parent -> child mapping in EchoUsers (best effort).
      try {
        const parentEchoSnap = await admin.database().ref(`EchoUsers/${parentUid}`).once("value");
        if (parentEchoSnap.exists()) {
          await audience.addChildToParentChildrenIds(parentUid, userId, "EchoUsers");
        }
      } catch (e) {
        console.warn("RegisterEchoProUserAPI: EchoUsers parent link skipped", e);
      }

      return response.status(200).json({
        success: true,
        userId,
        data: echoUserSnap.exists() ? echoUserSnap.val() : null
      });

    } catch (err) {
      console.error("RegisterEchoProUserAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

// ...existing code...

// ...existing code...cd functions

//     // ensure BOTH invite systems exist:
//     // 1) Game inviteCode/inviteLink (existing)
//     await audience.createInviteCodeIfDoesntAlreadyExists(userId);

//     // 2) Echo Pro inviteCode/inviteLink (new)
//     await audience.createEchoProInviteCodeIfDoesntAlreadyExists(userId);

//     // increment referrer's Echo Pro invite count
//     await audience.incrementEchoProInviteCounter(parentUid);

//     // return links/codes
//     const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");

//     const gameInviteCode = String(userSnap.child(audience.FieldInviteCode).val() || "");
//     const gameInviteLink = String(userSnap.child(audience.FieldInviteLink).val() || "");

//     const echoInviteCode = String(
//       userSnap.child(`${userUtils.FieldEcho}/${userUtils.FieldEchoProInviteCode}`).val() || ""
//     );
//     const echoInviteLink = String(
//       userSnap.child(`${userUtils.FieldEcho}/${userUtils.FieldEchoProInviteLink}`).val() || ""
//     );

//     response.status(200).json({
//       success: true,
//       userId,
//       isEchoPro: true,
//       parentUid,
//       gameInviteCode,
//       gameInviteLink,
//       echoProInviteCode: echoInviteCode,
//       echoProInviteLink: echoInviteLink
//     });
//   } catch (err) {
//     console.error("RegisterEchoProUserAPI error:", err);
//     response.status(500).json({ error: "Internal Server Error" });
//   }
// });


export const ValidateEchoProPhoneForRegistration = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    const q: any = request.method === "GET" ? request.query : request.body;
    const phone = String(q.phone || "").trim();

    if (!phone) {
      response.status(400).json({ error: "Missing phone" });
      return;
    }

    let existingUid = "";
    let existsInAuth = false;

    try {
      const authUser = await admin.auth().getUserByPhoneNumber(phone);
      existingUid = authUser.uid;
      existsInAuth = true;
    } catch {
      existsInAuth = false;
    }

    if (!existsInAuth) {
      response.status(200).json({
        exists: false,
        nextAction: "REGISTER"
      });
      return;
    }

    const userSnap = await admin.database().ref(`${tournament.Users_DB}/${existingUid}`).once("value");
    const existsInDb = userSnap.exists();
    const isEchoPro = existsInDb ? userSnap.child(userUtils.FieldIsEchoPro).val() === true : false;

    response.status(200).json({
      exists: existsInAuth || existsInDb,
      existsInAuth,
      existsInDb,
      isEchoPro,
      userId: existingUid,
      nextAction: "LOGIN",
      message: "Phone already exists. Please login instead of registering."
    });
  } catch (err) {
    console.error("ValidateEchoProPhoneForRegistration error:", err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

// Echo Timer APIs

const ECHO_TIMER_DB_PATH = "Parameters/EchoTimer";
const ECHO_TIMER_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

async function getOrCreateEchoTimerStartAtMs(): Promise<number> {
  const ref = admin.database().ref(`${ECHO_TIMER_DB_PATH}/startAt`);

  // Atomic init: only first caller sets startAt
  const tx = await ref.transaction((current) => {
    if (current === null || current === undefined || Number(current) <= 0) {
      return Date.now();
    }
    return current;
  });

  return Number(tx.snapshot.val() || Date.now());
}

function getCountdownParts(remainingMs: number) {
  const totalMinutes = Math.floor(remainingMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

export const GetEchoWebTimer23 = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    const startAt = await getOrCreateEchoTimerStartAtMs();
    const now = Date.now();
    const endAt = startAt + ECHO_TIMER_DURATION_MS;

    const remainingMs = Math.max(0, endAt - now);
    const isTimerComplete = remainingMs <= 0;
    const pending = getCountdownParts(remainingMs);

    response.status(200).json({
      success: true,
      isTimerComplete,
      pendingTime: pending, // {days, hours, minutes}
      startAt,
      endAt,
      serverNow: now
    });
  } catch (err) {
    console.error("GetEchoWebTimer error:", err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

export const GetEchoWebTimer = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const startAt = await getOrCreateEchoTimerStartAtMs();
      const now = Date.now();
      const endAt = startAt + ECHO_TIMER_DURATION_MS;

      const remainingMs = Math.max(0, endAt - now);
      const isTimerComplete = remainingMs <= 0;
      const pending = getCountdownParts(remainingMs);

      return response.status(200).json({
        success: true,
        isTimerComplete,
        pendingTime: pending,
        startAt,
        endAt,
        serverNow: now
      });
    } catch (err) {
      console.error("GetEchoWebTimer error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const LoginEchoProUserAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;

      const phone = String(q.phone || "").trim();
      const idToken = String(q.idToken || "").trim();

      if (!phone) {
        return response.status(400).json({ error: "Missing phone" });
      }
      if (!idToken) {
        return response.status(400).json({ error: "Missing idToken" });
      }

      // 1) Verify Firebase Auth token
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      // 2) Validate phone belongs to same authenticated user
      const authUser = await admin.auth().getUser(uid);
      const authPhone = String(authUser.phoneNumber || "").trim();

      if (!authPhone || authPhone !== phone) {
        return response.status(401).json({ error: "Phone/token mismatch" });
      }

      // 3) Read Echo user profile
      const echoSnap = await admin.database().ref(`EchoUsers/${uid}`).once("value");

      if (!echoSnap.exists()) {
        return response.status(404).json({
          error: "Echo user not found. Please register first."
        });
      }

      const echoUser = echoSnap.val() || {};

      // 4) Update last login timestamps
      await admin.database().ref().update({
        [`EchoUsers/${uid}/lastLoginAt`]: Date.now(),
        [`${tournament.Users_DB}/${uid}/lastLoginAt`]: Date.now()
      });

      return response.status(200).json({
        success: true,
        userId: uid,
        phone: authPhone,
        data: echoUser
      });

    } catch (err) {
      console.error("LoginEchoProUserAPI error:", err);
      return response.status(401).json({ error: "Invalid or expired token" });
    }
  });
});


export const GetCountryCodesAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const snap = await admin.database().ref("Parameters/CountryCodes").once("value");

      if (!snap.exists()) {
        return response.status(404).json({ error: "CountryCodes not found" });
      }

      const list: { dial_code: string; name: string }[] = [];

      snap.forEach((child) => {
        const dial_code = String(child.child("dial_code").val() || "");
        const name = String(child.child("name").val() || "");
        if (dial_code && name) {
          list.push({ dial_code, name });
        }
        return false;
      });

      return response.status(200).json({
        success: true,
        count: list.length,
        data: list
      });

    } catch (err) {
      console.error("GetCountryCodes error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});


// ...existing code...

export const DeleteAllUsersExceptEchoProAPI = functions.runWith({
  timeoutSeconds: 540,
  memory: "2GB"
}).https.onRequest(async (request, response) => {
  try {
    const pwd = String(request.body.pwd || request.query.pwd || "");

    if (STAGING) {
      if (!(pwd === "Ediiie911")) { response.status(401).send(`Unauthorized`); return; }
    } else {
      if (!(pwd === "MasterEdiiie911")) { response.status(401).send(`Unauthorized`); return; }
    }

    console.log("DeleteAllUsersExceptEchoPro: Starting...");

    // Step 1: Get all Echo Pro user IDs to preserve
    const echoUsersSnap = await admin.database().ref("EchoUsers").once("value");
    const echoUserIds = new Set<string>();
    if (echoUsersSnap.exists()) {
      echoUsersSnap.forEach((child) => { echoUserIds.add(String(child.key)); return false; });
    }
    console.log(`Found ${echoUserIds.size} Echo Pro users to preserve`);

    // Step 2: Get all users
    const usersSnap = await admin.database().ref(`${tournament.Users_DB}`).once("value");
    if (!usersSnap.exists()) {
      response.status(200).json({ success: true, message: "No users to delete", deletedCount: 0 });
      return;
    }

    const allUserIds: string[] = [];
    usersSnap.forEach((child) => { allUserIds.push(String(child.key)); return false; });

    const usersToDelete = allUserIds.filter(uid => !echoUserIds.has(uid));
    console.log(`Total: ${allUserIds.length}, Preserving: ${echoUserIds.size}, Deleting: ${usersToDelete.length}`);

    // Step 3: Delete in batches of 10 to avoid TOO_MANY_TRIGGERS
    const BATCH_SIZE = 10;
    let deletedCount = 0;
    let authDeletedCount = 0;

    for (let i = 0; i < usersToDelete.length; i += BATCH_SIZE) {
      const batch = usersToDelete.slice(i, i + BATCH_SIZE);

      // DB batch delete
      const deleteUpdates: { [key: string]: any } = {};
      for (const uid of batch) {
        deleteUpdates[`${tournament.Users_DB}/${uid}`] = null;
      }
      await admin.database().ref().update(deleteUpdates);
      deletedCount += batch.length;

      // Auth delete (one by one, errors are non-fatal)
      for (const uid of batch) {
        try {
          await admin.auth().deleteUser(uid);
          authDeletedCount++;
        } catch (err) {
          console.warn(`Auth delete skipped for ${uid}:`, err);
        }
      }

      // Small delay between batches to avoid trigger overload
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} done — deleted ${deletedCount}/${usersToDelete.length}`);
    }

    console.log("DeleteAllUsersExceptEchoPro: Completed");

    response.status(200).json({
      success: true,
      message: "Deletion complete",
      totalUsers: allUserIds.length,
      preservedEchoProCount: echoUserIds.size,
      deletedCount,
      authDeletedCount,
      deletedUserIds: usersToDelete.slice(0, 20) // first 20 for reference
    });

  } catch (err) {
    console.error("DeleteAllUsersExceptEchoPro error:", err);
    response.status(500).json({ error: "Internal Server Error", details: String(err) });
  }
});


export const WalletElliglebleAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userId = String(q.userId || q.uid || "").trim();

      if (!userId) {
        return response.status(400).json({ error: "Missing userId" });
      }

      const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
      if (!userSnap.exists()) {
        return response.status(404).json({
          success: false,
          isElliglebleForWallet: false,
          message: "User not found"
        });
      }

      const userName = String(userSnap.child("userName").val() || "").trim();
      const firstName = String(userSnap.child("firstName").val() || "").trim();
      const lastName = String(userSnap.child("lastName").val() || "").trim();
      const email = String(userSnap.child("email").val() || "").trim();
      const phone = String(userSnap.child("phone").val() || "").trim();
      const parentId = String(userSnap.child("parentId").val() || "").trim();
      const parentUid = String(userSnap.child("parentUid").val() || "").trim();
      const walletInfo = await vault.getUserWalletInfo(userId);

      const hasSolanaWallet = Boolean(walletInfo.solanaPrimary);
      const hasEvmWallet = Boolean(walletInfo.evmPrimary);

      // Hard required fields -> without these, not eligible
      const hardMissing: string[] = [];
      if (!userName) hardMissing.push("userName");
      if (!phone) hardMissing.push("phone");
      if (!parentId) hardMissing.push("parentId");
      if (!parentUid) hardMissing.push("parentUid");

      if (hardMissing.length > 0) {
        return response.status(200).json({
          success: true,
          isElliglebleForWallet: false,
          isEligibleForWallet: false,
          missingRequiredFields: hardMissing,
          wallet: {
            solanaWalletId: walletInfo.solanaPrimary || null,
            evmWalletId: walletInfo.evmPrimary || null,
            hasSolanaWallet,
            hasEvmWallet
          },
          message: `Missing required fields: ${hardMissing.join(", ")}`
        });
      }

      // Soft required fields -> eligible, but must complete profile
      const profileMissing: string[] = [];
      if (!firstName) profileMissing.push("firstName");
      if (!lastName) profileMissing.push("lastName");
      if (!email) profileMissing.push("email");

      return response.status(200).json({
        success: true,
        isElliglebleForWallet: true,
        isEligibleForWallet: true,
        needsProfileUpdate: profileMissing.length > 0,
        missingProfileFields: profileMissing,
        wallet: {
          solanaWalletId: walletInfo.solanaPrimary || null,
          evmWalletId: walletInfo.evmPrimary || null,
          hasSolanaWallet,
          hasEvmWallet,
          isEligibleForMakaWithdrawal: hasEvmWallet,
          isEligibleForSolanaTokenWithdrawal: hasSolanaWallet
        },
        tokenRules: {
          maka: { network: "evm", walletRequired: true },
          bonk: { network: "solana", walletRequired: true },
          zdlt: { network: "solana", walletRequired: true },
          digi: { network: "solana", walletRequired: true },
          pvs: { network: "solana", walletRequired: true }
        },
        message: profileMissing.length > 0
          ? `Please update: ${profileMissing.join(", ")}`
          : "Eligible for wallet"
      });
    } catch (err) {
      console.error("WalletElliglebleAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const WalletUserDataAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;

      const userId = String(q.userId || q.uid || "").trim();
      const firstName = String(q.firstName || "").trim();
      const lastName = String(q.lastName || "").trim();
      const email = String(q.email || "").trim();

      if (!userId) return response.status(400).json({ error: "Missing userId" });
      if (!firstName) return response.status(400).json({ error: "Missing firstName" });
      if (!lastName) return response.status(400).json({ error: "Missing lastName" });
      if (!email) return response.status(400).json({ error: "Missing email" });

      const userRef = admin.database().ref(`${tournament.Users_DB}/${userId}`);
      const userSnap = await userRef.once("value");
      if (!userSnap.exists()) {
        return response.status(404).json({ error: "User not found" });
      }

      await userRef.update({
        firstName,
        lastName,
        email,
        userName: String(userSnap.child("userName").val() || `${firstName} ${lastName}`).trim()
      });

      // keep EchoUsers mirror synced if exists
      const echoRef = admin.database().ref(`EchoUsers/${userId}`);
      const echoSnap = await echoRef.once("value");
      if (echoSnap.exists()) {
        await echoRef.update({
          firstName,
          lastName,
          email,
          userName: String(echoSnap.child("userName").val() || `${firstName} ${lastName}`).trim()
        });
      }

      return response.status(200).json({
        success: true,
        userId,
        message: "Wallet user data updated"
      });
    } catch (err) {
      console.error("WalletUserDataAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const UpdateSavedWalletAddressAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userId = String(q.userId || q.uid || "").trim();
      const newWalletId = String(q.newWalletId || q.walletId || "").trim();
      const walletTypeRaw = String(q.walletType || q.network || "solana").trim().toLowerCase();
      const walletType = walletTypeRaw === "evm" ? "evm" : "solana";

      if (!userId) return response.status(400).json({ error: "Missing userId" });
      if (!newWalletId) return response.status(400).json({ error: "Missing newWalletId" });

      const userRef = admin.database().ref(`${tournament.Users_DB}/${userId}`);
      const userSnap = await userRef.once("value");
      if (!userSnap.exists()) {
        return response.status(404).json({ error: "User not found" });
      }

      await vault.setWalletPrimaryForNetwork(userId, walletType, newWalletId);

      const walletInfo = await vault.getUserWalletInfo(userId);

      return response.status(200).json({
        success: true,
        userId,
        wallet: true,
        walletType,
        savedWalletId: newWalletId,
        solanaWalletId: walletInfo.solanaPrimary || null,
        evmWalletId: walletInfo.evmPrimary || null
      });
    } catch (err) {
      console.error("UpdateSavedWalletAddressAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const CleanupLegacyPrimaryWalletAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userId = String(q.userId || q.uid || "").trim();

      if (!userId) return response.status(400).json({ error: "Missing userId" });

      const userRef = admin.database().ref(`${tournament.Users_DB}/${userId}`);
      const userSnap = await userRef.once("value");
      if (!userSnap.exists()) {
        return response.status(404).json({ error: "User not found" });
      }

      const result = await vault.migrateLegacyPrimaryWalletForUser(userId);
      const walletInfo = await vault.getUserWalletInfo(userId);

      return response.status(200).json({
        success: true,
        userId,
        hadLegacyPrimary: result.hadLegacyPrimary,
        removedLegacyPrimary: result.removedLegacyPrimary,
        migratedToSolana: result.migratedToSolana,
        migratedToEvm: result.migratedToEvm,
        ignoredLegacyPrimary: result.ignoredLegacyPrimary,
        legacyPrimary: result.legacyPrimary,
        solanaWalletId: walletInfo.solanaPrimary || null,
        evmWalletId: walletInfo.evmPrimary || null
      });
    } catch (err) {
      console.error("CleanupLegacyPrimaryWalletAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const BackfillChildrenIdsAPI = functions.runWith({
  timeoutSeconds: 540,
  memory: "1GB"
}).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const pwd = String(request.body?.pwd || request.query?.pwd || "");

      if (STAGING) {
        if (pwd !== "Ediiie911") return response.status(401).json({ error: "Unauthorized" });
      } else {
        if (pwd !== "MasterEdiiie911") return response.status(401).json({ error: "Unauthorized" });
      }

      const usersResult = await audience.backfillChildrenIdsForRoot(tournament.Users_DB);
      const echoUsersResult = await audience.backfillChildrenIdsForRoot("EchoUsers");

      return response.status(200).json({
        success: true,
        users: usersResult,
        echoUsers: echoUsersResult
      });
    } catch (err) {
      console.error("BackfillChildrenIdsAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});


export const BuildSpillTreeAPI = functions.runWith({
  timeoutSeconds: 540,
  memory: "2GB"
}).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const pwd = String(request.body?.pwd || request.query?.pwd || "");

      if (STAGING) {
        if (pwd !== "Ediiie911") return response.status(401).json({ error: "Unauthorized" });
      } else {
        if (pwd !== "MasterEdiiie911") return response.status(401).json({ error: "Unauthorized" });
      }

      // Optional: clear existing SpillTree before rebuilding (pass clearFirst=true).
      const clearFirst = String(request.body?.clearFirst || request.query?.clearFirst || "").toLowerCase() === "true";
      if (clearFirst) {
        await admin.database().ref("SpillTree").remove();
        console.log("BuildSpillTreeAPI: SpillTree cleared");
      }

      const result = await audience.backfillSpillTree(tournament.Users_DB);

      return response.status(200).json({
        success: true,
        clearFirst,
        ...result
      });
    } catch (err) {
      console.error("BuildSpillTreeAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

type SpillTreeSortableChild = {
  userId: string;
  userName: string;
  firstName: string;
  lastName: string;
  name: string;
  SavedAvatarURL: string;
  profilePicture: string;
  miningRankEnum: number;
  miningRank: string;
  existsInUsersDb: boolean;
  level?: number;
};

function getNextRankProgressCountForSort(
  miningRankEnum: number,
  counts: {
    DefaultCount: number;
    VIPCount: number;
    AgentCount: number;
    ExpertCount: number;
    SpecialistCount: number;
    PhantomCount: number;
    Level6Count: number;
    Level7Count: number;
    Level8Count: number;
  } | null
): number {
  if (!counts) return 0;

  switch (miningRankEnum) {
    case 1: return Number(counts.DefaultCount || 0);     // Player -> Agent
    case 2: return Number(counts.VIPCount || 0);         // Agent -> Builder
    case 3: return Number(counts.AgentCount || 0);       // Builder -> Specialist
    case 4: return Number(counts.ExpertCount || 0);      // Specialist -> Architect
    case 5: return Number(counts.SpecialistCount || 0);  // Architect -> Phantom1
    case 6: return Number(counts.PhantomCount || 0);     // Phantom1 -> Phantom2
    case 7: return Number(counts.Level6Count || 0);      // Phantom2 -> Phantom3
    case 8: return Number(counts.Level7Count || 0);      // Phantom3 -> Phantom4
    case 9: return Number(counts.Level8Count || 0);      // Phantom4 (max)
    default: return 0;
  }
}

function getUserJoinTimestampForSort(userSnap: admin.database.DataSnapshot): number {
  return Number(
    userSnap.child("joinTimestamp").val() ||
    userSnap.child("createdAt").val() ||
    userSnap.child("timestamp").val() ||
    0
  );
}

async function buildAndSortSpillTreeChildren(
  childIds: string[],
  levelMap?: Record<string, number>
): Promise<SpillTreeSortableChild[]> {
  if (childIds.length === 0) return [];

  const [userSnaps, progressCounts] = await Promise.all([
    Promise.all(childIds.map((id) => admin.database().ref(`${tournament.Users_DB}/${id}`).once("value"))),
    Promise.all(
      childIds.map((id) =>
        vault.countSector1ChildrenByMiningRank(id).catch(() => null)
      )
    )
  ]);

  const rows = childIds.map((childId, idx) => {
    const snap = userSnaps[idx];
    const counts = progressCounts[idx];

    if (!snap.exists()) {
      return {
        child: {
          userId: childId,
          level: levelMap ? (levelMap[childId] || 0) : undefined,
          userName: "",
          firstName: "",
          lastName: "",
          name: "",
          SavedAvatarURL: "",
          profilePicture: "",
          miningRankEnum: 1,
          miningRank: "Default",
          existsInUsersDb: false
        } as SpillTreeSortableChild,
        rankSort: 1,
        progressSort: 0,
        playerSort: 0,
        timestampSort: 0
      };
    }

    const firstName = String(snap.child("firstName").val() || "").trim();
    const lastName = String(snap.child("lastName").val() || "").trim();
    const userName = String(snap.child("userName").val() || "").trim();
    const savedAvatarURL = String(snap.child("SavedAvatarURL").val() || "").trim();
    const miningRankEnum = Number(
      snap.child(`${vault.Vault_User_DB}/${vault.MiningRank_Vault_User_DB}`).val() || 1
    );

    return {
      child: {
        userId: childId,
        level: levelMap ? (levelMap[childId] || 0) : undefined,
        userName,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim() || userName,
        SavedAvatarURL: savedAvatarURL,
        profilePicture: savedAvatarURL,
        miningRankEnum,
        miningRank: vault.getMiningRankDisplayName(miningRankEnum),
        existsInUsersDb: true
      } as SpillTreeSortableChild,
      rankSort: miningRankEnum,
      progressSort: getNextRankProgressCountForSort(miningRankEnum, counts),
      playerSort: Number(counts?.DefaultCount || 0),
      timestampSort: getUserJoinTimestampForSort(snap)
    };
  });

  rows.sort((a, b) => {
    if (b.rankSort !== a.rankSort) return b.rankSort - a.rankSort;
    if (b.progressSort !== a.progressSort) return b.progressSort - a.progressSort;
    if (b.playerSort !== a.playerSort) return b.playerSort - a.playerSort;
    return b.timestampSort - a.timestampSort;
  });

  return rows.map((r) => r.child);
}

export const GetSpillTreeLevel1API = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userId = String(q.userId || q.uid || "").trim();

      if (!userId) {
        return response.status(400).json({ error: "Missing userId" });
      }

      const parentSpillSnap = await admin.database().ref(`SpillTree/${userId}`).once("value");
      const rootUserSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
      const rootUserName = String(rootUserSnap.child("userName").val() || "").trim();
      const rootFirstName = String(rootUserSnap.child("firstName").val() || "").trim();
      const rootLastName = String(rootUserSnap.child("lastName").val() || "").trim();
      const rootSavedAvatarURL = String(rootUserSnap.child("SavedAvatarURL").val() || "").trim();
      const rootMiningRankEnum = Number(
        rootUserSnap.child(`${vault.Vault_User_DB}/${vault.MiningRank_Vault_User_DB}`).val() || 1
      );
      const rootMiningRank = vault.getMiningRankDisplayName(rootMiningRankEnum);
      if (!parentSpillSnap.exists()) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          totalChildren: 0,
          childrenIds: [],
          children: []
        });
      }

      const childrenSnap = await admin.database().ref(`SpillTree/${userId}/childrenIds`).once("value");
      if (!childrenSnap.exists()) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          totalChildren: 0,
          childrenIds: [],
          children: []
        });
      }

      const childrenRaw = childrenSnap.val() || {};
      const childIds = Object.keys(childrenRaw)
        .map((id) => String(id || "").trim())
        .filter((id) => !!id)
        .slice(0, audience.SpillTreeMaxDirectChildren);

      if (childIds.length === 0) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          totalChildren: 0,
          childrenIds: [],
          children: []
        });
      }

      const children = await buildAndSortSpillTreeChildren(childIds);
      const sortedChildIds = children.map((c) => c.userId);

      return response.status(200).json({
        success: true,
        userId,
        userName: rootUserName,
        firstName: rootFirstName,
        lastName: rootLastName,
        name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
        SavedAvatarURL: rootSavedAvatarURL,
        profilePicture: rootSavedAvatarURL,
        miningRankEnum: rootMiningRankEnum,
        miningRank: rootMiningRank,
        totalChildren: sortedChildIds.length,
        childrenIds: sortedChildIds,
        children
      });
    } catch (err) {
      console.error("GetSpillTreeLevel1API error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const GetSpillTreeLevel2API = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userId = String(q.userId || q.uid || "").trim();

      if (!userId) {
        return response.status(400).json({ error: "Missing userId" });
      }

      const parentSpillSnap = await admin.database().ref(`SpillTree/${userId}`).once("value");
      const rootUserSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
      const rootUserName = String(rootUserSnap.child("userName").val() || "").trim();
      const rootFirstName = String(rootUserSnap.child("firstName").val() || "").trim();
      const rootLastName = String(rootUserSnap.child("lastName").val() || "").trim();
      const rootSavedAvatarURL = String(rootUserSnap.child("SavedAvatarURL").val() || "").trim();
      const rootMiningRankEnum = Number(
        rootUserSnap.child(`${vault.Vault_User_DB}/${vault.MiningRank_Vault_User_DB}`).val() || 1
      );
      const rootMiningRank = vault.getMiningRankDisplayName(rootMiningRankEnum);
      if (!parentSpillSnap.exists()) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          level1Count: 0,
          level1ChildrenIds: [],
          totalLevel2Children: 0,
          level2ChildrenIds: [],
          children: []
        });
      }

      const level1Snap = await admin.database().ref(`SpillTree/${userId}/childrenIds`).once("value");
      if (!level1Snap.exists()) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          level1Count: 0,
          level1ChildrenIds: [],
          totalLevel2Children: 0,
          level2ChildrenIds: [],
          children: []
        });
      }

      const level1ChildrenIds = Object.keys(level1Snap.val() || {})
        .map((id) => String(id || "").trim())
        .filter((id) => !!id)
        .slice(0, audience.SpillTreeMaxDirectChildren);

      if (level1ChildrenIds.length === 0) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          level1Count: 0,
          level1ChildrenIds: [],
          totalLevel2Children: 0,
          level2ChildrenIds: [],
          children: []
        });
      }

      const level1ChildrenSnaps = await Promise.all(
        level1ChildrenIds.map((id) => admin.database().ref(`SpillTree/${id}/childrenIds`).once("value"))
      );

      const level2Set = new Set<string>();
      for (const snap of level1ChildrenSnaps) {
        if (!snap.exists()) continue;
        const raw = snap.val() || {};
        for (const key of Object.keys(raw)) {
          const id = String(key || "").trim();
          if (id) level2Set.add(id);
        }
      }

      const maxLevel2 = audience.SpillTreeMaxDirectChildren * audience.SpillTreeMaxDirectChildren;
      const level2ChildrenIds = Array.from(level2Set).slice(0, maxLevel2);

      if (level2ChildrenIds.length === 0) {
        return response.status(200).json({
          success: true,
          userId,
          level1Count: level1ChildrenIds.length,
          level1ChildrenIds,
          totalLevel2Children: 0,
          level2ChildrenIds: [],
          children: []
        });
      }

      const children = await buildAndSortSpillTreeChildren(level2ChildrenIds);
      const sortedLevel2ChildrenIds = children.map((c) => c.userId);

      return response.status(200).json({
        success: true,
        userId,
        userName: rootUserName,
        firstName: rootFirstName,
        lastName: rootLastName,
        name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
        SavedAvatarURL: rootSavedAvatarURL,
        profilePicture: rootSavedAvatarURL,
        miningRankEnum: rootMiningRankEnum,
        miningRank: rootMiningRank,
        level1Count: level1ChildrenIds.length,
        level1ChildrenIds,
        totalLevel2Children: sortedLevel2ChildrenIds.length,
        level2ChildrenIds: sortedLevel2ChildrenIds,
        children
      });
    } catch (err) {
      console.error("GetSpillTreeLevel2API error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const GetSpillTreeLevel3API = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userId = String(q.userId || q.uid || "").trim();

      if (!userId) {
        return response.status(400).json({ error: "Missing userId" });
      }

      const parentSpillSnap = await admin.database().ref(`SpillTree/${userId}`).once("value");
      const rootUserSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
      const rootUserName = String(rootUserSnap.child("userName").val() || "").trim();
      const rootFirstName = String(rootUserSnap.child("firstName").val() || "").trim();
      const rootLastName = String(rootUserSnap.child("lastName").val() || "").trim();
      const rootSavedAvatarURL = String(rootUserSnap.child("SavedAvatarURL").val() || "").trim();
      const rootMiningRankEnum = Number(
        rootUserSnap.child(`${vault.Vault_User_DB}/${vault.MiningRank_Vault_User_DB}`).val() || 1
      );
      const rootMiningRank = vault.getMiningRankDisplayName(rootMiningRankEnum);
      if (!parentSpillSnap.exists()) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          level1Count: 0,
          level1ChildrenIds: [],
          level2Count: 0,
          level2ChildrenIds: [],
          totalLevel3Children: 0,
          level3ChildrenIds: [],
          children: []
        });
      }

      const level1Snap = await admin.database().ref(`SpillTree/${userId}/childrenIds`).once("value");
      if (!level1Snap.exists()) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          level1Count: 0,
          level1ChildrenIds: [],
          level2Count: 0,
          level2ChildrenIds: [],
          totalLevel3Children: 0,
          level3ChildrenIds: [],
          children: []
        });
      }

      const level1ChildrenIds = Object.keys(level1Snap.val() || {})
        .map((id) => String(id || "").trim())
        .filter((id) => !!id)
        .slice(0, audience.SpillTreeMaxDirectChildren);

      if (level1ChildrenIds.length === 0) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          level1Count: 0,
          level1ChildrenIds: [],
          level2Count: 0,
          level2ChildrenIds: [],
          totalLevel3Children: 0,
          level3ChildrenIds: [],
          children: []
        });
      }

      const level1ChildrenSnaps = await Promise.all(
        level1ChildrenIds.map((id) => admin.database().ref(`SpillTree/${id}/childrenIds`).once("value"))
      );

      const level2Set = new Set<string>();
      for (const snap of level1ChildrenSnaps) {
        if (!snap.exists()) continue;
        const raw = snap.val() || {};
        for (const key of Object.keys(raw)) {
          const id = String(key || "").trim();
          if (id) level2Set.add(id);
        }
      }

      const maxLevel2 = audience.SpillTreeMaxDirectChildren * audience.SpillTreeMaxDirectChildren;
      const level2ChildrenIds = Array.from(level2Set).slice(0, maxLevel2);

      if (level2ChildrenIds.length === 0) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          level1Count: level1ChildrenIds.length,
          level1ChildrenIds,
          level2Count: 0,
          level2ChildrenIds: [],
          totalLevel3Children: 0,
          level3ChildrenIds: [],
          children: []
        });
      }

      const level2ChildrenSnaps = await Promise.all(
        level2ChildrenIds.map((id) => admin.database().ref(`SpillTree/${id}/childrenIds`).once("value"))
      );

      const level3Set = new Set<string>();
      for (const snap of level2ChildrenSnaps) {
        if (!snap.exists()) continue;
        const raw = snap.val() || {};
        for (const key of Object.keys(raw)) {
          const id = String(key || "").trim();
          if (id) level3Set.add(id);
        }
      }

      const maxLevel3 =
        audience.SpillTreeMaxDirectChildren *
        audience.SpillTreeMaxDirectChildren *
        audience.SpillTreeMaxDirectChildren;
      const level3ChildrenIds = Array.from(level3Set).slice(0, maxLevel3);

      if (level3ChildrenIds.length === 0) {
        return response.status(200).json({
          success: true,
          userId,
          level1Count: level1ChildrenIds.length,
          level1ChildrenIds,
          level2Count: level2ChildrenIds.length,
          level2ChildrenIds,
          totalLevel3Children: 0,
          level3ChildrenIds: [],
          children: []
        });
      }

      const children = await buildAndSortSpillTreeChildren(level3ChildrenIds);
      const sortedLevel3ChildrenIds = children.map((c) => c.userId);

      return response.status(200).json({
        success: true,
        userId,
        userName: rootUserName,
        firstName: rootFirstName,
        lastName: rootLastName,
        name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
        SavedAvatarURL: rootSavedAvatarURL,
        profilePicture: rootSavedAvatarURL,
        miningRankEnum: rootMiningRankEnum,
        miningRank: rootMiningRank,
        level1Count: level1ChildrenIds.length,
        level1ChildrenIds,
        level2Count: level2ChildrenIds.length,
        level2ChildrenIds,
        totalLevel3Children: sortedLevel3ChildrenIds.length,
        level3ChildrenIds: sortedLevel3ChildrenIds,
        children
      });
    } catch (err) {
      console.error("GetSpillTreeLevel3API error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const GetSpillTreeLevel1To3API = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userId = String(q.userId || q.uid || "").trim();

      if (!userId) {
        return response.status(400).json({ error: "Missing userId" });
      }

      const parentSpillSnap = await admin.database().ref(`SpillTree/${userId}`).once("value");
      const rootUserSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
      const rootUserName = String(rootUserSnap.child("userName").val() || "").trim();
      const rootFirstName = String(rootUserSnap.child("firstName").val() || "").trim();
      const rootLastName = String(rootUserSnap.child("lastName").val() || "").trim();
      const rootSavedAvatarURL = String(rootUserSnap.child("SavedAvatarURL").val() || "").trim();
      const rootMiningRankEnum = Number(
        rootUserSnap.child(`${vault.Vault_User_DB}/${vault.MiningRank_Vault_User_DB}`).val() || 1
      );
      const rootMiningRank = vault.getMiningRankDisplayName(rootMiningRankEnum);
      if (!parentSpillSnap.exists()) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          level1Count: 0,
          level2Count: 0,
          level3Count: 0,
          totalChildren: 0,
          level1ChildrenIds: [],
          level2ChildrenIds: [],
          level3ChildrenIds: [],
          allChildrenIds: [],
          allChildren: []
        });
      }

      const level1Snap = await admin.database().ref(`SpillTree/${userId}/childrenIds`).once("value");
      const level1ChildrenIds = level1Snap.exists()
        ? Object.keys(level1Snap.val() || {})
          .map((id) => String(id || "").trim())
          .filter((id) => !!id)
          .slice(0, audience.SpillTreeMaxDirectChildren)
        : [];

      if (level1ChildrenIds.length === 0) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          level1Count: 0,
          level2Count: 0,
          level3Count: 0,
          totalChildren: 0,
          level1ChildrenIds: [],
          level2ChildrenIds: [],
          level3ChildrenIds: [],
          allChildrenIds: [],
          allChildren: []
        });
      }

      const level1ChildrenSnaps = await Promise.all(
        level1ChildrenIds.map((id) => admin.database().ref(`SpillTree/${id}/childrenIds`).once("value"))
      );

      const level2Set = new Set<string>();
      for (const snap of level1ChildrenSnaps) {
        if (!snap.exists()) continue;
        const raw = snap.val() || {};
        for (const key of Object.keys(raw)) {
          const id = String(key || "").trim();
          if (id) level2Set.add(id);
        }
      }

      const maxLevel2 = audience.SpillTreeMaxDirectChildren * audience.SpillTreeMaxDirectChildren;
      const level2ChildrenIds = Array.from(level2Set).slice(0, maxLevel2);

      const level2ChildrenSnaps = await Promise.all(
        level2ChildrenIds.map((id) => admin.database().ref(`SpillTree/${id}/childrenIds`).once("value"))
      );

      const level3Set = new Set<string>();
      for (const snap of level2ChildrenSnaps) {
        if (!snap.exists()) continue;
        const raw = snap.val() || {};
        for (const key of Object.keys(raw)) {
          const id = String(key || "").trim();
          if (id) level3Set.add(id);
        }
      }

      const maxLevel3 =
        audience.SpillTreeMaxDirectChildren *
        audience.SpillTreeMaxDirectChildren *
        audience.SpillTreeMaxDirectChildren;
      const level3ChildrenIds = Array.from(level3Set).slice(0, maxLevel3);

      const allChildrenIds = [...level1ChildrenIds, ...level2ChildrenIds, ...level3ChildrenIds];

      if (allChildrenIds.length === 0) {
        return response.status(200).json({
          success: true,
          userId,
          userName: rootUserName,
          firstName: rootFirstName,
          lastName: rootLastName,
          name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
          SavedAvatarURL: rootSavedAvatarURL,
          profilePicture: rootSavedAvatarURL,
          miningRankEnum: rootMiningRankEnum,
          miningRank: rootMiningRank,
          level1Count: 0,
          level2Count: 0,
          level3Count: 0,
          totalChildren: 0,
          level1ChildrenIds,
          level2ChildrenIds,
          level3ChildrenIds,
          allChildrenIds: [],
          allChildren: []
        });
      }

      const levelMap: { [key: string]: number } = {};
      for (const id of level1ChildrenIds) levelMap[id] = 1;
      for (const id of level2ChildrenIds) levelMap[id] = 2;
      for (const id of level3ChildrenIds) levelMap[id] = 3;
      const allChildren = await buildAndSortSpillTreeChildren(allChildrenIds, levelMap);
      const sortedAllChildrenIds = allChildren.map((c) => c.userId);

      return response.status(200).json({
        success: true,
        userId,
        userName: rootUserName,
        firstName: rootFirstName,
        lastName: rootLastName,
        name: `${rootFirstName} ${rootLastName}`.trim() || rootUserName,
        SavedAvatarURL: rootSavedAvatarURL,
        profilePicture: rootSavedAvatarURL,
        miningRankEnum: rootMiningRankEnum,
        miningRank: rootMiningRank,
        level1Count: level1ChildrenIds.length,
        level2Count: level2ChildrenIds.length,
        level3Count: level3ChildrenIds.length,
        totalChildren: sortedAllChildrenIds.length,
        level1ChildrenIds,
        level2ChildrenIds,
        level3ChildrenIds,
        allChildrenIds: sortedAllChildrenIds,
        allChildren
      });
    } catch (err) {
      console.error("GetSpillTreeLevel1To3API error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const GetSpillTreeLevelCountsAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userId = String(q.userId || q.uid || "").trim();

      if (!userId) {
        return response.status(400).json({ error: "Missing userId" });
      }

      const levelCounts: { [key: string]: number } = {};
      // const levelUserIds: { [key: string]: string[] } = {};
      const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
      const miningRankEnum = Number(
        userSnap.child(`${vault.Vault_User_DB}/${vault.MiningRank_Vault_User_DB}`).val() || 1
      );
      const miningRank = vault.getMiningRankDisplayName(miningRankEnum);

      const rootSpillSnap = await admin.database().ref(`SpillTree/${userId}`).once("value");
      if (!rootSpillSnap.exists()) {
        return response.status(200).json({
          success: true,
          userId,
          miningRankEnum,
          miningRank,
          maxLevel: 0,
          traversedLevels: 0,
          ...levelCounts,
          totalDescendants: 0
        });
      }

      let currentLevelIds: string[] = [userId];
      const visitedIds = new Set<string>([userId]);
      const allDescendants = new Set<string>();
      let level = 1;

      while (currentLevelIds.length > 0) {
        const childrenSnaps = await Promise.all(
          currentLevelIds.map((id) => admin.database().ref(`SpillTree/${id}/childrenIds`).once("value"))
        );

        const nextLevelSet = new Set<string>();
        for (const snap of childrenSnaps) {
          if (!snap.exists()) continue;

          const raw = snap.val() || {};
          for (const key of Object.keys(raw)) {
            const childId = String(key || "").trim();
            if (childId && !visitedIds.has(childId)) {
              nextLevelSet.add(childId);
            }
          }
        }

        const nextLevelIds = Array.from(nextLevelSet);
        levelCounts[`level${level}`] = nextLevelIds.length;
        // levelUserIds[`level${level}UserIds`] = nextLevelIds;

        for (const id of nextLevelIds) {
          visitedIds.add(id);
          allDescendants.add(id);
        }

        currentLevelIds = nextLevelIds;
        level += 1;
      }

      const traversedLevels = Math.max(level - 1, 0);

      return response.status(200).json({
        success: true,
        userId,
        miningRankEnum,
        miningRank,
        maxLevel: traversedLevels,
        traversedLevels,
        ...levelCounts,
        totalDescendants: allDescendants.size
      });
    } catch (err) {
      console.error("GetSpillTreeLevelCountsAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const AddZplnMinedToAllUsersAPI = functions.runWith({
  timeoutSeconds: 540,
  memory: "1GB"
}).https.onRequest(async (request, response) => {
  try {
    const q: any = request.method === "GET" ? request.query : request.body;
    const pwd = String(q.pwd || "");
    const amount = Number(q.amount || 100);

    if (!Number.isFinite(amount) || amount <= 0) {
      response.status(400).json({ error: "Invalid amount" });
      return;
    }

    // same env password pattern used in your project
    if (STAGING) {
      if (pwd !== "Ediiie911") {
        response.status(401).json({ error: "Unauthorized" });
        return;
      }
    } else {
      if (pwd !== "MasterEdiiie911") {
        response.status(401).json({ error: "Unauthorized" });
        return;
      }
    }

    const usersSnap = await admin.database().ref(tournament.Users_DB).once("value");
    if (!usersSnap.exists()) {
      response.status(200).json({ success: true, totalUsers: 0, updated: 0, failed: 0 });
      return;
    }

    const userIds: string[] = [];
    usersSnap.forEach((c) => {
      if (c.key) userIds.push(String(c.key));
      return false;
    });

    let updated = 0;
    let failed = 0;

    // sequential updates to avoid trigger spikes
    for (let i = 0; i < userIds.length; i++) {
      const uid = userIds[i];
      const ref = admin.database().ref(
        `${tournament.Users_DB}/${uid}/${vault.Vault_User_DB}/${vault.ZplnMinned_Vault_User_DB}`
      );

      try {
        await ref.transaction((current) => Number(current || 0) + amount);
        updated++;
      } catch (err) {
        failed++;
        console.warn(`AddZplnMinedToAllUsersAPI failed for ${uid}`, err);
      }

      // small throttle every 25 users
      if ((i + 1) % 25 === 0) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    response.status(200).json({
      success: true,
      amountAddedPerUser: amount,
      totalUsers: userIds.length,
      updated,
      failed
    });
  } catch (err) {
    console.error("AddZplnMinedToAllUsersAPI error:", err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

export const GetUsersCountAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const [usersSnap, echoUsersSnap] = await Promise.all([
        admin.database().ref(tournament.Users_DB).once("value"),
        admin.database().ref("EchoUsers").once("value")
      ]);

      return response.status(200).json({
        success: true,
        usersCount: usersSnap.numChildren(),
        echoUsersCount: echoUsersSnap.numChildren(),
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("GetUsersCountAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});


export const CreateStagingNodeAPI = functions.runWith({ memory: "512MB" }).https.onRequest(async (request, response) => {
  try {
    await admin.database().ref("staging").update({
      createdAt: Date.now(),
      enabled: true
    });

    response.status(200).json({ success: true, path: "/staging" });
  } catch (err) {
    console.error("CreateStagingNodeAPI error:", err);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

export const GetUserByUsernameAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userName = String(q.userName || "").trim();

      if (!userName) {
        return response.status(400).json({ error: "Missing userName" });
      }

      // Search for user by userName
      const usersSnap = await admin.database().ref(tournament.Users_DB).once("value");
      if (!usersSnap.exists()) {
        return response.status(404).json({ error: "No users found" });
      }

      let foundUser: any = null;
      let foundUserId: string = "";

      usersSnap.forEach((child) => {
        const user = child.val() || {};
        if (String(user.userName || "").trim().toLowerCase() === userName.toLowerCase()) {
          foundUserId = String(child.key);
          foundUser = user;
          return true; // break
        }
        return false;
      });

      if (!foundUser) {
        return response.status(404).json({ error: "User not found" });
      }

      return response.status(200).json({
        success: true,
        userId: foundUserId,
        userName: foundUser.userName || "",
        firstName: foundUser.firstName || "",
        lastName: foundUser.lastName || "",
        phone: foundUser.phone || "",
        email: foundUser.email || "",
        parentUid: foundUser.parentUid || "",
        parentId: foundUser.parentId || "",
        isEchoPro: foundUser.isEchoPro === true,
        createdAt: foundUser.createdAt || null,
        lastLoginAt: foundUser.lastLoginAt || null,
        globalAverage: foundUser.globalAverage || 0
      });

    } catch (err) {
      console.error("GetUserByUsernameAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const CheckUserNameValidityByUserIdAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userId = String(q.userId || q.uid || "").trim();

      if (!userId) {
        return response.status(400).json({ error: "Missing userId" });
      }

      const userSnap = await admin.database().ref(`${tournament.Users_DB}/${userId}`).once("value");
      if (!userSnap.exists()) {
        return response.status(404).json({ error: "User not found" });
      }

      const existingUserName = String(userSnap.child("userName").val() || "").trim();
      const hasWhitespace = /\s/.test(existingUserName);

      return response.status(200).json({
        success: true,
        userId,
        existingUserName,
        isValid: !hasWhitespace
      });
    } catch (err) {
      console.error("CheckUserNameValidityByUserIdAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const UpdateUserNameByUserIdAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const q: any = request.method === "GET" ? request.query : request.body;
      const userId = String(q.userId || q.uid || "").trim();
      const requestedUserName = String(q.userName || q.newUserName || "").trim();

      if (!userId) {
        return response.status(400).json({ error: "Missing userId" });
      }

      if (!requestedUserName) {
        return response.status(400).json({ error: "Missing userName" });
      }

      if (/\s/.test(requestedUserName)) {
        return response.status(200).json({
          success: true,
          updated: false,
          userId,
          requestedUserName,
          isValid: false,
          message: "Username is not valid because it contains spaces"
        });
      }

      const userRef = admin.database().ref(`${tournament.Users_DB}/${userId}`);
      const userSnap = await userRef.once("value");
      if (!userSnap.exists()) {
        return response.status(404).json({ error: "User not found" });
      }

      await userRef.update({ userName: requestedUserName });

      return response.status(200).json({
        success: true,
        updated: true,
        userId,
        userName: requestedUserName,
        isValid: true
      });
    } catch (err) {
      console.error("UpdateUserNameByUserIdAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const GetUsersWithoutParentAPI = functions.runWith({ memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const usersSnap = await admin.database().ref(tournament.Users_DB).once("value");
      if (!usersSnap.exists()) {
        return response.status(200).json({ success: true, count: 0, users: [] });
      }

      const users: { userId: string; userName: string; phone: string; isEchoPro: boolean; createdAt: number | null }[] = [];

      usersSnap.forEach((child) => {
        const node = child.val() || {};
        const parentUid = String(node.parentUid || "").trim();
        const parentId  = String(node.parentId  || "").trim();

        if (!parentUid && !parentId) {
          users.push({
            userId:    String(child.key || ""),
            userName:  String(node.userName  || ""),
            phone:     String(node.phone     || ""),
            isEchoPro: node.isEchoPro === true,
            createdAt: node.createdAt || null
          });
        }
        return false;
      });

      return response.status(200).json({
        success: true,
        count: users.length,
        users
      });
    } catch (err) {
      console.error("GetUsersWithoutParentAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const DeleteUsersWithoutParentAPI = functions.runWith({
  timeoutSeconds: 540,
  memory: "2GB"
}).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const pwd = String(request.body?.pwd || request.query?.pwd || "");

      if (STAGING) {
        if (pwd !== "Ediiie911") return response.status(401).json({ error: "Unauthorized" });
      } else {
        if (pwd !== "MasterEdiiie911") return response.status(401).json({ error: "Unauthorized" });
      }

      const dryRun = String(request.body?.dryRun || request.query?.dryRun || "false").toLowerCase() === "true";

      const usersSnap = await admin.database().ref(tournament.Users_DB).once("value");
      if (!usersSnap.exists()) {
        return response.status(200).json({
          success: true,
          dryRun,
          scanned: 0,
          toDelete: 0,
          deletedFromDb: 0,
          deletedFromAuth: 0,
          failedAuthDeletes: 0,
          users: []
        });
      }

      const usersToDelete: Array<{ userId: string; userName: string; phone: string }> = [];

      usersSnap.forEach((child) => {
        const node = child.val() || {};
        const userId = String(child.key || "");
        const parentUid = String(node.parentUid || "").trim();
        const parentId = String(node.parentId || "").trim();

        // Never delete the configured root user even if parent fields are blank.
        if (userId === audience.RootUserId) return false;

        if (!parentUid && !parentId) {
          usersToDelete.push({
            userId,
            userName: String(node.userName || ""),
            phone: String(node.phone || "")
          });
        }
        return false;
      });

      if (dryRun) {
        return response.status(200).json({
          success: true,
          dryRun: true,
          scanned: usersSnap.numChildren(),
          toDelete: usersToDelete.length,
          users: usersToDelete
        });
      }

      if (usersToDelete.length === 0) {
        return response.status(200).json({
          success: true,
          dryRun: false,
          scanned: usersSnap.numChildren(),
          toDelete: 0,
          deletedFromDb: 0,
          deletedFromAuth: 0,
          failedAuthDeletes: 0,
          users: []
        });
      }

      const dbUpdates: { [key: string]: any } = {};
      for (const u of usersToDelete) {
        dbUpdates[`${tournament.Users_DB}/${u.userId}`] = null;
      }
      await admin.database().ref("/").update(dbUpdates);

      let deletedFromAuth = 0;
      let failedAuthDeletes = 0;
      for (const u of usersToDelete) {
        try {
          await admin.auth().deleteUser(u.userId);
          deletedFromAuth++;
        } catch (err) {
          failedAuthDeletes++;
          console.warn(`DeleteUsersWithoutParentAPI: auth delete skipped for ${u.userId}`, err);
        }
      }

      return response.status(200).json({
        success: true,
        dryRun: false,
        scanned: usersSnap.numChildren(),
        toDelete: usersToDelete.length,
        deletedFromDb: usersToDelete.length,
        deletedFromAuth,
        failedAuthDeletes,
        users: usersToDelete
      });
    } catch (err) {
      console.error("DeleteUsersWithoutParentAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const DeleteEchoUsersWithoutParentAPI = functions.runWith({
  timeoutSeconds: 540,
  memory: "2GB"
}).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const pwd = String(request.body?.pwd || request.query?.pwd || "");

      if (STAGING) {
        if (pwd !== "Ediiie911") return response.status(401).json({ error: "Unauthorized" });
      } else {
        if (pwd !== "MasterEdiiie911") return response.status(401).json({ error: "Unauthorized" });
      }

      const dryRun = String(request.body?.dryRun || request.query?.dryRun || "false").toLowerCase() === "true";
      // Safety default: DB-only cleanup for EchoUsers mirror. Set deleteAuth=true only if needed.
      const deleteAuth = String(request.body?.deleteAuth || request.query?.deleteAuth || "false").toLowerCase() === "true";

      const echoUsersSnap = await admin.database().ref("EchoUsers").once("value");
      if (!echoUsersSnap.exists()) {
        return response.status(200).json({
          success: true,
          dryRun,
          deleteAuth,
          scanned: 0,
          toDelete: 0,
          deletedFromDb: 0,
          deletedFromAuth: 0,
          failedAuthDeletes: 0,
          users: []
        });
      }

      const usersToDelete: Array<{ userId: string; userName: string; phone: string }> = [];

      echoUsersSnap.forEach((child) => {
        const node = child.val() || {};
        const userId = String(child.key || "");
        const parentUid = String(node.parentUid || "").trim();
        const parentId = String(node.parentId || "").trim();

        if (userId === audience.RootUserId) return false;

        if (!parentUid && !parentId) {
          usersToDelete.push({
            userId,
            userName: String(node.userName || ""),
            phone: String(node.phone || "")
          });
        }
        return false;
      });

      if (dryRun) {
        return response.status(200).json({
          success: true,
          dryRun: true,
          deleteAuth,
          scanned: echoUsersSnap.numChildren(),
          toDelete: usersToDelete.length,
          users: usersToDelete
        });
      }

      if (usersToDelete.length === 0) {
        return response.status(200).json({
          success: true,
          dryRun: false,
          deleteAuth,
          scanned: echoUsersSnap.numChildren(),
          toDelete: 0,
          deletedFromDb: 0,
          deletedFromAuth: 0,
          failedAuthDeletes: 0,
          users: []
        });
      }

      const dbUpdates: { [key: string]: any } = {};
      for (const u of usersToDelete) {
        dbUpdates[`EchoUsers/${u.userId}`] = null;
      }
      await admin.database().ref("/").update(dbUpdates);

      let deletedFromAuth = 0;
      let failedAuthDeletes = 0;

      if (deleteAuth) {
        for (const u of usersToDelete) {
          try {
            await admin.auth().deleteUser(u.userId);
            deletedFromAuth++;
          } catch (err) {
            failedAuthDeletes++;
            console.warn(`DeleteEchoUsersWithoutParentAPI: auth delete skipped for ${u.userId}`, err);
          }
        }
      }

      return response.status(200).json({
        success: true,
        dryRun: false,
        deleteAuth,
        scanned: echoUsersSnap.numChildren(),
        toDelete: usersToDelete.length,
        deletedFromDb: usersToDelete.length,
        deletedFromAuth,
        failedAuthDeletes,
        users: usersToDelete
      });
    } catch (err) {
      console.error("DeleteEchoUsersWithoutParentAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});

export const SyncEchoUsersToUsersAPI = functions.runWith({
  timeoutSeconds: 540,
  memory: "2GB"
}).https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      const pwd = String(request.body?.pwd || request.query?.pwd || "");

      if (STAGING) {
        if (pwd !== "Ediiie911") return response.status(401).json({ error: "Unauthorized" });
      } else {
        if (pwd !== "MasterEdiiie911") return response.status(401).json({ error: "Unauthorized" });
      }

      const dryRun = String(request.body?.dryRun || request.query?.dryRun || "true").toLowerCase() === "true";

      const echoUsersSnap = await admin.database().ref("EchoUsers").once("value");
      const usersSnap = await admin.database().ref(tournament.Users_DB).once("value");

      if (!echoUsersSnap.exists()) {
        return response.status(200).json({
          success: true,
          dryRun,
          echoUsersScanned: 0,
          usersScanned: usersSnap.exists() ? usersSnap.numChildren() : 0,
          missingCount: 0,
          syncedCount: 0,
          failedCount: 0,
          missingUsers: [],
          failedUsers: []
        });
      }

      const usersMap = usersSnap.exists() ? (usersSnap.val() || {}) : {};
      const missingUsers: Array<{
        userId: string;
        userName: string;
        phone: string;
        parentUid: string;
        firstName: string;
        lastName: string;
        email: string;
      }> = [];

      echoUsersSnap.forEach((child) => {
        const userId = String(child.key || "").trim();
        if (!userId) return false;

        if (!usersMap[userId]) {
          const node = child.val() || {};
          missingUsers.push({
            userId,
            userName: String(node.userName || "").trim(),
            phone: String(node.phone || "").trim(),
            parentUid: String(node.parentUid || node.parentId || "").trim(),
            firstName: String(node.firstName || "").trim(),
            lastName: String(node.lastName || "").trim(),
            email: String(node.email || "").trim()
          });
        }
        return false;
      });

      if (dryRun) {
        return response.status(200).json({
          success: true,
          dryRun: true,
          echoUsersScanned: echoUsersSnap.numChildren(),
          usersScanned: usersSnap.exists() ? usersSnap.numChildren() : 0,
          missingCount: missingUsers.length,
          missingUsers
        });
      }

      let syncedCount = 0;
      const failedUsers: Array<{ userId: string; reason: string }> = [];

      for (const user of missingUsers) {
        try {
          await utils.CreateUserFromJson(
            user.userId,
            user.userName || `${user.firstName} ${user.lastName}`.trim() || user.userId,
            user.phone,
            user.parentUid,
            ""
          );

          await utils.PlayerExtraConfigurationById(user.userId);

          const patch: { [key: string]: any } = {
            parentUid: user.parentUid,
            parentId: user.parentUid,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            [userUtils.FieldIsEchoPro]: true
          };

          const echoUserSnap = await admin.database().ref(`EchoUsers/${user.userId}`).once("value");
          if (echoUserSnap.exists() && echoUserSnap.child(userUtils.FieldEcho).exists()) {
            patch[userUtils.FieldEcho] = echoUserSnap.child(userUtils.FieldEcho).val();
          }

          await admin.database().ref(`${tournament.Users_DB}/${user.userId}`).update(patch);

          if (user.parentUid) {
            await audience.addChildToParentChildrenIds(user.parentUid, user.userId, tournament.Users_DB);
            await audience.addUserToSpillTree(user.parentUid, user.userId);
            await vault.rewardParentForNewChildJoin(user.parentUid, user.userId).catch((err) => {
              console.error("registerUsersAPI: failed to create join reward notification", user.parentUid, user.userId, err);
            });
          }

          syncedCount++;
        } catch (err: any) {
          failedUsers.push({
            userId: user.userId,
            reason: String(err?.message || err || "Unknown error")
          });
          console.warn("SyncEchoUsersToUsersAPI: failed for user", user.userId, err);
        }
      }

      return response.status(200).json({
        success: true,
        dryRun: false,
        echoUsersScanned: echoUsersSnap.numChildren(),
        usersScanned: usersSnap.exists() ? usersSnap.numChildren() : 0,
        missingCount: missingUsers.length,
        syncedCount,
        failedCount: failedUsers.length,
        missingUsers,
        failedUsers
      });
    } catch (err) {
      console.error("SyncEchoUsersToUsersAPI error:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  });
});