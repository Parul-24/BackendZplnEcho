import * as admin from "firebase-admin";
import * as leaderboards from './leaderboards';
import * as controlled_invites from "./controlled_invites";
import * as tournament from "./tournament";
import * as audience from "./audience";
//import * as user_utils from "./user_utils";
import * as vault from "./vault";


import DataSnapshot = admin.database.DataSnapshot;

import {
    Coins_Users_DB,
    GameParameters_DB,
    getActiveTournaments,
    NextWeek_GameParameters_DB,
    Users_DB
} from "./tournament";
import * as functions from "firebase-functions";
export const Weekly_Coins_Reward = 100;
const Week_Reward_Requested_Users_DB = "weekRewardRequested";
const WEEKLY_RESET_STATUS = "WeeklyResetStatus";

export async function weeklyReward(userDb: DataSnapshot){
    let currCoins = 0
    if (userDb.child(Coins_Users_DB).exists()){
        currCoins = userDb.child(Coins_Users_DB).val()
    }

    await userDb
        .ref.transaction((us)=>{
            return {[Coins_Users_DB]: currCoins+ Weekly_Coins_Reward};
        });
    await userDb.child(Week_Reward_Requested_Users_DB)
        .ref.transaction((val)=>{return true;});

}

export async function canRequestWeeklyRewardByUserId(userId: string): Promise<boolean>{
    const userDb = await admin.database().ref(Users_DB+"/"+userId).once('value');
    if (!userDb.exists())
        return false;
    return canRequestWeeklyReward(userDb);
}

export async function canRequestWeeklyReward(userDb: DataSnapshot): Promise<boolean> {
    const weekRewardRef = userDb.child(Week_Reward_Requested_Users_DB);

    if (!weekRewardRef.exists()) return true;

    return ! Boolean(weekRewardRef.val());
}

export async function preWeeklyRecapBuffer(context: functions.EventContext | null) {
    console.log("preWeeklyRecapBuffer Called");
    setWeeklyResetState(1);
}

export async function weeklyRecap(context: functions.EventContext | null) {
    console.log("Weekly Reset Started");
    setWeeklyResetState(2);


    let active_tournaments = await getActiveTournaments();
    console.log("Weekly Recap: " + active_tournaments.numChildren() + " events");

    const parametersRef = await admin.database().ref(GameParameters_DB);
    const nextWeek = new Date(Date.now());
    nextWeek.setDate(nextWeek.getDate() + 7)
    nextWeek.setUTCHours(7, 0, 0);

    let options = { timeZone: 'America/Los_Angeles' };
    let pstTime = nextWeek.toLocaleString('en-US', options);

    await parametersRef.update(
        { [NextWeek_GameParameters_DB]: pstTime }
    )

    let allPromises: any[] = []

    const userDb = await admin.database().ref(Users_DB).once('value');

    userDb.forEach((user) => {
        //reset player related scoring data
        allPromises.push(new Promise<void>((resolve, reject) => {
            user.ref
                .update({
                    // globalAverage: 0,
                    // highestScoreEver: 0,
                    [audience.FieldWavescoreData]: {},
                    // AverageWindow: {},
                    // [user_utils.FieldNumberOfGamesPlayedCurrentWeek]: {}
                })
                .then(() => {
                    resolve(); // Resolve the Promise when the update is successful
                })
                .catch((error) => {
                    reject(error); // Reject the Promise if there is an error during the update
                });
        }));

        // //converting coins to cash if the condition satisfies for conversion
        // allPromises.push(vault.ConvertCoinsIntoCash(user.key));

        // //reset all coin values
        // allPromises.push(vault.ResetAllCoinsValues(user.key));

        //set weekly reward request flag
        allPromises.push(
            user.child(Week_Reward_Requested_Users_DB)
                .ref.transaction((req) => { return false; })
                .then(() => {
                    console.log(user.key + " Weekly Reward Reset");
                }).catch()
        );

    });

    const tournaments = await admin.database().ref(tournament.Active_Tournaments_DB).once('value');
    tournaments.forEach((t) => {
        allPromises.push(new Promise<void>((resolve, reject) => {

            tournament.removeLbForEventsThatAreCompleted(t).then(() => {
                resolve(); // Resolve the Promise when the update is successful
            })
            .catch((error) => {
                reject(error); // Reject the Promise if there is an error during the update
            });
        }))});

    await Promise.all(allPromises);

    //global leaderboards backup
    {
        const activeTournamentsRef = admin.database().ref(tournament.Active_Tournaments_DB);
        const activeEvents = await activeTournamentsRef
            .once('value');

        const allPromises: any[] = [];
        activeEvents.forEach((ev) => {
            let eventKey = ev.key;

            if (eventKey !== null) {
                allPromises.push(leaderboards.getLeaderboardBackup(eventKey));
            }
        });
        await Promise.all(allPromises);
    }

    //clear leaderboards data from firestore database.
    await leaderboards.ClearAllLeaderboardsAndRelatedData();

   // await user_utils.resetCoinsForAllUsers(100);

//     // ---- Recalculate miningRate for all users (batch to avoid spikes) ----
//   try {
//     const usersSnap = await admin.database().ref(Users_DB).once("value");
//     if (usersSnap.exists()) {
//       const userIds = Object.keys(usersSnap.val());
//       const batchSize = 50; // tune this to your capacity
//       for (let i = 0; i < userIds.length; i += batchSize) {
//         const batch = userIds.slice(i, i + batchSize);
//         await Promise.all(
//           batch.map((uid) =>
//             vault.calculateAndUpdateMiningRateForUser(uid).catch((err) => {
//               console.error("weeklyRecap: failed to update miningRate for", uid, err);
//             })
//           )
//         );
//       }
//       console.log("weeklyRecap: miningRate recompute completed for all users");
//     }
//   } catch (err) {
//     console.error("weeklyRecap: error during miningRate recompute", err);
//   }
//   // ---- end recompute ----

    setWeeklyResetState(0);
    console.log("Weekly Reset Completed");
}

export async function setWeeklyResetState(stateCode: number) {
    const parametersRef = await admin.database().ref(GameParameters_DB);
    await parametersRef.update(
        { [WEEKLY_RESET_STATUS]: stateCode }
    )
}

export async function minutelyJob(context: functions.EventContext | null) {
    console.log("minutelyJob Called at " + new Date().toString());
    controlled_invites.eventCompletionCheck();
}

// Runs 4 times per day (every 6 hours) to refresh stale mining-rank cache values.
export const dailyRefreshMiningRanks = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .pubsub.schedule("0 */6 * * *")
  .timeZone("America/Los_Angeles")
  .onRun(async (context) => {
    console.log("dailyRefreshMiningRanks started", new Date().toISOString());
    try {
      const usersSnap = await admin.database().ref(Users_DB).once("value");
      if (!usersSnap.exists()) {
        console.log("dailyRefreshMiningRanks: no users found");
        return null;
      }

      const usersVal = usersSnap.val() as Record<string, unknown> | null;
      const userIds = Object.keys(usersVal || {});
      const batchSize = 50;
      const delayMs = 200;

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map((uid) =>
            vault
              .getMiningRankSnapshot(uid, true)
              .catch((err) => {
                console.error("dailyRefreshMiningRanks: failed for", uid, err);
              })
          )
        );

        if (i + batchSize < userIds.length) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }

      console.log("dailyRefreshMiningRanks completed at", new Date().toISOString());
      return null;
    } catch (err) {
      console.error("dailyRefreshMiningRanks error:", err);
      return null;
    }
  });

export const dailyRefreshMiningRewards = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .pubsub.schedule("0 */6 * * *")
  .timeZone("America/Los_Angeles")
  .onRun(async (context) => {
    console.log("dailyRefreshMiningRewards started", new Date().toISOString());
    try {
      const result = await vault.calculateAllUsersTeamGrowthRewardsForBatch(true, 50);
      console.log("dailyRefreshMiningRewards summary", {
        processed: result.processed,
        totalMaka: result.totalMaka,
        totalCash: result.totalCash,
        totalRewards: result.totalRewards,
        nonQualifiedUserMakaTotal: result.nonQualifiedUserMakaTotal,
        nonQualifiedUserCashTotal: result.nonQualifiedUserCashTotal,
        at: new Date().toISOString()
      });
      return null;
    } catch (err) {
      console.error("dailyRefreshMiningRewards error:", err);
      return null;
    }
  });

