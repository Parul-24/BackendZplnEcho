import * as admin from "firebase-admin";

import * as functions from "firebase-functions";
import * as utils from "./utils";
import * as user_utils from "./user_utils";

import DataSnapshot = admin.database.DataSnapshot;

//import * as tournament_cards from './tournament_cards';
import * as leaderboards from "./leaderboards";
import * as tournament_cards from "./tournament_cards";
import * as audience from "./audience";
import * as practice_games from "./practice_games";

import * as vault from "./vault";

export const Active_Tournaments_DB = "Active_Tournaments";
export const Historic_Tournaments_DB = "Historic_Tournaments";
export const Users_DB = "Users";
export const PracticeGameParameters_DB = "PracticeGameParameters";
export const GameParameters_DB = "Parameters";
export const NextWeek_GameParameters_DB = "nextWeek";

export const Tournaments_Users_DB = "Tournaments";
export const Event_Finales_Users_DB = "Event_Finales";
const Event_Finales_Claimed = "claimed";
const CurrentGameForUser_User_DB = "currentGame";
const CurrentGameStateForUser_User_DB = "gameState"; //0-Joined, 1-Finished, 2-Accepted
export const GlobalAverage_UserDB = "globalAverage";
export const Coins_Users_DB = "vault/coins";
export const Lira_Users_DB = "vault/lira";

export const AverageWindow_UserDB = "AverageWindow";
export const PracticeAverageWindow_UserDB = "PracticeAverageWindow";

export const Player_Tournaments_DB = "Players";
const PlayerNumber_Tournaments_DB = "numberOfPlayers";

//const Phase_Tournaments_DB = "phaseNumber";
const CurrentPhase_Tournament_DB = "currentPhase";
//const PhaseHours_Tournaments_DB = "phaseHours";
const RemainHours_Tournaments_DB = "remainsHours";
//const NumberOfGames_Tournaments_DB = "gamesNumber";
export const CoinsCost_Tournaments_DB = "coinsCost";
//const CreditsJackpot_Tournaments_DB = "creditJackpot";
const StartDate_Tournaments_DB = "startDate";
const DAILY_RESET_STATUS = "DailyResetStatus";
export const IsEventCompleted = "IsEventCompleted";

export const Practice_Games_Per_Set = 3;
export const Practice_Sets = 4;
export const Sponsored_Games_Per_Set = 3;

export const ENTRY_ALLOWED_PARAM = "entryAllowedFor";
export const LOWER_LIMIT = "lowerLimit";
export const UPPER_LIMIT = "upperLimit";
export const LOWER_LIMIT_PATH = ENTRY_ALLOWED_PARAM + "/" + "lowerLimit";
export const UPPER_LIMIT_PATH = ENTRY_ALLOWED_PARAM + "/" + "upperLimit";

export function getActiveTournaments(): Promise<DataSnapshot> {
  return admin
    .database()
    .ref(Active_Tournaments_DB + "/")
    .orderByChild("eventOrder")
    .once("value");
}

export async function getActiveExhibitionTournaments(): Promise<any> {
  const activeEvents: any = [];
  const activeEventsSnapshot = await admin
    .database()
    .ref("Active_Tournaments")
    .once("value");
  activeEventsSnapshot.forEach((childSnapshot) => {
    const eventKey = childSnapshot.key;
    const eventData = childSnapshot.val();
    if (
      eventData.isActiveToday == true &&
      eventData.isExhibitionEvent == true &&
      eventData.IsEventCompleted == false
    ) {
      activeEvents.push({
        eventId: eventKey,
        ...eventData,
      });
    }
  });
  return activeEvents;
}

//ProBrand Event List
export async function getProBrandEventList(): Promise<any[]> {
  const parametersRef = admin.database().ref(GameParameters_DB);
  const proEventListRef = parametersRef.child("ProEventList");

  // Try to fetch the ProEventList
  let snapshot = await proEventListRef.once("value");
  let proEventList = snapshot.val();

  // If it doesn't exist, create with sample data
  if (!proEventList) {
    proEventList = [
      { id: "1", name: "AVISION" },
      { id: "2", name: "BOMBAE" },
      { id: "3", name: "HWOOD" },
      { id: "4", name: "STEPPYBED" },
    ];
    await proEventListRef.set(proEventList);
  }

  // Return as array
  // If the data is stored as an object, convert to array
  if (!Array.isArray(proEventList)) {
    proEventList = Object.values(proEventList);
  }

  return proEventList;
}

// similary make for Echo events

/*
Weekly Reward to user DataSnapshot
 */

export async function preDailyRecapBuffer(
  context: functions.EventContext | null
) {
  console.log("preDailyRecapBuffer Called");
  setDailyResetState(1);
}

// export async function dailyRecap(context: functions.EventContext | null) {
//   console.log("Daily Reset Started");
//   setDailyResetState(2);

//   if (context !== null) console.log("Daily: " + context.eventId);
//   let active_tournaments = await getActiveTournaments();
//   await updateRemainingTime(active_tournaments);

//   active_tournaments = await getActiveTournaments();
//   console.log(
//     "Daily Recap: Active Tournaments: " + active_tournaments.numChildren()
//   );
//   let allPromises: Promise<any>[] = [];
//   active_tournaments.forEach((tournament) => {
//     console.log("Daily Test: " + tournament.key);
//     allPromises.push(
//       endedTournament(tournament)
//         .then(async (ended) => {
//           console.log("End Test: " + tournament.key + " => " + ended);
//           if (ended) {
//             // add logic for new reset
//             const isEventCompleted = tournament.child(IsEventCompleted).val();
//             if (!isEventCompleted) {
//               await tournament.ref.update({ [IsEventCompleted]: true });

//               if (tournament.key !== null)
//                 await leaderboards.getLeaderboardBackup(tournament.key);
//             }
//           }
//         })
//         .catch()
//     );
//   });
//   await Promise.all(allPromises);

//   setDailyResetState(0);
//   console.log("Daily Reset Completed");
// }

export async function dailyRecap(context: functions.EventContext | null) {
  console.log("Daily Reset Started");
  setDailyResetState(2);

  if (context !== null) console.log("Daily: " + context.eventId);
  let active_tournaments = await getActiveTournaments();
  await updateRemainingTime(active_tournaments);

  active_tournaments = await getActiveTournaments();
  console.log(
    "Daily Recap: Active Tournaments: " + active_tournaments.numChildren()
  );
  let allPromises: Promise<any>[] = [];
  active_tournaments.forEach((tournament) => {
    console.log("Daily Test: " + tournament.key);
    allPromises.push(
      endedTournament(tournament)
        .then(async (ended) => {
          console.log("End Test: " + tournament.key + " => " + ended);
          if (ended) {
            // add logic for new reset
            const isEventCompleted = tournament.child(IsEventCompleted).val();
            if (!isEventCompleted) {
              await tournament.ref.update({ [IsEventCompleted]: true });

              if (tournament.key !== null) {
                await leaderboards.getLeaderboardBackup(tournament.key);
                
                // ---- NEW: Auto-credit prizes when event completes ----
                const alreadyCredited = Boolean(tournament.child("prizesCredited").val());
                if (!alreadyCredited) {
                  try {
                    const res = await leaderboards.finalizeEventAwards(tournament.key);
                    console.log(`dailyRecap: ${tournament.key} credited ${res.credited} winners`);
                    await tournament.ref.update({ 
                      prizesCredited: true, 
                      prizesCreditedAt: Date.now() 
                    });
                  } catch (err) {
                    console.error(`dailyRecap: finalizeEventAwards failed for ${tournament.key}:`, err);
                  }
                } else {
                  console.log(`dailyRecap: ${tournament.key} already credited, skipping`);
                }
                // ---- end auto-credit ----
              }
            }
          }
        })
        .catch()
    );
  });
  await Promise.all(allPromises);

  setDailyResetState(0);
  console.log("Daily Reset Completed");
}


export async function removeLbForEventsThatAreCompleted(
  tournament: DataSnapshot
) {
  const isEventCompleted = tournament.child(IsEventCompleted).val();
  if (isEventCompleted) {
    await utils.moveFirebaseRecord(
      admin.database().ref(Active_Tournaments_DB + "/" + tournament.key),
      admin.database().ref(Historic_Tournaments_DB + "/" + tournament.key)
    );
    await admin
      .database()
      .ref(Historic_Tournaments_DB + "/" + tournament.key)
      .update({ endTimestamp: admin.database.ServerValue.TIMESTAMP });
    console.log("Moved to history " + tournament.key);

    if (hasRenewal(tournament)) {
      console.log("Create renewal for " + tournament.key);
      await tournament_cards
        .renewEvent(tournament)
        .then((eventId) => {
          console.log("Renew: " + tournament.key + "==>" + eventId.eventId);
        })
        .catch();
    }
  }
}

async function updateRemainingTime(active_tournaments: DataSnapshot) {
  let today = new Date();
  //today = new Date(today.getFullYear(),today.getMonth(),today.getDate(),utils.DefaultTimeZoneSwift);
  // console.log("updateRemainingTime --- today --- " + today);

  const allPromises: Promise<any>[] = [];
  console.log(
    "updateRemainingTime --- active_tournaments length:" +
      active_tournaments.numChildren
  );
  active_tournaments.forEach((tournament) => {
    const start_date = new Date(
      tournament.child(StartDate_Tournaments_DB).val()
    );
    console.log(
      "updateRemainingTime --- start_date --- " +
        start_date +
        " - today" +
        today +
        "tournament:" +
        tournament.key
    );

    if (start_date <= today) {
      let curHours = tournament.child(RemainHours_Tournaments_DB).val();

      const isActiveToday = tournament.child("isActiveToday").val();
      console.log(
        "updateRemainingTime --- curHours --- " +
          curHours +
          " tournament:" +
          tournament.key +
          " isActiveToday:" +
          isActiveToday
      );

      if (isActiveToday) {
        allPromises.push(
          tournament.ref.update({
            [RemainHours_Tournaments_DB]: curHours - 24,
          })
        );
      } else {
        allPromises.push(
          tournament.ref.update({
            isActiveToday: 1,
          })
        );
      }
    }
  });
  await Promise.all(allPromises);
}

// function IsDailyEvent(tournament: DataSnapshot): boolean {
//     const isMain = Boolean(tournament.child("isDailyEvent").val());
//     return isMain;
// }
// function IsZplnEvent(tournament: DataSnapshot): boolean {
//     const isMain = Boolean(tournament.child("isZplnEvent").val());
//     return isMain;
// }
// function IsJackpotEvent(tournament: DataSnapshot): boolean {
//     const isMain = Boolean(tournament.child("isJackpotEvent").val());
//     return isMain;
// }
// function IsHighScoreEvent(tournament: DataSnapshot): boolean {
//     const isMain = Boolean(tournament.child("isHighScoreEvent").val());
//     return isMain;
// }
// function IsAudienceEvent(tournament: DataSnapshot): boolean {
//     const isMain = Boolean(tournament.child("isAudienceEvent").val());
//     return isMain;
// }
function IsBrandEvent(tournament: DataSnapshot): boolean {
  const isBranded = Boolean(tournament.child("isBrandEvent").val());
  return isBranded;
}
function IsExhibitionEvent(tournament: DataSnapshot): boolean {
  return Boolean(tournament.child("isExhibitionEvent").val());
}

export function IsExhibitionAlphaEvent(tournament: DataSnapshot): boolean {
  const isExhibitionEvent = Boolean(
    tournament.child("isExhibitionEvent").val()
  );
  if (isExhibitionEvent) {
    const { entryLowerLimit, entryUpperLimit } =
      getTournamentEntryLimits(tournament);
    if (entryLowerLimit === 11 && entryUpperLimit === 11) return true;
  }
  return false;
}

function hasRenewal(tournament: DataSnapshot): boolean {
  const renewal = Boolean(tournament.child("autoRenewal").val());
  return renewal;
}

async function endedTournament(tournament: DataSnapshot): Promise<boolean> {
  const remainingHours = Number(
    tournament.child(RemainHours_Tournaments_DB).val()
  );
  const inHisto = await admin
    .database()
    .ref(Historic_Tournaments_DB + "/" + tournament.key)
    .once("value")
    .then((res) => {
      return res.exists();
    })
    .catch();
  const result = remainingHours <= 0; // || inHisto; ?? Porque hacer esto??
  console.log(
    tournament.key +
      " Ended? " +
      remainingHours +
      "<=0 || " +
      inHisto +
      " => " +
      result
  );
  return result;
}

// async function prizeTournamentAllocation(tournament: DataSnapshot): Promise<boolean> {
//     if (tournament.key === null) return false;

//     const numberOfPlayers = tournament.child(PlayerNumber_Tournaments_DB).val();
//     const numberOfPrizes = tournament.child(PrizesNumber_Tournaments_DB).val();
//     console.log("prizeTournamentAllocation numberOfPlayers:" + numberOfPlayers + " numberOfPrizes:" + numberOfPrizes);
//     if (numberOfPlayers > numberOfPrizes) {
//         const allPromise: any[] = [];
//         tournament.child(Player_Tournaments_DB).forEach((player) => {
//             console.log("prizeTournamentAllocation null prize passed to addPrizeToPlayer for tournament:" + tournament.key + " player:" + player.key);
//             allPromise.push(addPrizeToPlayer(tournament, { id: player.key, eventAverage: 0 }, null));
//         });
//         await Promise.all(allPromise);

//     }

//     let leaders: FirebaseFirestore.DocumentData[] = [];
//     if (IsDailyEvent(tournament) || IsBrandEvent(tournament) || IsZplnEvent(tournament)) {
//         leaders = await leaderboards.getEventLeaderboard(tournament.key, null, tournament.child(PrizesNumber_Tournaments_DB).val());
//     }
//     if (IsJackpotEvent(tournament)) {
//         leaders = await leaderboards.getJackpotLeaderboard(null, tournament.child(PrizesNumber_Tournaments_DB).val())
//     }

//     if (IsHighScoreEvent(tournament)) {
//         leaders = await leaderboards.getHighScoreLeaderboard(null, tournament.child(PrizesNumber_Tournaments_DB).val())
//     }
//     if (IsAudienceEvent(tournament)) {
//         leaders = await leaderboards.getAudienceLeaderboard(null, tournament.child(PrizesNumber_Tournaments_DB).val())
//     }
//     for (const player of leaders) {

//         if (player.id === undefined ||
//             player.Rank > tournament.child(PrizesNumber_Tournaments_DB).val())
//             continue;

//         console.log("prizeTournamentAllocation tournament:" + tournament.key + " player: " + player.key + " player.Rank:" + player.Rank);

//         const pr = createPrizeInfo(tournament, player.Rank);
//         // @ts-ignore
//         await addPrizeToPlayer(tournament, player, pr);
//     }
//     console.log("All Prize allocated for:" + tournament.key)
//     return true;
// }

// function createPrizeInfo(tournament: DataSnapshot, order: number): any {
//     let result = {
//         rank: order,
//         coins: 0,
//         cash: 0,
//         egift: ""
//     };
//     const prize = tournament.child("prizes/" + (order - 1)).toJSON();
//     result = { ...result, ...prize };
//     return result;
// }
// async function addPrizeToPlayer(tournament: DataSnapshot, user: any, prize: any) {
//     const url = Users_DB + "/" + user.id + "/" + Event_Finales_Users_DB + "/" + tournament.key;

//     const userEventData = await admin.database()
//         .ref(Users_DB + "/" + user.id).once('value')

//     const coinsValue = userEventData.child("vault/coinsValue").exists()
//         ? userEventData.child("vault/coinsValue").val()
//         : 0.0;
//     let totalCoins = 0;
//     userEventData.child(Tournaments_Users_DB + "/" + tournament.key + "/games").forEach((game) => {
//         totalCoins += game.child("coins").exists() ? game.child("coins").val() : 0.0;
//     });

//     const usersRef = admin.database().ref(url);
//     const brandColor = tournament.child("brandColor").exists() ? tournament.child("brandColor").val() : "123,123,123,123";
//     const hasPrize = prize !== null;
//     console.log("addPrizeToPlayer hasPrize:" + hasPrize + " tournament:" + tournament + " user:" + user);

//     if (user.Score === undefined)
//         user.Score = 0;

//     const finale = {
//         Score: user.Score,
//         totalCoins: totalCoins,
//         depositCash: totalCoins * coinsValue,

//         claimed: false,
//         hasPrize: hasPrize,
//         prize: prize,
//         eventType: tournament.child("eventType").val(),
//         prizeScreen: tournament.child("prizeScreen").val(),
//         SeriesAverage: user.eventAverage,
//         TournamentID: tournament.key,
//         TournamentName: tournament.child("name").val(),
//         TournamentLogo: tournament.child("brandLogoImage").val(),
//         brandColor: brandColor,
//         finaleBackground: tournament.child("brandLogoImage").exists()
//             ? tournament.child("brandLogoImage").val()
//             : ""

//     };
//     console.log(url + "\n" + JSON.stringify(finale));
//     await usersRef.update(finale);

//     // if (tournament.key!==null)
//     //     await acceptPlayerPrize(tournament.key, user.id); //AUTO_CLAIM
// }

const firstWeight = 0.07;
const stepWeight = 0.0025;
//const _firstCredits = 2000;
//const _creditsStep = 50;

const _creditsTable = [
  500, 425, 375, 325, 275, 250, 240, 230, 220, 210, 200, 190, 180, 170, 160,
  150, 140, 130, 120, 110, 100, 90, 80, 70, 60,
];

export async function precalculateCreditPrizeAllocation(
  tournamentId: string,
  jackpotTotal: number
) {
  const tournamentRef = admin
    .database()
    .ref(Active_Tournaments_DB + "/" + tournamentId);

  return tournamentRef
    .once("value")
    .then((tournament) => {
      const prizes = tournament.child("prizes");
      const creditsFromJackpot: { [k: string]: number } = {};

      console.log("Calculate prize: " + tournamentId + "  " + jackpotTotal);
      console.log("Prizes: " + prizes.numChildren());

      prizes.forEach((prize) => {
        const currentOrder = prize.child("rank").val() - 1;

        const factorCredits = jackpotTotal / 5000; // 5000 es el numero de creditos que suma toda la tabla
        creditsFromJackpot[currentOrder + "/credits"] =
          currentOrder >= _creditsTable.length
            ? 0
            : _creditsTable[currentOrder] * factorCredits;
        //                _firstCredits - (_creditsStep * currentOrder);
      });

      tournamentRef
        .child("prizes")
        .update(creditsFromJackpot)
        .then((z) => {
          console.log("Update Prizes Jackpot " + creditsFromJackpot);
        })
        .catch();

      console.log("Return TRUE from prizeAllocation");
      return true;
    })
    .catch();
}

export async function precalculateCoinsPrizeAllocation(
  tournamentId: string,
  jackpotTotal: number
) {
  const tournamentRef = admin
    .database()
    .ref(Active_Tournaments_DB + "/" + tournamentId);

  return tournamentRef
    .once("value")
    .then((tournament) => {
      const prizes = tournament.child("prizes");
      const coinsJackpot = jackpotTotal; //tournament.child("creditJackpot").val();
      const coinsFromJackpot: { [k: string]: number } = {};

      prizes.forEach((prize) => {
        const currentOrder = prize.child("rank").val() - 1;
        coinsFromJackpot[currentOrder + "/coins"] = +(
          coinsJackpot *
          (firstWeight - currentOrder * stepWeight)
        ).toFixed(2);
      });

      tournamentRef
        .child("prizes")
        .update(coinsFromJackpot)
        .then((z) => {
          console.log("Update Prizes Jackpot " + coinsFromJackpot);
        })
        .catch();

      console.log("Return TRUE from prizeAllocation");
      return true;
    })
    .catch();
}

export async function acceptPlayerPrize(
  tournamentId: string,
  playerId: string
): Promise<number> {
  const usersRef = admin.database().ref(Users_DB);
  const playerData = await usersRef.child(String(playerId)).once("value");
  if (!playerData.exists()) return -1;
  const eventFinale = playerData.child(
    Event_Finales_Users_DB + "/" + tournamentId + "/"
  );
  const claimed = Boolean(eventFinale.child(Event_Finales_Claimed).val());
  if (claimed) {
    console.log(
      "AcceptPlayerPrize " + tournamentId + "/" + playerId + " : " + claimed
    );
    return -2;
  }

  const coPrize = eventFinale.child("prize/coins").exists()
    ? eventFinale.child("prize/coins").val()
    : 0;
  const eGift = eventFinale.child("prize/egift").exists()
    ? eventFinale.child("prize/egift").val()
    : "";
  const cashPrize = eventFinale.child("prize/cash").exists()
    ? eventFinale.child("prize/cash").val()
    : "";

  console.log(
    "  Player " +
      playerId +
      "  coPrize: " +
      coPrize +
      "  egift: " +
      eGift +
      " cash: " +
      cashPrize
  );
  await usersRef.child(playerId).update({
    [Event_Finales_Users_DB + "/" + tournamentId + "/" + Event_Finales_Claimed]:
      true, //Set to accepted
  });

  const newCoins = await vault.AddCoinsToVault(playerId, coPrize);
  const newCash = await vault.AddCashToVault(playerId, cashPrize);

  const globalAvg = playerData.child(GlobalAverage_UserDB).exists()
    ? playerData.child(GlobalAverage_UserDB).val()
    : 0;
  console.log(
    "  Player " +
      playerId +
      " New Coins: " +
      newCoins +
      "  New Cash: " +
      newCash
  );

  await leaderboards.updateJackpotLeaderboard(playerId, globalAvg);
  return coPrize;
}

export async function getCurrentPhaseOfTournament(
  tournamentId: string
): Promise<number> {
  return admin
    .database()
    .ref(
      Active_Tournaments_DB +
        "/" +
        tournamentId +
        "/" +
        CurrentPhase_Tournament_DB
    )
    .once("value")
    .then((snapShot) => {
      console.log(snapShot.toJSON());
      return Number(snapShot.val());
    })
    .catch();
}

export async function getCurrentGameOfTournament(
  tournamentId: string,
  phaseId: number,
  userId: string
): Promise<number> {
  const refPath =
    Users_DB +
    "/" +
    userId +
    "/" +
    Tournaments_Users_DB +
    "/" +
    tournamentId +
    "/" +
    CurrentGameForUser_User_DB;
  console.log(">>" + refPath);
  return admin
    .database()
    .ref(refPath)
    .once("value")
    .then((snapShot) => {
      if (!snapShot.exists()) {
        console.log("No Current Game");
        return 1;
      }
      console.log("Current Game " + Number(snapShot.val()));
      return Number(snapShot.val());
    })
    .catch();
}

export async function getCurrentGameStateOfTournament(
  tournamentId: string,

  userId: string
): Promise<number> {
  const refPath =
    Users_DB +
    "/" +
    userId +
    "/" +
    Tournaments_Users_DB +
    "/" +
    tournamentId +
    "/" +
    CurrentGameStateForUser_User_DB;
  console.log(">>" + refPath);
  return admin
    .database()
    .ref(refPath)
    .once("value")
    .then((snapShot) => {
      if (!snapShot.exists()) {
        console.log("No Current Game State");
        return 1;
      }
      console.log(
        "Current Game State for " + userId + " " + Number(snapShot.val())
      );
      return Number(snapShot.val());
    })
    .catch();
}

export async function getPendingAcceptanceEventFinaleForUser(
  userId: string
): Promise<any> {
  const refUser = admin
    .database()
    .ref(Users_DB + "/" + userId + "/" + Event_Finales_Users_DB);

  return refUser
    .orderByChild(Event_Finales_Claimed)
    .equalTo(false)
    .once("value");
}

export async function calculateAverage(
  eventId: string,
  userId: string,
  gameId: number,
  isPregame: boolean = false
): Promise<any> {
  const userEventRef = admin
    .database()
    .ref(Users_DB + "/" + userId + "/" + Tournaments_Users_DB + "/" + eventId);

  const usEv = await userEventRef.once("value");
  let appliedGameId = gameId;

  // Pregame checks (existing logic)
  if (isPregame) {
    if (!usEv.exists()) {
      console.log(
        "   calculateAverage: isPregame! gameId: " +
          gameId +
          "no data avg=0, sum=0"
      );
      return {
        average: 0,
        total: 0,
        CurrentAttemptTotal: 0,
      };
    } else {
      console.log(
        "   calculateAverage: isPregame! gameId: " +
          gameId +
          "no data avg=" +
          usEv.child("average").val() +
          ", sum=" +
          usEv.child("total").val()
      );
      return {
        average: usEv.child("average").val() || 0,
        total: usEv.child("total").val() || 0,
        BestAttemptTotal: usEv.child("CurrentAttemptTotal").val() || 0,
      };
    }
  }

  let sum = 0;
  if (usEv.exists()) {
    console.log(
      "   calculateAverage: Event Exists! number of games: " +
        usEv.child("games").numChildren()
    );
    usEv.child("games").forEach((g) => {
      sum += g.child("highScore").val();
    });
  }

  const avg = Math.trunc(sum / appliedGameId);

  // Always update average and total
  await userEventRef.update({
    average: avg,
    CurrentAttemptTotal: sum,
  });

  // Only update BestAttemptTotal if new sum is greater than existing BestAttemptTotal
  const existingBest = usEv.child("total").val() || 0;
  var newBest = existingBest;
  if (sum > existingBest) {
    newBest = sum;
    await userEventRef.update({
      total: sum,
    });
  }

  return {
    average: avg,
    CurrentAttemptTotal: sum,
    total: newBest,
  };
}

// export async function calculateAverage(
//   eventId: string,
//   userId: string,
//   gameId: number,
//   isPregame: boolean = false
// ): Promise<any> {
//   const userEventRef = admin
//     .database()
//     .ref(Users_DB + "/" + userId + "/" + Tournaments_Users_DB + "/" + eventId);

//   const usEv = await userEventRef.once("value");
//   let appliedGameId = gameId;
//   if (isPregame) {
//     //appliedGameId--;
//     if (!usEv.exists()) {
//       console.log(
//         "   calculateAverage: isPregame! gameId: " +
//           gameId +
//           "no data avg=0, sum=0"
//       );
//       return {
//         average: 0,
//         total: 0,
//       };
//     } else {
//       console.log(
//         "   calculateAverage: isPregame! gameId: " +
//           gameId +
//           "no data avg=" +
//           usEv.child("average").val() +
//           ", sum=" +
//           usEv.child("total").val()
//       );
//       return {
//         average: usEv.child("average").val() || 0,
//         total: usEv.child("total").val() || 0,
//       };
//     }
//   }

//   let sum = 0;
//   if (usEv.exists()) {
//     console.log(
//       "   calculateAverage: Event Exists! number of games: " +
//         usEv.child("games").numChildren()
//     );
//     usEv.child("games").forEach((g) => {
//       sum += g.child("highScore").val();
//     });
//   }

//   const avg = Math.trunc(sum / appliedGameId); //Average using the number of games played
//   console.log(
//     "   calculateAverage: sum:" +
//       sum +
//       "  avg:" +
//       avg +
//       " gameId:" +
//       eventId +
//       " - " +
//       appliedGameId
//   );

//   // if (!isPregame)
//   //   await userEventRef.update({
//   //     average: avg,
//   //     total: sum,
//   //   });
//   // return {
//   //   average: avg,
//   //   total: sum,
//   // };


//    // Only update total if new sum is greater than existing total
//   const existingTotal = usEv.child("total").val() || 0;
//   if (sum > existingTotal) {
//     await userEventRef.update({
//       average: avg,
//       total: sum,
//     });
//   } else {
//     await userEventRef.update({
//       average: avg,
//     });
//   }

//   return {
//     average: avg,
//     total: sum > existingTotal ? sum : existingTotal,
//   };

// }

///THe iscompleted bool function

export async function setIsCompletedIfNeeded(
  userId: string,
  eventId: string
): Promise<void> {
  const userEventRef = admin
    .database()
    .ref(`${Users_DB}/${userId}/${Tournaments_Users_DB}/${eventId}`);
  const snapshot = await userEventRef.once("value");
  if (snapshot.exists()) {
    const currentGame = snapshot.child("currentGame").val() || 1;
    const currentAttempt = snapshot.child("currentAttempt").val() || 1;
    const totalAttemptsAllowed =
      snapshot.child("TotalAttempsAllowed").val() || 3;

    // Set isCompleted to true if currentAttempt == totalAttemptsAllowed and currentGame == 3
    if (currentAttempt === totalAttemptsAllowed && currentGame === 3) {
      await userEventRef.update({ isCompleted: true });
    }
  }
}

////

export async function addScoreToPlayer(
  eventId: string,
  phaseId: number,
  gameId: number,
  userId: string,
  highScore: number,
  credits: number,
  coins: number
): Promise<{
  currentGame: number;
  scorePosted: number;
  currentAttempt: number;
  seriesTotal: number;
  HasNextGame: boolean;
 CurrentGameZplnMinned: number;
  NeoZplnMined: number;
}> {
  const tournamentPhaseRef = admin
    .database()
    .ref(Users_DB + "/" + userId + "/" + Tournaments_Users_DB + "/" + eventId);

  const tournamentData = await admin
    .database()
    .ref(Active_Tournaments_DB + "/" + eventId)
    .once("value");
  const isExhibitionEvent = IsExhibitionEvent(tournamentData);

  let HasNextGamevar = true;

  //Add score to the event and game
  await tournamentPhaseRef.child("games/" + gameId).update({
    highScore: highScore,
    credits: credits,
    coins: coins,
  });
  const userRef = admin.database().ref(Users_DB + "/" + userId);
  const user = await userRef.once("value");

  
  const calculated = await calculateAverage(eventId, userId, gameId,false);
  let scorePosted = calculated.total;

  let newGlobalAvg = 0;
  let currentGame = 1;
  let currentAttempt = 1;
  //let isCompleted = false;

  // zpln defaults
  let CurrentGameZplnMinned = 0;
  let NeoZplnMined = 0;

  if (!isExhibitionEvent) {
    const currentHighest = user.child("highestScoreEver").exists()
      ? user.child("highestScoreEver").val()
      : 0;
    await userRef.update({
      highestScoreEver: highScore > currentHighest ? highScore : currentHighest,
    });

    //update current game

    const userEventRef = admin
      .database()
      .ref(`${Users_DB}/${userId}/${Tournaments_Users_DB}/${eventId}`);
    const snapshot = await userEventRef.once("value");
    if (snapshot.exists()) {
      currentGame = snapshot.child("currentGame").val();
      currentAttempt = snapshot.child("currentAttempt").val();
      const totalAttemptsAllowed =
        snapshot.child("TotalAttempsAllowed").val();
     // isCompleted = snapshot.child("isCompleted").val() || false;

      if (gameId < 3){ currentGame = gameId + 1;}

      else  {
        currentGame = 1;
        if (currentAttempt < totalAttemptsAllowed) {
          currentAttempt += 1;
          // Reset all 3 games' highScore, credits, and coins to 0 if currentGame is reset to 1
          const resetPromises = [];
          for (let i = 1; i <= 3; i++) {
            resetPromises.push(
              userEventRef.child(`games/${i}`).update({
                highScore: 0,
              })
            );
          }
          await Promise.all(resetPromises);
        } else {
          currentGame = 0;
        }
      }

      await userEventRef.update({
        currentGame,
        currentAttempt,
      });

      if (currentAttempt === totalAttemptsAllowed && currentGame === 0) {
        HasNextGamevar = false;
      }

      await tournamentPhaseRef.child("games/" + gameId).update({
        gameState: 2, // Mark current game as finished
      });
    }
    ///

    // Add coins and capture zpln mined result
    try {
      const vaultResult = await vault.AddCoinsToVault(userId, coins);
      if (typeof vaultResult === "number") {
        // legacy/err numeric response
        if (vaultResult > 0) {
          // treat positive number as CurrentGameZplnMinned (legacy)
          CurrentGameZplnMinned = Number(vaultResult);
          const vSnap = await admin
            .database()
            .ref(`${Users_DB}/${userId}/${vault.Vault_User_DB}`)
            .once("value");
          NeoZplnMined = Number(vSnap.child(vault.ZplnMinned_Vault_User_DB).val() || 0);
        } else {
          // 0 or negative -> leave defaults (0) and log negative error
          if (vaultResult < 0) console.error("AddCoinsToVault returned error:", vaultResult, "user:", userId);
        }
      } else if (vaultResult && typeof vaultResult === "object") {
        // expected shape: { updatedCoins, CurrentGameZplnMinned, NeoZplnMined } or { updatedCoins, zplnAdded, zplnTotal }
        CurrentGameZplnMinned = Number(vaultResult.CurrentGameZplnMinned ?? vaultResult.CurrentGameZplnMinned ?? 0);
        NeoZplnMined = Number(vaultResult.NeoZplnMined ?? vaultResult.NeoZplnMined ?? 0);
      } else {
        // fallback: read from DB
        const vSnap = await admin
          .database()
          .ref(`${Users_DB}/${userId}/${vault.Vault_User_DB}`)
          .once("value");
        NeoZplnMined = Number(vSnap.child(vault.ZplnMinned_Vault_User_DB).val() || 0);
      }
    } catch (err) {
      console.error("Error during AddCoinsToVault:", err);
    }

    newGlobalAvg = await leaderboards.updateGlobalAverage(userId, highScore);


    // recalc user's miningRate because play rank (globalAverage) changed
// await vault.calculateAndUpdateMiningRateForUser(userId).catch((err) => {
//   console.error("Failed to update mining rate for user after score:", userId, err);
// });

// // optionally update ancestors if you expect playRank change to affect ancestors' miningRate
// await vault.updateMiningRateForAncestors(userId).catch((err) => {
//   console.error("Failed to update mining rate for ancestors of:", userId, err);
// });

    await leaderboards.updateEventLeaderboard(
      userId,
      eventId,
      calculated.total,
      newGlobalAvg
    );

    await leaderboards.updateJackpotLeaderboard(userId, newGlobalAvg);
    await leaderboards.updateHighScoreLeaderboard(
      userId,
      highScore,
      newGlobalAvg
    );
    // await user_utils.incrementNumberOfGamesPlayedCurrentWeek(userId);
  } else {
    const lastPostedScore =
      await leaderboards.getPlayerScoreFieldValueFromLeaderboard(
        eventId,
        userId,
        "total"
      );
    if (calculated.total > lastPostedScore) {
      if (IsExhibitionAlphaEvent(tournamentData))
        await leaderboards.updateExhibitionAlphaEventLeaderboard(
          userId,
          eventId,
          calculated.total,
          0
        );
      else
        await leaderboards.updateExhibitionEventLeaderboard(
          userId,
          eventId,
          calculated.total,
          0
        );
    } else scorePosted = lastPostedScore;
  }
  await audience.addResetAudiencePointsToGenealogy(userId, 0, 0);
  await audience.addAudiencePointsToGenealogy(userId, 0, false, newGlobalAvg);

  //following should happen right before returning from the function
  await resetExhibitionGameIfCountIsMoreThan3(eventId, userId);
  return {
    currentGame: currentGame,
    scorePosted: scorePosted,
    currentAttempt: currentAttempt,
    seriesTotal: calculated.total,
    HasNextGame: HasNextGamevar,
    CurrentGameZplnMinned: CurrentGameZplnMinned,
    NeoZplnMined: NeoZplnMined,
   
  };
}
////////CurrentGameStatusOfEvent_Start

export async function CurrentGameStatusOfEvent(
  userId: string,
  eventId: string
): Promise<{
  currentGame: number;
  currentAttempt: number;
  HasNextGame: boolean;
}> {
  const userEventRef = admin
    .database()
    .ref(`${Users_DB}/${userId}/${Tournaments_Users_DB}/${eventId}`);
  const snapshot = await userEventRef.once("value");
  let currentGame = 1;
  let currentAttempt = 1;
  let totalAttemptsAllowed = 3;
  let isCompleted = false;

  if (snapshot.exists()) {
    currentGame = snapshot.child("currentGame").val() || 1;
    currentAttempt = snapshot.child("currentAttempt").val() || 1;
    totalAttemptsAllowed = snapshot.child("TotalAttempsAllowed").val() || 3;
    isCompleted = snapshot.child("isCompleted").val() || false;
  }

  let HasNextGame =
    !(currentAttempt === totalAttemptsAllowed && currentGame === 0) ||
    !isCompleted;

  return { currentGame, currentAttempt, HasNextGame };
}

/////////CurrentGameStatusOfEvent _END

export async function resetExhibitionGameIfCountIsMoreThan3(
  eventId: string,
  userId: string
): Promise<void> {
  const tournamentPhaseRef = admin
    .database()
    .ref(Users_DB + "/" + userId + "/" + Tournaments_Users_DB + "/" + eventId);

  const tournamentData = await admin
    .database()
    .ref(Active_Tournaments_DB + "/" + eventId)
    .once("value");

  const isExhibitionEvent = IsExhibitionEvent(tournamentData);

  const gameId = (
    await tournamentPhaseRef.child("currentGame").once("value")
  ).val();
  console.log("resetExhibitionGameIfCountIsMoreThan3 gameId:" + gameId);
  if (isExhibitionEvent) {
    if (gameId > 3) {
      await tournamentPhaseRef.child("games").remove();
      await tournamentPhaseRef.update({ total: 0 });
      await tournamentPhaseRef.update({ average: 0 });
      await tournamentPhaseRef.update({ currentGame: 1 });

      // var setsPlayedCountSS = await tournamentPhaseRef.child("gameSetsPlayed").once('value');
      var setsPlayedCount = (
        await tournamentPhaseRef.child("gameSetsPlayed").once("value")
      ).val();
      if (setsPlayedCount == null) {
        await tournamentPhaseRef.update({ gameSetsPlayed: 1 });
      } else {
        setsPlayedCount++;
        await tournamentPhaseRef.update({ gameSetsPlayed: setsPlayedCount });
      }
    }
  }
}

export async function getHighScoreForTournament(
  tournamentId: string,
  userId: string
): Promise<number> {
  //let qualDB = admin.database().refFromURL(Qualification_DB);
  let currentHighScore: number = -1;
  return admin
    .database()
    .ref(
      Users_DB + "/" + userId + "/" + Tournaments_Users_DB + "/" + tournamentId
    )
    .once("value")
    .then((snapShot) => {
      snapShot.forEach((score) => {
        const nScore = score.child("highScore").val();

        if (nScore > currentHighScore) {
          currentHighScore = nScore;
        }
      });
      return currentHighScore;
    })
    .catch();
}

export async function getTournamentData(tournamentId: string): Promise<any> {
  const tournamentData = await admin
    .database()
    .ref(Active_Tournaments_DB + "/" + tournamentId)
    .once("value");
  if (!tournamentData.exists()) return null;
  else return tournamentData.val();
}

export function getTournamentEntryLimits(tournamentData: DataSnapshot): any {
  if (!tournamentData.exists()) return false;

  const tournamentDataValue = tournamentData.val();
  const entryLowerLimit = tournamentDataValue[ENTRY_ALLOWED_PARAM][LOWER_LIMIT];
  const entryUpperLimit = tournamentDataValue[ENTRY_ALLOWED_PARAM][UPPER_LIMIT];
  return { entryLowerLimit: entryLowerLimit, entryUpperLimit: entryUpperLimit };
}

//#region Event Actions
export async function joinTournament(
  tournamentId: string,
  userId: string
): Promise<number> {
  const tournamentData = await admin
    .database()
    .ref(Active_Tournaments_DB + "/" + tournamentId)
    .once("value");
  if (!tournamentData.exists()) return 1;

  const tournamentDataValue = tournamentData.val();

  // check for only one Exhibition joining
  if (tournamentDataValue.isExhibitionEvent) {
    console.log("---------------ExhibitionEvent");
    if (await user_utils.hasUserJoinedExhibitionEvent(userId)) {
      console.log("---------------user has already joined");
      return 2;
    }
  }

  const entryLowerLimit = tournamentDataValue[ENTRY_ALLOWED_PARAM][LOWER_LIMIT];
  const entryUpperLimit = tournamentDataValue[ENTRY_ALLOWED_PARAM][UPPER_LIMIT];

  let playerLevel = await user_utils.getLevel(userId);
  console.log("playerLevel in int:" + playerLevel);
  console.log(
    "entryLowerLimit:" + entryLowerLimit + " entryUpperLimit:" + entryUpperLimit
  );
  //check if player satisfies the required rank/level for the event
  if (!(playerLevel >= entryLowerLimit && playerLevel <= entryUpperLimit)) {
    return 1;
  }

  //check if user has enough coins to enter a sponsored event
  if (await IsBrandEvent(tournamentData)) {
    const checked = await checkJoinRequirements(tournamentData, userId);
    console.log(
      "User: " +
        userId +
        " Join event: " +
        tournamentId +
        " Checked: " +
        checked
    );
    if (!checked) {
      console.warn("User: " + userId + " Cannot Join event: " + tournamentId);
      return 5;
    }
  }

  const tRef = admin.database().ref(Active_Tournaments_DB + "/" + tournamentId);
  await tRef.child(PlayerNumber_Tournaments_DB).transaction((numPl) => {
    return numPl + 1;
  });
  await tRef.update({ [Player_Tournaments_DB + "/" + userId]: true });

  const result = await removeCoinsJoinTournament(tournamentData, userId);
  //set default total attempts if not set
  let totalattempts = tournamentData.child("totalAttemptsAllowed").val();
  if (totalattempts === null || totalattempts === undefined) {
    totalattempts = 3; // Hardcoded to 3 if not set
    console.log(
      "Setting default totalAttemptsAllowed to 3 for tournament: " +
        tournamentId
    );
    await admin
      .database()
      .ref(Active_Tournaments_DB + "/" + tournamentData.key)
      .update({ totalAttemptsAllowed: 3 });
  }

  console.log(
    "Result of remove Credits for " +
      userId +
      " from event: " +
      tournamentId +
      " : " +
      result
  );
  if (result) {
    await admin
      .database()
      .ref(
        Users_DB +
          "/" +
          userId +
          "/" +
          Tournaments_Users_DB +
          "/" +
          tournamentData.key
      )
      .update(
        {
          eventName: tournamentData.child("name").val(),
          eventUrl: tournamentData.child("creditprizeScreen").val(),
          joinTimestamp: Date.now(),
          TotalAttempsAllowed: totalattempts,
          currentAttempt: 1,
          currentGame: 1,
        },
        (error) => {
          if (error !== null)
            console.error(
              "Error in update join Event (" +
                tournamentId +
                "):" +
                error.message
            );
        }
      );
  }
  return result == true ? 0 : 1;
}

async function checkJoinRequirements(
  tournamentSnapshot: DataSnapshot,
  userId: string
): Promise<boolean> {
  const cost = tournamentSnapshot.child(CoinsCost_Tournaments_DB).val();
  //let minLvl = tournamentSnapshot.child("minimumLevel").val();

  //let maxLvl = tournamentSnapshot.child("maximumLevel").val();
  //if (maxLvl===-1) maxLvl=1000;
  const playerIn = tournamentSnapshot.child("Players/" + userId).exists();
  console.log(
    "Check Join: " +
      userId +
      " to " +
      tournamentSnapshot.key +
      ": " +
      cost +
      " & " +
      playerIn
  );
  return admin
    .database()
    .ref(Users_DB + "/" + userId + "/" + Coins_Users_DB)
    .once("value")
    .then((userData) => {
      if (!userData.exists()) return false;

      const userCoins = userData.val();
      return userCoins >= cost && !playerIn;
    })
    .catch((err) => {
      console.error("Check Join for " + userId + ":" + err);
      return false;
    });
}

async function removeCoinsJoinTournament(
  tournamentSnapshot: DataSnapshot,
  userId: string
): Promise<boolean> {
  const cost = tournamentSnapshot.child(CoinsCost_Tournaments_DB).val();

  await admin
    .database()
    .ref(Users_DB + "/" + userId + "/" + Coins_Users_DB)
    .ref.transaction((currCoins) => {
      return currCoins - cost;
    });
  return true;
}

export async function startTournamentGame(
  eventId: string,
  userId: string
): Promise<any> {
  if ((await utils.checkUserId(userId)) === 0)
    return { state: -3, msg: "No userId: " + userId };
  if ((await utils.checkActiveEventId(eventId)) === 0)
    return { state: -1, msg: "Event " + eventId + " not active" };

  await resetExhibitionGameIfCountIsMoreThan3(eventId, userId);

  const tournamentUserRef = admin
    .database()
    .ref(Users_DB + "/" + userId + "/" + Tournaments_Users_DB + "/" + eventId);
  const tournamentData = await tournamentUserRef.once("value");

  let gameId = 1;
  let currentAttempt = 1;
  let totalAttemptsAllowed = 3;
  //let isCompleted = false;

  if (tournamentData.exists()) {
    if (tournamentData.child("currentGame").exists())
      gameId = tournamentData.child("currentGame").val();

    if (tournamentData.child("currentAttempt").exists())
      currentAttempt = tournamentData.child("currentAttempt").val();

    if (tournamentData.child("TotalAttempsAllowed").exists())
      totalAttemptsAllowed = tournamentData.child("TotalAttempsAllowed").val();

   
  }

  // Set gameState to 1 (started) for the current game
  await tournamentUserRef.child("games/" + gameId).update({
    gameState: 1,
    highScore: 0,
    coins: 0,
  });
  

  // Calculate average and total for the event
  const calculated = await calculateAverage(eventId, userId, gameId, false);

 

  // HasNextGame logic

  let nextgame = gameId + 1;
  let HasNextGame = !(currentAttempt === totalAttemptsAllowed && nextgame > 3);

  return {
    currentGame: gameId,
    currentAttempt: currentAttempt,
    HasNextGame: HasNextGame,
    average: calculated.average,
    total: calculated.total,
    CurrentAttemptTotal: calculated.CurrentAttemptTotal,
  };
}

// export async function startTournamentGame(
//   eventId: string,
//   userId: string
// ): Promise<any> {
//   if ((await utils.checkUserId(userId)) === 0)
//     return { state: -3, msg: "No userId: " + userId };
//   if ((await utils.checkActiveEventId(eventId)) === 0)
//     return { state: -1, msg: "Event " + eventId + " not active" };

//   await resetExhibitionGameIfCountIsMoreThan3(eventId, userId);

//   const tournamentUserRef = admin
//     .database()
//     .ref(Users_DB + "/" + userId + "/" + Tournaments_Users_DB + "/" + eventId);
//   const tournamentData = await tournamentUserRef.once("value");

//   let gameId = 1;
//   let currentAttempt = 1;
//   let totalAttemptsAllowed = 3;
//   let HasNextGamevar = true;

//   if (tournamentData.exists()) {
//     if (tournamentData.child("currentGame").exists())
//       gameId = tournamentData.child("currentGame").val();
//     if (tournamentData.child("currentAttempt").exists())
//       currentAttempt = tournamentData.child("currentAttempt").val();
//     if (tournamentData.child("TotalAttempsAllowed").exists())
//       totalAttemptsAllowed = tournamentData.child("TotalAttempsAllowed").val();
//   }

//   const tournamentEventSS = await admin
//     .database()
//     .ref(Active_Tournaments_DB + "/" + eventId)
//     .once("value");
//   const isExhibitionsEvent = IsExhibitionEvent(tournamentEventSS);
//   console.log("startTournamentGame - isExhibitionsEvent:" + isExhibitionsEvent);

//   if (!isExhibitionsEvent) {
//     if (gameId > 3) {
//       console.error(
//         "Number of games exceded for userId: " +
//           userId +
//           " eventId: " +
//           eventId +
//           " gameId: " +
//           gameId
//       );
//       return {
//         state: -4,
//         msg:
//           "Number of games exceded for userId: " +
//           userId +
//           " eventId: " +
//           eventId +
//           " gameId:" +
//           gameId,
//       };
//     }
//   }

//   // Add score to the event and game
//   return tournamentUserRef
//     .child("games/" + gameId)
//     .update({
//       highScore: 0,
//       coins: 0,
//     })
//     .then(async () => {
//       // Increment logic for currentGame and currentAttempt
//       if (gameId < 3) {
//         gameId += 1;
//       } else {
//         gameId = 1;
//         if (currentAttempt < totalAttemptsAllowed) {
//           currentAttempt += 1;
//           // Reset all 3 games' highScore and coins to 0 if currentGame is reset to 1
//           const resetPromises = [];
//           for (let i = 1; i <= 3; i++) {
//             resetPromises.push(
//               tournamentUserRef.child(`games/${i}`).update({
//                 highScore: 0,
//                 coins: 0,
//               })
//             );
//           }
//           await Promise.all(resetPromises);
//         } else {
//           gameId = 0;
//         }
//       }

//       await tournamentUserRef.update({
//         currentGame: gameId,
//         currentAttempt: currentAttempt,
//       });

//       if (currentAttempt === totalAttemptsAllowed && gameId === 0) {
//         HasNextGamevar = false;
//       }

//       return {
//         state: 0,
//         msg: gameId,
//         currentAttempt,
//         HasNextGame: HasNextGamevar,
//       };
//     })
//     .catch((err) => {
//       console.error("StartTournamentError " + err);
//       return {
//         state: -1,
//         msg:
//           "Error updating userId: " +
//           userId +
//           " eventId: " +
//           eventId +
//           " gameId: " +
//           gameId +
//           " with " +
//           err,
//       };
//     });
// }

// export async function startTournamentGame(eventId: string,
//     userId: string): Promise<any> {

//     if (await utils.checkUserId(userId) === 0) return { state: -3, msg: "No userId: " + userId };
//     if (await utils.checkActiveEventId(eventId) === 0) return { state: -1, msg: "Event " + eventId + " not active" };

//     await resetExhibitionGameIfCountIsMoreThan3(eventId, userId);

//     const tournamentUserRef = admin.database()
//         .ref(Users_DB + '/' + userId + '/' + Tournaments_Users_DB + '/' + eventId);
//     const tournamentData = await tournamentUserRef.once('value');

//     let gameId = 1;

//     if (tournamentData.exists() && tournamentData.child("currentGame").exists())
//         gameId = tournamentData.child("currentGame").val();

//     const tournamentEventSS = (await admin.database().ref(Active_Tournaments_DB + "/" + eventId)
//         .once('value'));
//     const isExhibitionsEvent = IsExhibitionEvent(tournamentEventSS);
//     console.log("startTournamentGame - isExhibitionsEvent:" + isExhibitionsEvent);

//     if (!isExhibitionsEvent) {
//         if (gameId > 3) {
//             console.error("Number of games exceded for userId: " + userId + " eventId: " + eventId + " gameId: " + gameId);
//             return {
//                 state: -4,
//                 msg: "Number of games exceded for userId: " + userId + " eventId: " + eventId + " gameId:" + gameId
//             }
//         }
//     }

//     //Add score to the event and game
//     return tournamentUserRef.child("games/" + gameId)
//         .update({
//             highScore: 0,
//             coins: 0
//         })
//         .then(() => {
//             if(gameId<3){
//  gameId += +1;
//             }
//             else{
//                 gameId = 1;
//             }

//             return tournamentUserRef
//                 .update({
//                     currentGame: gameId
//                 }).then(() => {
//                     return { state: 0, msg: gameId }
//                 }).catch((err) => {
//                     console.error("StartTournamentError " + err);
//                     return {
//                         state: -1,
//                         msg: "Error updating userId: " + userId + " eventId: " + eventId + " gameId: " + gameId + " with " + err
//                     };
//                 });

//         }).catch((err) => {
//             console.error("StartTournamentError " + err);
//             return {
//                 state: -1,
//                 msg: "Error creating empty data userId: " + userId + " eventId: " + eventId + " gameId: " + gameId + " with " + err
//             };

//         });
// }
//#endregion

/*export async function currentTournamentStateForUser(tournamentId: string, userId: string): Promise<Object|null> {
    const uRef = admin.database().ref(Users_DB+'/'+userId+"/"+Tournaments_Users_DB+'/'+tournamentId);
    return uRef.once('value').then((info)=>
    {
        if (!info.exists()) return null;

        // @ts-ignore
        return info.toJSON();
    }).catch();
}*/

export async function currentProfilePictureForUser(
  userId: string
): Promise<string> {
  const uRef = admin.database().ref(Users_DB + "/" + userId);

  return uRef
    .once("value")
    .then((user) => {
      return !user.child("SavedAvatarURL").exists()
        ? ""
        : user.child("SavedAvatarURL").val();
    })
    .catch((err) => {
      console.error("Get Profile Pic for " + userId + ": " + err);
      return "";
    });
}

export function sortEventsBasedOnTimeRemaining(
  arr: DataSnapshot[]
): DataSnapshot[] {
  arr.sort((a, b) => {
    const eventIdA = a.child("remainsHours").val();
    const eventIdB = b.child("remainsHours").val();

    if (eventIdA < eventIdB) {
      return -1; // a should come before b
    } else if (eventIdA > eventIdB) {
      return 1; // a should come after b
    } else {
      return 0; // order remains unchanged
    }
  });

  return arr;
}

export function setTimeRemainingForEvents(arr: any[]): any[] {
  let currentTime = new Date();

  arr.forEach((element) => {
    let eventStartTimeUtc = new Date(element.startDate); //6/4/2023, 11:30:02 AM
    let eventStartTimePstString = eventStartTimeUtc.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
    });
    let eventStartTimePst = new Date(eventStartTimePstString);

    const eventDayStartTimePst = new Date(eventStartTimePst);
    eventDayStartTimePst.setHours(0);
    eventDayStartTimePst.setMinutes(0);
    eventDayStartTimePst.setSeconds(0);

    if (eventStartTimePst.getTime() > eventDayStartTimePst.getTime()) {
      eventDayStartTimePst.setDate(eventDayStartTimePst.getDate() + 1);
    }

    const eventDayStartTimeUtc = new Date(eventDayStartTimePst);
    eventDayStartTimeUtc.setHours(eventDayStartTimeUtc.getHours() + 7);

    let timeRemainingInSeconds = Math.floor(
      (eventDayStartTimeUtc.getTime() - currentTime.getTime()) / 1000
    );
    if (timeRemainingInSeconds < 0) {
      timeRemainingInSeconds = 0;
    }
    // else
    // {
    //     let name = element.child("name").val();
    //     let hr = timeRemainingInSeconds/(60*60);
    //     let min = (timeRemainingInSeconds%(60*60))/60;
    //     console.log(eventStartTimeUtc + "======" + name + " " + timeRemainingInSeconds + " " + hr + " " +  min);
    // }

    // // if(!element.child("startDate").val())
    // // return;

    element.timeRemainingInSeconds = timeRemainingInSeconds;
  });
  return arr;
}

export async function setDailyResetState(stateCode: number) {
  const parametersRef = await admin.database().ref(GameParameters_DB);
  await parametersRef.update({ [DAILY_RESET_STATUS]: stateCode });
}

export async function getGameplayCount(
  userId: string,
  eventId: string
): Promise<number> {
  const tournamentPhaseRef = admin
    .database()
    .ref(Users_DB + "/" + userId + "/" + Tournaments_Users_DB + "/" + eventId);
  var setsPlayedCount = await getGameSetCompletedCount(userId, eventId);
  var currentGame = (
    await tournamentPhaseRef.child("currentGame").once("value")
  ).val();
  console.log(
    "getGameplayCount xxx setsPlayedCount:" +
      setsPlayedCount +
      " currentGame:" +
      currentGame
  );
  return 3 * setsPlayedCount + currentGame;
}

export async function getGameSetCompletedCount(
  userId: string,
  eventId: string
): Promise<number> {
  const tournamentPhaseRef = admin
    .database()
    .ref(Users_DB + "/" + userId + "/" + Tournaments_Users_DB + "/" + eventId);
  var setsPlayedCount = (
    await tournamentPhaseRef.child("gameSetsPlayed").once("value")
  ).val();
  if (setsPlayedCount === null) setsPlayedCount = 0;
  return setsPlayedCount;
}

export async function getNextExhibitionGameSongName(
  userId: string,
  eventId: string
): Promise<string> {
  let gameCount = await getGameplayCount(userId, eventId);
  console.log(
    "getNextExhibitionGameSongName raw gameCount fetched:" + gameCount
  );
  if (gameCount === null || gameCount < 1) gameCount = 1;
  const index = (gameCount - 1) % 12;
  console.log(
    "getNextExhibitionGameSongName index:" + index + " gameCount:" + gameCount
  );
  const game = await practice_games.getPracticeGameFromGameIndex(index);
  return game.nextSongUrl;
}
