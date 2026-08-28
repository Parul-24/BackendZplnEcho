import { appOptions } from "./environments";
import * as admin from 'firebase-admin'

import * as tournament from "./tournament";
import {
    getCurrentAudienceEventRunning,
    getCurrentCoinBasedEventRunning,
    getCurrentHighScoreEventRunning,
    getCurrentJackpotEventRunning
} from "./tournament_cards";

import * as vault from './vault'
import * as utils from "./utils";
import * as user_utils from "./user_utils";

import * as storage  from 'firebase-admin/storage';
const ExcelJS = require('exceljs');

const Table = require('cli-table3');

export const HighScore_Leaderboard = "highscore_leaderboard";
const HighScore_Field = "highscore";

export const Audience_Leaderboard = "audience_leaderboard";
export const Audience_Field = "audience";

export const Jackpot_Leaderboard = "jackpot_leaderboard";
const Jackpot_Field = "globalAverage";

export const CoinBased_Leaderboard = "coinBased_leaderboard";
const CoinBased_Field = "coins";


const Event_Field = "total"; //"average"

export enum Leaderboard_Type { BestSeries = 0, Jackpot = 1, Audience = 2, HighScore = 3, CoinBased = 4, Exhibition = 5, ExhibitionAlpha = 6}

const Leaderboard_Template = {
    Rank: 0,
    Name: "",
    Score: 0,
   prize: {
        coins: 0,
        coinsValue: 0,
        cash: 0,
        egift: "",
        bonk: 0,
        zdlt: 0,
        digi: 0,
        pvs: 0,
        maka: 0
    },
    vault: {
        coins: 0,
        cash: 0,
        lira: 0
    },
    audiencePoints: 0,
    //CoinValue: 0.0,
    PlayerThumbnail: "",
    LeaderboardType: Leaderboard_Type.BestSeries,
    status: "",
    Game1: 0,
    Game2: 0,
    Game3: 0,
    eventAverage: 0.0,
    isPlaceholder: 0
};

// const naro = "+917728917858";
// const ty = "+12149098676";
// const marro = "+15165082789";
// const bombae = "+18183264923";


let listOfPhoneNumbersToIgnoreFromLeaderboard: string[] = [];//[ty, marro];
let listOfPhoneNumbersToIgnoreFromSponsoredLeaderboard: string[] = [];//[ty, naro, marro, bombae];
let listOfPhoneNumbersToIgnoreFromExhibitionLeaderboard: string[] = [];//[ty, naro, marro];
let listOfPhoneNumbersToIgnoreFromExhibitionAlphaLeaderboard: string[] = [];//[];
let listOfPhoneNumbersToIgnoreFromHighscoreLeaderboard: string[] = [];//[ty, naro, marro];
let listOfPhoneNumbersToIgnoreFromJackpotLeaderboard: string[] = [];//[ty, naro, marro];
let listOfPhoneNumbersToIgnoreFromCoinbasedLeaderboard: string[] = [];//[ty, naro, marro];
let listOfPhoneNumbersToIgnoreFromWavescoreLeaderboard: string[] = [];//[ty, naro, marro];

export async function createFakeHighScore(count: number): Promise<boolean> {
    const fsDB = admin.firestore();
    let batch = fsDB.batch();
    for (let i = 1; i < count; i++) {
        const idVal = 'FAKE-' + i;
        let refDB = fsDB.collection(HighScore_Leaderboard)
            .doc(idVal);
        batch.set(refDB, {
            id: idVal, highscore: Math.trunc(Math.random() * 45000), name: idVal
        });
        if (i % 500 === 0) {
            await batch.commit();
            batch = fsDB.batch();
        }
    }
    await batch.commit();
    return true;
}

async function updatePlayerScoreInLeaderboard(leaderboard: string, uid: string, scoreField: string, score: number, addIt: boolean = true, globalAvg: number): Promise<any> {
    const fsDB = admin.firestore();
    const colRef = fsDB.collection(leaderboard);
    const counter = await colRef.doc("counter").get();

    const player = await colRef.doc(uid).get();

    console.log("Update Score in " + leaderboard + " for user " + uid + " field: " + scoreField + " value=" + score);
    let scoreFieldFinal = scoreField === "globalAverage" ? "globalAverage_Score" : scoreField;

    if (player.exists) {
        const newScore = addIt ? player.get(scoreFieldFinal) + score : score;
        console.log("updatePlayerScoreInLeaderboard uid: " + uid + " leaderboard:" + leaderboard + " newScore:" + newScore);

        await player.ref.update({
            [scoreFieldFinal]: newScore,
            globalAverage: globalAvg
        }
        );
        return newScore;
    } else {
        if (counter.exists) {
            const curCount = counter.get("count");
            await counter.ref.update({ count: curCount + 1 });
        } else {
            await colRef.doc("counter").set({ count: 1 });
        }

        await colRef.doc(uid).set({
            id: uid,
            [scoreFieldFinal]: score,
            globalAverage: globalAvg
        });
    }
}

// async function updatePlayerCoinsInLeaderboard(leaderboard: string, uid: string, scoreField: string, score: number, addIt: boolean = true, globalAvg: number): Promise<any> {
//     const fsDB = admin.firestore();
//     const colRef = fsDB.collection(leaderboard);
//     // const counter = await colRef.doc("counter").get();
//     // const player = await colRef.doc(uid).get();

//     console.log("Update Score in " + leaderboard + " for user " + uid + " field: " + scoreField + " value=" + score);
//     let scoreFieldFinal = scoreField;

//     await colRef.doc("counter").set({ count: 1 });
//     await colRef.doc(uid).set({
//         id: uid,
//         [scoreFieldFinal]: score,
//         globalAverage: globalAvg
//     });
// }

export async function getPlayerScoreFieldValueFromLeaderboard(leaderboard: string, uid: string, scoreField: string): Promise<number> {
    const fsDB = admin.firestore();
    const colRef = fsDB.collection(leaderboard);
    const player = await colRef.doc(uid).get();
    let scoreFieldValue = 0;
    if (player.exists) {
        scoreFieldValue = player.get(scoreField);
    } 
    return scoreFieldValue;
}

export async function getPlayerAnyLeaderboardRank(leaderboard: string, uid: string): Promise<any> {
    let scoreField = "total";
    let leaderboardFinal = leaderboard;
    let leaderboardType = Leaderboard_Type.BestSeries;

    let eventId = await getCurrentJackpotEventRunning();
    if ((leaderboard === Jackpot_Leaderboard)
        ||
        (eventId !== null && eventId.key === leaderboard)) {
        scoreField = Jackpot_Field;
        leaderboardFinal = Jackpot_Leaderboard;
        leaderboardType = Leaderboard_Type.Jackpot;
    } else {
        eventId = await getCurrentHighScoreEventRunning();
        if ((leaderboard === HighScore_Leaderboard)
            ||
            (eventId !== null && eventId.key === leaderboard)) {
            scoreField = HighScore_Field;
            leaderboardFinal = HighScore_Leaderboard
            leaderboardType = Leaderboard_Type.HighScore;
        } else {
            eventId = await getCurrentAudienceEventRunning();
            if ((leaderboard === Audience_Leaderboard)
                ||
                (eventId !== null && eventId.key === leaderboard)) {
                scoreField = Audience_Field;
                leaderboardFinal = Audience_Leaderboard;
                leaderboardType = Leaderboard_Type.Audience;
            }
        }
    }
    console.log("Using: " + scoreField + " for " + leaderboardFinal + "(" + leaderboard + ")");

    return await getPlayerLeaderboardRank(leaderboardFinal, scoreField, uid, leaderboardType);
}

export async function getPlayerLeaderboardRank(leaderboard: string, scoreField: string, uid: string,
    leaderboardType: Leaderboard_Type): Promise<any> {
    const fsDB = admin.firestore();
    const colRef = fsDB.collection(leaderboard);
    const player = await colRef.doc(uid).get();
    const counter = await colRef.doc("counter").get();

    const currentRank = !counter.exists ? -1 : counter.get("count");
    let result = {
        Rank: currentRank,
        Score: 0,
        player: undefined
    };

    if (player.exists) {
        const hs = player.get(scoreField);
        const orderSnap = await colRef.where(scoreField, '>=', hs).select('id').get();
        result.Rank = orderSnap.size;
        result.Score = hs;
        // @ts-ignore
        //result = {...result,... await getPlayerInfo(uid,leaderboard)};
        result = await populatePlayerLeaderboardData(orderSnap.size, hs, leaderboardType, uid, leaderboard);

    } else {
        result.Rank = -1
    }

    return result;
}

async function getPlayerInfo(userId: string, eventId: string | null = null): Promise<any> {
    const user = await admin.database().ref(tournament.Users_DB + "/" + userId).once('value');

    if (!user.exists()) {
        return {};
    }

    let result = {
        Name: user.child("userName").val(),
        id: userId,
        vault: {
            coins: user.child(tournament.Coins_Users_DB).val(),
            lira: user.child(tournament.Lira_Users_DB).val(),
        },
        audiencePoints: 0.0,
        country: user.child("country").val(),
        // CoinValue: 0.0,
        PlayerThumbnail: user.child("SavedAvatarURL").val(),
        highestScoreEver: user.child("highestScoreEver").exists() ?
            user.child("highestScoreEver").val() : 0,
        globalAverage: user.child(tournament.GlobalAverage_UserDB).exists() ?
            user.child(tournament.GlobalAverage_UserDB).val() : 0,
        levelName: user.child("levelName").exists() ?
            user.child("levelName").val() : "No Rank",
        level: user.child("level").exists() ?
            user.child("level").val() : 0,

    };



    if (eventId !== null) {
        const eventR = user.child(tournament.Tournaments_Users_DB + "/" + eventId);

        let game1Points = 0;
        let game2Points = 0;
        let game3Points = 0;
        let gameCoins = 0;

        if (eventR.child("games/1").exists()) {
            game1Points = eventR.child("games/1/highScore").val();
            gameCoins += eventR.child("games/1/coins").val();

        }
        if (eventR.child("games/2").exists()) {
            game2Points = eventR.child("games/2/highScore").val();
            gameCoins += eventR.child("games/2/coins").val();

        }
        if (eventR.child("games/3").exists()) {
            game3Points = eventR.child("games/3/highScore").val();
            gameCoins += eventR.child("games/3/coins").val();

        }
        result = {
            ...result, ...{
                status: eventR.child("gameState").val() !== 0 ? "complete" : "in play",
                Game1: game1Points,
                Game2: game2Points,
                Game3: game3Points,
                eventAverage: eventR.child("average").val(),
                eventTotal: eventR.child("total").val(),
                EventMinedCoins: gameCoins,


            }
        };
    };

    return result;
}
export async function getTopLeaderboard(leaderboard: string,
    leaderboardType: Leaderboard_Type,
    scoreField: string,
    userId: string | null,
    limit: number): Promise<admin.firestore.DocumentData[]> {
    let resultRank = { Score: 0, Rank: 0 };

    const fsDB = admin.firestore();
    let result: any[] = [];
    const colRef = fsDB.collection(leaderboard);

    const aboveLimit = Math.floor(limit / 2);
    let firstSetLength = 0;
    let snapshot;
    if (userId !== null && userId !== undefined) {
        resultRank = await getPlayerLeaderboardRank(leaderboard, scoreField, userId, leaderboardType);
        console.log("Current " + userId + " Rank " + resultRank.Rank + " with score " + resultRank.Score);
        if (resultRank.Rank === -1) return result;

        if (leaderboardType === Leaderboard_Type.Jackpot)

            snapshot = await colRef
                .orderBy(scoreField, "desc")
                //.orderBy(tournament.GlobalAverage_UserDB,"desc")
                .endBefore(resultRank.Score)
                .limitToLast(aboveLimit).get();
        else
            snapshot = await colRef
                .orderBy(scoreField, "desc")
                .endBefore(resultRank.Score)
                .limitToLast(aboveLimit).get();

        firstSetLength = snapshot.docs.length;

        console.log("   First slice: " + (resultRank.Rank - Math.min(aboveLimit, firstSetLength)) + " aboveLimit = " + aboveLimit + "  firstSetLenght = " + firstSetLength);
        result = result.concat(await populateLeaderboardData(snapshot, scoreField, leaderboardType,
            leaderboard, resultRank.Rank - Math.min(aboveLimit, firstSetLength)));
        console.log("      result lenght: " + result.length);
        console.log("   Second slice: " + (limit - Math.min(aboveLimit, firstSetLength)) + " limit = " + limit + "  firstSetLenght = " + firstSetLength);

        if (leaderboardType === Leaderboard_Type.Jackpot)

            snapshot = await colRef
                .orderBy(scoreField, "desc")

                //.orderBy(tournament.GlobalAverage_UserDB,"desc")
                .startAt(resultRank.Score)
                .limit(limit - Math.min(aboveLimit, firstSetLength)).get();
        else
            snapshot = await colRef
                .orderBy(scoreField, "desc")
                .startAt(resultRank.Score)
                .limit(limit - Math.min(aboveLimit, firstSetLength)).get();
    } else {
        //TOP 25 of the Leaderboard
        if (leaderboardType === Leaderboard_Type.Jackpot)

            snapshot = await colRef
                .orderBy(scoreField, "desc")
                //.orderBy(tournament.GlobalAverage_UserDB,"desc")
                .limit(limit).get();//limit-Math.min(aboveLimit,firstSetLength)).get();
        else
            snapshot = await colRef
                .orderBy(scoreField, "desc")
                .limit(limit).get();//limit-Math.min(aboveLimit,firstSetLength)).get();

        resultRank.Rank = 1;
    }

    console.log("      Snap length: " + snapshot.docs.length);
    result = result.concat(await populateLeaderboardData(snapshot, scoreField, leaderboardType, leaderboard,
        resultRank.Rank)); //firstSetLength+1
    console.log("      result lenght: " + result.length);
    //// AQUI HAY QUE AÑADIR LA LOGICA DE SI NO HAY 25 TIOS EN EL LEADERBOARD

    result = await populatePlaceholderData(leaderboard, leaderboardType, result, 25)

    ///METER PLACEHOLDERS
    return result;
}

async function populatePlaceholderData(leaderboard: string,
    leaderboardType: Leaderboard_Type,
    current_result: any[],
    endIndex: number): Promise<any[]> {

        
    let eventData = null;
endIndex=50;

    if (leaderboardType === Leaderboard_Type.Jackpot) {
        eventData = await getCurrentJackpotEventRunning();

    }
    if (leaderboardType === Leaderboard_Type.HighScore) {
        eventData = await getCurrentHighScoreEventRunning();
    }

    if (leaderboardType === Leaderboard_Type.Audience) {
        eventData = await getCurrentAudienceEventRunning();
    }


    if (leaderboardType === Leaderboard_Type.BestSeries) {

        eventData = await admin.database()
            .ref(tournament.Active_Tournaments_DB + "/" + leaderboard)
            .once('value');
        if (!eventData.exists()) {
            eventData = await admin.database()
                .ref(tournament.Historic_Tournaments_DB + "/" + leaderboard)
                .once('value');
        }
    }
    console.log("Populate Placeholder: " + current_result.length)
  for (let i = current_result.length + 1; i <= endIndex; i++) {
        const values = { ...Leaderboard_Template };
        values.Rank = i;
        values.Score = 0;
        values.LeaderboardType = leaderboardType;
        values.isPlaceholder = 1;

        values.prize = {
            coins: 0,
            coinsValue: 0,
            cash: 0,
            egift: "",
            bonk: 0,
            zdlt: 0,
            digi: 0,
            pvs: 0,
            maka: 0
        };

        values.PlayerThumbnail = "gs://" + appOptions.storageBucket + "/Images/0ec2773609d3181e4264ab9ddf71e5e6.png";
        let suffix = "TH"

        if (i === 1) suffix = "ST";
        if (i === 2) suffix = "ND";
        if (i === 3) suffix = "RD";
        values.Name = "" + i + suffix + " PRIZE"

        if (leaderboardType === Leaderboard_Type.Jackpot) {

            if (eventData !== null) {

                const refEGift = eventData.child("prizes/" + (i - 1) + "/egift");
                if (refEGift.exists()) {

                    values.prize.egift = refEGift.val();
                }
            }
        }

        if (leaderboardType === Leaderboard_Type.HighScore) {

            if (eventData !== null) {

                const refEGift = eventData.child("prizes/" + (i - 1) + "/coins");
                if (refEGift.exists()) {

                    values.prize.coins = refEGift.val();
                }
            }
        }
        if (leaderboardType === Leaderboard_Type.Audience) {
            if (eventData !== null) {

                const refEGift = eventData.child("prizes/" + (i - 1) + "/coins");
                if (refEGift.exists()) {

                    values.prize.coins = refEGift.val();
                }
            }
        }
         if (leaderboardType === Leaderboard_Type.BestSeries && eventData !== null) {
            const refPrize = eventData.child("prizes/" + (i - 1));
            if (refPrize.exists()) {
                values.prize.coins = refPrize.child("coins").exists() ? refPrize.child("coins").val() : 0;
                values.prize.cash  = refPrize.child("cash").exists()  ? refPrize.child("cash").val()  : 0;
                values.prize.bonk  = refPrize.child("bonk").exists()  ? refPrize.child("bonk").val()  : 0;
                values.prize.zdlt  = refPrize.child("zdlt").exists()  ? refPrize.child("zdlt").val()  : 0;
                values.prize.digi  = refPrize.child("digi").exists()  ? refPrize.child("digi").val()  : 0;
                values.prize.pvs   = refPrize.child("pvs").exists()   ? refPrize.child("pvs").val()   : 0;
            }
        }


        current_result.push(values);
    }
    // console.log(" *** \n"+JSON.stringify(current_result)+" \n ***");
    return current_result;
}

function DoesTheListContainUserNumber(ignoreList: string[], userPhoneNum: string): boolean {

    for (const phoneNumInIgnoreList of ignoreList) {
        if (utils.comparePhoneNumbers(userPhoneNum, phoneNumInIgnoreList)) {
            console.log("phone numbers matched for user:" + userPhoneNum);// + " --- phoneNum:" + phoneNumInIgnoreList);
            return true;
        }
    }
    return false;
}

async function IsTheUserToBeDiscardedFromLeaderboardUsingUserId(leaderboardType: Leaderboard_Type, userId: string): Promise<boolean> {

    const userRef = await admin.database().ref(tournament.Users_DB);
    var user = userRef.child(userId);
    var phoneNum = (await user.child("phone").once('value')).val();

    return IsTheUserToBeDiscardedFromLeaderboard(leaderboardType, phoneNum);
}

function IsTheUserToBeDiscardedFromLeaderboard(leaderboardType: Leaderboard_Type, userPhoneNum: string): boolean {

    var containsItem = DoesTheListContainUserNumber(listOfPhoneNumbersToIgnoreFromLeaderboard, userPhoneNum)

    if (!containsItem) {
        if (leaderboardType === Leaderboard_Type.BestSeries) {
            containsItem = DoesTheListContainUserNumber(listOfPhoneNumbersToIgnoreFromSponsoredLeaderboard, userPhoneNum)
        }
        else if (leaderboardType === Leaderboard_Type.HighScore) {
            containsItem = DoesTheListContainUserNumber(listOfPhoneNumbersToIgnoreFromHighscoreLeaderboard, userPhoneNum)
        }
        else if (leaderboardType === Leaderboard_Type.Jackpot) {
            containsItem = DoesTheListContainUserNumber(listOfPhoneNumbersToIgnoreFromJackpotLeaderboard, userPhoneNum)
        }
        else if (leaderboardType === Leaderboard_Type.CoinBased) {
            containsItem = DoesTheListContainUserNumber(listOfPhoneNumbersToIgnoreFromCoinbasedLeaderboard, userPhoneNum)
        }
        else if (leaderboardType === Leaderboard_Type.Audience) {
            containsItem = DoesTheListContainUserNumber(listOfPhoneNumbersToIgnoreFromWavescoreLeaderboard, userPhoneNum)
        }
        else if (leaderboardType === Leaderboard_Type.Exhibition) {
            containsItem = DoesTheListContainUserNumber(listOfPhoneNumbersToIgnoreFromExhibitionLeaderboard, userPhoneNum)
        }
        else if (leaderboardType === Leaderboard_Type.ExhibitionAlpha) {
            containsItem = DoesTheListContainUserNumber(listOfPhoneNumbersToIgnoreFromExhibitionAlphaLeaderboard, userPhoneNum)
        }
    }
    return containsItem;
}

async function populateLeaderboardData(snapshot: admin.firestore.QuerySnapshot<admin.firestore.DocumentData>,
    scoreField: string,
    leaderboardType: Leaderboard_Type,
    leaderboard: string,
    startIndex: number = 1): Promise<any[]> {
    const result: any[] = [];
    const data = snapshot.docs.map(d => d.data());
    let i = startIndex;

    for (const doc of data) {
   
        const values = await populatePlayerLeaderboardData(
            i, doc[scoreField], leaderboardType, doc.id, leaderboard);
        i++;
        result.push(values);
    }
    //console.log("Populated: "+ JSON.stringify(result))
    return result;
}


async function populatePlayerLeaderboardData(rank: number, docScore: number,
    leaderboardType: Leaderboard_Type,
    userId: string,
    eventId: string): Promise<any> {
    let values = { ...Leaderboard_Template };
    values.Rank = rank;// i
    values.Score = docScore; //doc[scoreField];
    values.LeaderboardType = leaderboardType;
    const dataFromPlayer = await getPlayerInfo(userId,//doc.id,
        leaderboardType === Leaderboard_Type.BestSeries ? eventId : null);

      let extraValues = {
        prize: {
            coins: 0,
            coinsValue: 0,
            cash: 0,
            egift: "",
            bonk: 0,
            zdlt: 0,
            digi: 0,
                        pvs: 0,
                        maka: 0
        }
    };
    if (leaderboardType === Leaderboard_Type.Jackpot) {
        const jpEvent = await getCurrentJackpotEventRunning();
        if (jpEvent !== null) {
            const refPrize = jpEvent.child("prizes/" + (rank - 1));
            const refEGift = refPrize.child("/egift");
            if (refEGift.exists()) {

                extraValues.prize.egift = refEGift.val();

            }
            extraValues.prize.coins = (refPrize.child("coins").exists() ? refPrize.child("coins").val() : 0);
            extraValues.prize.coinsValue = await utils.getCoinsValuesParameter(values.Rank - 1) * Jackpot_CoinsValueFactor;
            extraValues.prize.cash = (refPrize.child("cash").exists() ? refPrize.child("cash").val() : 0);
        }
    }
    if (leaderboardType === Leaderboard_Type.HighScore) {
        const jpEvent = await getCurrentHighScoreEventRunning();
        if (jpEvent !== null) {
            const refPrize = jpEvent.child("prizes/" + (rank - 1));
            extraValues.prize.coins = (refPrize.child("coins").exists()
                ? refPrize.child("coins").val()
                : 0);
            extraValues.prize.coinsValue = await utils.getCoinsValuesParameter(values.Rank - 1) * Jackpot_CoinsValueFactor;

        }
    }
    if (leaderboardType === Leaderboard_Type.Audience) {
        const jpEvent = await getCurrentAudienceEventRunning();
        if (jpEvent !== null) {
            const refPrize = jpEvent.child("prizes/" + (rank - 1));
            extraValues.prize.coins = (refPrize.child("coins").exists() ? refPrize.child("coins").val() : 0);
            extraValues.prize.coinsValue = await utils.getCoinsValuesParameter(values.Rank - 1) * Jackpot_CoinsValueFactor;
        }
    }
    if (leaderboardType === Leaderboard_Type.CoinBased) {
        const jpEvent = await getCurrentCoinBasedEventRunning();
        if (jpEvent !== null) {
            const refPrize = jpEvent.child("prizes/" + (rank - 1));
            extraValues.prize.coins = (refPrize.child("coins").exists() ? refPrize.child("coins").val() : 0);
            extraValues.prize.coinsValue = await utils.getCoinsValuesParameter(values.Rank - 1) * Jackpot_CoinsValueFactor;
        }
    }
    // if (leaderboardType === Leaderboard_Type.BestSeries) {
    //     console.log("populatePrizes " + leaderboardType)
    //     let bsEvent = await admin.database()
    //         .ref(tournament.Active_Tournaments_DB + "/" + eventId)
    //         .once('value');
    //     if (!bsEvent.exists()) {
    //         bsEvent = await admin.database()
    //             .ref(tournament.Historic_Tournaments_DB + "/" + eventId)
    //             .once('value');
    //     }
    //     const refPrize = bsEvent.child("prizes/" + (rank - 1));
    //     if (refPrize.exists()) {

    //         extraValues.prize.coins = (refPrize.child("coins").exists() ? refPrize.child("coins").val() : 0);

    //         extraValues.prize.cash = (refPrize.child("cash").exists() ? refPrize.child("cash").val() : 0);
    //     }

    // }

     if (leaderboardType === Leaderboard_Type.BestSeries) {
        let bsEvent = await admin.database()
            .ref(tournament.Active_Tournaments_DB + "/" + eventId)
            .once('value');
        if (!bsEvent.exists()) {
            bsEvent = await admin.database()
                .ref(tournament.Historic_Tournaments_DB + "/" + eventId)
                .once('value');
        }
        const refPrize = bsEvent.child("prizes/" + (rank - 1));
        if (refPrize.exists()) {
            const p = refPrize;
            extraValues.prize.coins = p.child("coins").exists() ? p.child("coins").val() : 0;
            extraValues.prize.cash = p.child("cash").exists() ? p.child("cash").val() : 0;
            extraValues.prize.bonk = p.child("bonk").exists() ? p.child("bonk").val() : 0;
            extraValues.prize.zdlt = p.child("zdlt").exists() ? p.child("zdlt").val() : 0;
            extraValues.prize.digi = p.child("digi").exists() ? p.child("digi").val() : 0;
            extraValues.prize.pvs  = p.child("pvs").exists()  ? p.child("pvs").val()  : 0;
            extraValues.prize.maka = p.child("maka").exists() ? p.child("maka").val() : 0;
            // coinsValue only meaningful if coins present; leave 0 otherwise
            if (extraValues.prize.coins > 0) {
                extraValues.prize.coinsValue = await utils.getCoinsValuesParameter(values.Rank - 1);
            }
        }
    }

    values = { ...values, ...dataFromPlayer, ...extraValues };
    return values;
}

export async function getEventLeaderboard(eventId: string | null, userId: string | null, limit: number): Promise<admin.firestore.DocumentData[]> {
    if (eventId === null) return [];
    const leaders = getTopLeaderboard(eventId, Leaderboard_Type.BestSeries, Event_Field, userId, limit);
    return leaders;
}
export async function getJackpotLeaderboard(userId: string | null, limit: number): Promise<admin.firestore.DocumentData[]> {

    return getTopLeaderboard(Jackpot_Leaderboard, Leaderboard_Type.Jackpot, Jackpot_Field, userId, limit);
}
export async function getHighScoreLeaderboard(forUid: string | null, limit: number): Promise<admin.firestore.DocumentData[]> {
    /*const fsDB = admin.firestore();
    const result: FirebaseFirestore.DocumentData[] = [];
    const colRef = fsDB.collection(HighScore_Leaderboard);

    const player = await colRef.doc(forUid).get();

    if (player.exists){
        const playerResult = await getPlayerLeaderboardRank(HighScore_Leaderboard, HighScore_Field, forUid)
        const hs = playerResult[HighScore_Field];
        const order = playerResult.order;
        const snapshot = await colRef.orderBy(HighScore_Field,"desc")
            .startAt(hs)
            .limit(limit)
            .get();

        const data = snapshot.docs.map(d => d.data());
        let i =0;
        data.forEach((doc) => {
            const values= doc;
            values.order = order+i;
            i++;
            result.push(values);
        });
    }


    return result;*/
    return getTopLeaderboard(HighScore_Leaderboard, Leaderboard_Type.HighScore, HighScore_Field, forUid, limit);
}

export async function getAudienceLeaderboard(forUid: string | null, limit: number): Promise<admin.firestore.DocumentData[]> {

    return getTopLeaderboard(Audience_Leaderboard, Leaderboard_Type.Audience, Audience_Field, forUid, limit);
}

export async function addCoinBasedLeaderboardDateToFirestore(limit: number): Promise<any> {

    var rootRef = await admin.database().ref(tournament.Users_DB);
    var usersArray: { userId: string; coins: any; }[] = [];

    await rootRef.once('value').then(async function (snapshot) {
        snapshot.forEach(function (userSnapshot) {
            var userId = String(userSnapshot.key);
            var coinsRef = userSnapshot.child(vault.Vault_User_DB + '/' + vault.Coins_Vault_User_DB);
            var coins = coinsRef.val();

            if (coins != null) {
                usersArray.push({ userId: userId, coins: coins });
            }
        });

        const filteredUsersArray = [];
        for (const user of usersArray) {
            if (!await IsTheUserToBeDiscardedFromLeaderboardUsingUserId(Leaderboard_Type.CoinBased, user.userId)) {
                filteredUsersArray.push(user);
            }
        }

        filteredUsersArray.sort(function (a, b) {
            return b.coins - a.coins;
        });

        //ordered top(till limit) users 
        var topUsers = filteredUsersArray.slice(0, limit);

        //post to firestore
        const fsDB = admin.firestore();
        const colRef = fsDB.collection(CoinBased_Leaderboard);
        await DeleteCollection(CoinBased_Leaderboard);
        const updatePromises = topUsers.map(async (user, index) => {
            await colRef.doc(user.userId).set({
                id: user.userId,
                [CoinBased_Field]: user.coins,
                globalAverage: 0
            });
            console.log((index + 1) + '. User: ' + user.userId + ', Coins: ' + user.coins);
        });


        await Promise.all(updatePromises);

        await colRef.doc("counter").set({ count: topUsers.length });

    }).catch(function (error) {
    });
}

export async function DeleteCollection(collectionStr: string) {
    try {
        const fsDB = admin.firestore();
        const colRef = fsDB.collection(collectionStr);

        const querySnapshot = await colRef.get();

        const deletePromises: any[] = [];
        querySnapshot.forEach((doc) => {
            deletePromises.push(doc.ref.delete());
        });

        await Promise.all(deletePromises);

        console.log('Collection cleared successfully.');

    } catch (error) {
        console.error('Error deleting collection:', error);
    }
}

export async function getCoinBasedLeaderboard_NonScalable(userId: string | null, limit: number): Promise<admin.firestore.DocumentData[]> {

  //  await addCoinBasedLeaderboardDateToFirestore(limit);
    return await getTopLeaderboard(CoinBased_Leaderboard, Leaderboard_Type.CoinBased, CoinBased_Field, userId, limit);
}

export async function getCoinBasedLeaderboard(forUid: string | null, limit: number): Promise<admin.firestore.DocumentData[]> {

    return getTopLeaderboard(CoinBased_Leaderboard, Leaderboard_Type.CoinBased, CoinBased_Field, forUid, limit);
}


async function getPlayerHighScore(uid: string): Promise<number> {
    const fsDB = admin.firestore();
    const colRef = fsDB.collection(HighScore_Leaderboard);

    const player = await colRef.doc(uid).get();

    if (player.exists) {
        return player.get(HighScore_Field);
    } else {
        return 0;
    }
}

export async function updateHighScoreLeaderboard(uid: string, score: number, globalAvg: number): Promise<number> {

    if(await IsTheUserToBeDiscardedFromLeaderboardUsingUserId(Leaderboard_Type.HighScore, uid))
    {
        return 0;
    }

    const hs = await getPlayerHighScore(uid);
    if (score > hs)
        return updatePlayerScoreInLeaderboard(HighScore_Leaderboard, uid, HighScore_Field, score, false, globalAvg)
    else
        return hs;

}
export async function updateEventLeaderboard(uid: string, eventId: string, score: number, globalAvg: number): Promise<number> {
    if(await IsTheUserToBeDiscardedFromLeaderboardUsingUserId(Leaderboard_Type.BestSeries, uid))
    {
        return 0;
    }

    return updatePlayerScoreInLeaderboard(eventId, uid, Event_Field, score, false, globalAvg)
}

export async function updateExhibitionEventLeaderboard(uid: string, eventId: string, score: number, globalAvg: number): Promise<number> {
    
    if(await IsTheUserToBeDiscardedFromLeaderboardUsingUserId(Leaderboard_Type.Exhibition, uid))
    {
        return 0;
    }

    return updatePlayerScoreInLeaderboard(eventId, uid, Event_Field, score, false, globalAvg)
}

export async function updateExhibitionAlphaEventLeaderboard(uid: string, eventId: string, score: number, globalAvg: number): Promise<number> {
    
    if(await IsTheUserToBeDiscardedFromLeaderboardUsingUserId(Leaderboard_Type.ExhibitionAlpha, uid))
    {
        return 0;
    }

    return updatePlayerScoreInLeaderboard(eventId, uid, Event_Field, score, false, globalAvg)
}

export async function updateJackpotLeaderboard(uid: string, globalAvg: number): Promise<number> {

    if(await IsTheUserToBeDiscardedFromLeaderboardUsingUserId(Leaderboard_Type.Jackpot, uid))
    {
        return 0;
    }

    return updatePlayerScoreInLeaderboard(Jackpot_Leaderboard,
        uid,
        Jackpot_Field,
        globalAvg, false, globalAvg)
}

export async function updateAudienceLeaderboard(uid: string, scoreToAdd: number, globalAvg: number): Promise<number> {
    if(await IsTheUserToBeDiscardedFromLeaderboardUsingUserId(Leaderboard_Type.Audience, uid))
    {
        return 0;
    }

    // console.log("updateAudienceLeaderboard - uid:" + uid + " scoreToAdd:" + scoreToAdd + " globalAvg:" + globalAvg);
    return updatePlayerScoreInLeaderboard(Audience_Leaderboard, uid, Audience_Field, scoreToAdd, true, globalAvg)
}

export async function updateCoinBasedLeaderboard(uid: string, coins: number): Promise<number> {
    if(await IsTheUserToBeDiscardedFromLeaderboardUsingUserId(Leaderboard_Type.CoinBased, uid))
    {
        return 0;
    }

    return await updatePlayerScoreInLeaderboard(CoinBased_Leaderboard,
        uid,
        CoinBased_Field,
        coins, false, 0);
}

//#region Delete Collections
export async function resetJackpotLeaderboard() {
    await cleanLeaderboard(Jackpot_Leaderboard, true);
}

export async function resetHighScoreLeaderboard() {
    await cleanLeaderboard(HighScore_Leaderboard, true);
}

export async function resetAudienceLeaderboard() {
    await cleanLeaderboard(Audience_Leaderboard, true);
}

export async function CleanAllLeaderboards(exceptActive: boolean = true,
    resetGeneral: boolean = true): Promise<any> {
    const preserveEvents: string[] = []

    const result = { cleaned: 0 };
    preserveEvents.push(Jackpot_Leaderboard);
    preserveEvents.push(HighScore_Leaderboard);
    preserveEvents.push(Audience_Leaderboard);

    if (exceptActive) {
        const activeEvents = await admin.database()
            .ref(tournament.Active_Tournaments_DB)
            .once('value');
        activeEvents.forEach((ev) => {
            if (ev.key !== null)
                preserveEvents.push(ev.key);
        })

    }

    if (resetGeneral) {
        await resetJackpotLeaderboard();
        await resetHighScoreLeaderboard();
        await resetAudienceLeaderboard();
    }

    const fsDB = admin.firestore();
    const colls = await fsDB.listCollections();

    console.log("Collections found: " + colls.length)
    console.log("Preserve : " + preserveEvents)
    for (const snaps of colls) {
        console.log("Delete: " + snaps.id);

        if (preserveEvents.find(el => el === snaps.id) === undefined) {
            await cleanLeaderboard(snaps.id, false);

            result.cleaned++;
        }

    }

    return result;

}

export async function ClearAllLeaderboardsAndRelatedData(): Promise<any> {
    const activeTournamentsRef = admin.database().ref(tournament.Active_Tournaments_DB);
    const activeEvents = await activeTournamentsRef
        .once('value');

    //clearing firestore references
    const allPromises: any[] = [];
    activeEvents.forEach((ev) => {
        let eventKey = ev.key;

        if (eventKey != null)
            allPromises.push(cleanLeaderboard(eventKey, false));
    });
    await Promise.all(allPromises);

    //clearing realtime db - active tournaments
    // activeTournamentsRef.set({});

    //clearing realtime db - user tournaments related details
    await admin.database().ref(tournament.Users_DB).once("value").then((snapshot) => {
        snapshot.forEach(element => {
            let user = element.val();
            const userRef = admin.database().ref(`${tournament.Users_DB}/${user.userId}/${tournament.Tournaments_Users_DB}`);
            userRef.set({})
            // .then(() => {
            //   console.log(`clearing realtime db - user tournaments related details - for user ${user.userId}`);
            // })
            // .catch((error) => {
            //   console.error(`Error clearing realtime db - user tournaments related details for user ${user.userId}:`, error);
            // });
        })
    });

    await resetJackpotLeaderboard();
    await resetHighScoreLeaderboard();
    await resetAudienceLeaderboard();

    return "Success";
}

async function cleanLeaderboard(leaderboard: string, recreate: boolean = true, keepbackup: boolean = false) {
    const fsDB = admin.firestore();
    const colRef = fsDB.collection(leaderboard);

    if (keepbackup) await copyCollection(leaderboard, leaderboard + "_bkp");

    await deleteCollection(colRef);
    console.log("Collection " + leaderboard + " removed");
    if (recreate) {
        await colRef.doc("counter").set({ count: 0 });
    }
}
async function deleteCollection(collectionRef: admin.firestore.CollectionReference<admin.firestore.DocumentData>,
    batchSize: number = 25) {

    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(admin.firestore(), query).then(resolve).catch(reject);
    });
}

async function deleteQueryBatch(db: admin.firestore.Firestore,
    query: admin.firestore.Query<admin.firestore.DocumentData>) {
    //resolve: { (value?: unknown): void; (): void; }) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        // When there are no documents left, we are done
        //resolve();
        return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);

    });
    await batch.commit();

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
        deleteQueryBatch(db, query).then().catch();//, resolve);
    });
}

async function copyCollection(srcCollectionName: string, destCollectionName: string): Promise<any> {
    const fsDB = admin.firestore();
    const documents = await fsDB.collection(srcCollectionName).get();
    let writeBatch = fsDB.batch();
    const destCollection = fsDB.collection(destCollectionName);
    let i = 0;
    for (const doc of documents.docs) {
        writeBatch.set(destCollection.doc(doc.id), doc.data());
        i++;
        if (i > 400) {  // write batch only allows maximum 500 writes per batch
            i = 0;
            console.log('Intermediate committing of batch operation');
            await writeBatch.commit();
            writeBatch = fsDB.batch();
        }
    }
    if (i > 0) {
        console.log('Firebase batch operation completed. Doing final committing of batch operation.');
        await writeBatch.commit();
    } else {
        console.log('Firebase batch operation completed.');
    }
}


//#endregion

//#region Week Average and Player Level

/*const Jackpot_CoinsValues = [
    0.125,	0.0875, 0.05, 0.0375, 0.025,
    0.01875,0.0125,0.00875,0.0075,0.00625,
    0.006,0.00575,0.0055,0.00525,0.005,
    0.00475,0.0045,0.00425,0.004,0.00375,
    0.0035,0.00325,0.003,0.00275,0.0025,
    0.00225,0.002,0.00175,0.0015,0.00125,
    0.001,0.00075,0.0005,0.00025,0
]
*/

const Jackpot_CoinsValueFactor = 1.0

async function getPlayerLevel(userId: string, averageScore: number): Promise<any> {

    let currentCoinsValue = 0.0;
    const jpRank = await getPlayerLeaderboardRank(Jackpot_Leaderboard, Jackpot_Field, userId, Leaderboard_Type.Jackpot);
    const weRank = await getPlayerLeaderboardRank(HighScore_Leaderboard, HighScore_Field, userId, Leaderboard_Type.HighScore);
    const audienceRank = await getPlayerLeaderboardRank(Audience_Leaderboard, Audience_Field, userId, Leaderboard_Type.Audience);

    let coinsValueFromTopPlayer = 0.0;
    let coinsValueFromHighScore = 0.0;
    let coinsValueFromWaveScore = 0.0;
    if (jpRank.Rank < 26 && jpRank.Rank > 0) {
        coinsValueFromTopPlayer = await utils.getCoinsValuesParameter(jpRank.Rank - 1) * Jackpot_CoinsValueFactor;
        currentCoinsValue += coinsValueFromTopPlayer;
    }
    if (weRank.Rank < 26 && weRank.Rank > 0) {
        coinsValueFromHighScore = await utils.getCoinsValuesParameter(weRank.Rank - 1) * Jackpot_CoinsValueFactor;
        currentCoinsValue += coinsValueFromHighScore;
    }
    if (audienceRank.Rank < 26 && audienceRank.Rank > 0) {
        coinsValueFromWaveScore = await utils.getCoinsValuesParameter(audienceRank.Rank - 1) * Jackpot_CoinsValueFactor;
        currentCoinsValue += coinsValueFromWaveScore;
    }


    /* WaveScore HardCoded  */
    // const userData = await admin.database()
    //     .ref(tournament.Users_DB + "/" + userId)
    //     .once('value');
    // const coinsValueFromWaveScore = userData.child("WaveScoreCoinsValue").exists()?userData.child("WaveScoreCoinsValue").val():0
    // currentCoinsValue += coinsValueFromWaveScore;
    /*
    Marro2K (0.4750): GsafxmBYARWNWW1nS5BpM1VQZB92
    FAMOUS LIL DUB (0.25): WZnrBFjXk6eKiqxPMqwanqz6LJC3
    YOUNGMASSEY (0.25): u3ZLqJqoHnNe0n7Q0IkuljxB85w2
     */
    /*----------------------*/

    console.log("GetPlayerLevel: " + userId +
        "\nJPRANK: " + (jpRank.Rank - 1) + "  WERANK: " + (weRank.Rank - 1) +
        "\nWaveScore CoinsValue:" + coinsValueFromWaveScore)

    const coinsValueData = {
        coinsValue: currentCoinsValue,
        coinsValueFromTopPlayer: coinsValueFromTopPlayer,
        coinsValueFromHighScore: coinsValueFromHighScore,
        coinsValueFromWaveScore: coinsValueFromWaveScore
    }

    let levelAndLevelName = await GetLevelAndRankForUser(userId, averageScore);

    return { ...levelAndLevelName, ...coinsValueData }
}

// export async function GetLevelAndRankForUser(userId: string, averageScore: number): Promise<{ level: number, levelName: string }>
// {
//     if (!await user_utils.hasUserPlayedEnoughGamesToCalculateRandAndAvg(userId)) {
//         return { level: -1, levelName: "Celestial" }
//     }
//     if (averageScore < 20000) {
//         return { level: 0, levelName: "Celestial" }
//     }
//     if (averageScore < 25000) {
//         return { level: 1, levelName: "Celestial" }
//     }
//     if (averageScore < 30000) {
//         return { level: 2, levelName: "Celestial" }
//     }
//     if (averageScore < 35000) {
//         return { level: 3, levelName: "Celestial" }
//     }
//     if (averageScore < 40000) {
//         return { level: 4, levelName: "Celestial" }
//     }
//     if (averageScore < 50000) {
//         return { level: 5, levelName: "Celestial" }
//     }
//     if (averageScore < 60000) {
//         return { level: 6, levelName: "Alpha" }
//     }
//     if (averageScore < 70000) {
//         return { level: 7, levelName: "Alpha" }
//     }
//     if (averageScore < 80000) {
//         return { level: 8, levelName: "Delta" }
//     }
//     if (averageScore < 90000) {
//         return { level: 9, levelName: "Sigma" }
//     }
//     if (averageScore < 100000) {
//         return { level: 10, levelName: "Omega" }
//     }

//     return { level: 11, levelName: "Genius" }
// }

export async function GetLevelAndRankForUser(userId: string, averageScore: number): Promise<{ level: number, levelName: string }>
{
    if (!await user_utils.hasUserPlayedEnoughGamesToCalculateRandAndAvg(userId)) {
        return { level: -1, levelName: "Pending" }
    }
    if (averageScore < 20000) {
        return { level: 0, levelName: "Novice" }
    }
    if (averageScore < 25000) {
        return { level: 1, levelName: "Level 1" }
    }
    if (averageScore < 30000) {
        return { level: 2, levelName: "Level 2" }
    }
    if (averageScore < 35000) {
        return { level: 3, levelName: "Level 3" }
    }
    if (averageScore < 40000) {
        return { level: 4, levelName: "Level 4" }
    }
    if (averageScore < 50000) {
        return { level: 5, levelName: "Maestro" }
    }
    if (averageScore < 60000) {
        return { level: 6, levelName: "Architect" }
    }
    if (averageScore < 70000) {
        return { level: 7, levelName: "Alpha" }
    }
    if (averageScore < 80000) {
        return { level: 8, levelName: "Alpha 2" }
    }
    if (averageScore < 90000) {
        return { level: 9, levelName: "Omega" }
    }
    if (averageScore < 100000) {
        return { level: 10, levelName: "Omega 2" }
    }

    return { level: 11, levelName: "Light Master" }
}

export async function resetPlayerLevel(userId: string) {
    const userData = await admin.database()
        .ref(tournament.Users_DB + "/" + userId)
        .once('value');
    if (userData.child(tournament.AverageWindow_UserDB).exists()) {
        await userData.child(tournament.AverageWindow_UserDB).ref.remove();
    }
    const playerLevelData = await getPlayerLevel(userId, 0);

    await userData.ref.update({ globalAverage: 0, ...playerLevelData });
    await vault.UpdateCoinsValueToVault(userId, playerLevelData.coinsValue);
}


export async function updateGlobalAverage(userId: string, newScore: number): Promise<number> {
    let score = 0;
    let count = 0;
    const averageWindowRef = admin.database()
        .ref(tournament.Users_DB + "/" + userId + "/" + tournament.AverageWindow_UserDB);
    const averageWindow = await averageWindowRef
        .once('value');

    const nowDate = Date.now();
    const weekDate = new Date(nowDate);
    weekDate.setDate(weekDate.getDate() - 7);

    const totalGamesToAccountForGlobalAverage = user_utils.TotalGamesToAccountForGlobalAverage;
    const averagesCount = averageWindow.numChildren() + 1;

    let index = 0;

    let surplusItems = 0;
    if (averagesCount > totalGamesToAccountForGlobalAverage)
        surplusItems = averagesCount - (totalGamesToAccountForGlobalAverage)

    console.log("surplus counts : " + surplusItems);
    console.log("averagesCount counts : " + averagesCount);

    const promises: any[] = [];
    averageWindow.forEach(chNode => {

        const valDate = new Date(chNode.child("date").val())
        if ((valDate < weekDate) || (index < surplusItems)) {
            //To remove
            console.log("To remove from window " + valDate);
            promises.push(chNode.ref.remove());
        } else {
            score += chNode.child("score").val();
            count++;
        }
        index++;
    });
    await Promise.all(promises);

    if (newScore > 0) {
        await averageWindowRef.push({ date: nowDate, score: newScore });
        score += newScore;
        count++;
    }
    const globalAverageValue = count === 0 ? 0 : Math.round(score / count)
    const playerLevelData = await getPlayerLevel(userId, globalAverageValue);

    // if (averagesCount >= totalGamesToAccountForGlobalAverage) {
        await admin.database()
            .ref(tournament.Users_DB + "/" + userId)
            .update({ globalAverage: globalAverageValue, ...playerLevelData });
    // }

    await vault.UpdateCoinsValueToVault(userId, playerLevelData.coinsValue);

    return globalAverageValue;

}

export async function getOrderedListOfEvents(userId: string): Promise<admin.database.DataSnapshot[]> {
    let orderedElements: admin.database.DataSnapshot[] = [];

    try {
        const snapshot = await tournament.getActiveTournaments();

        let joinedAndCompletedEvents: admin.database.DataSnapshot[] = []
        let joinedEvents: admin.database.DataSnapshot[] = []
        let notJoinedEvents: admin.database.DataSnapshot[] = []
        let completedEvents: admin.database.DataSnapshot[] = []
        let topPlayersEvents: admin.database.DataSnapshot[] = []
        let highscoreEvents: admin.database.DataSnapshot[] = []
        let wavescoreEvents: admin.database.DataSnapshot[] = []
        let exhibitionEvents: admin.database.DataSnapshot[] = []

        snapshot.forEach((d) => {
            if(!d.child("isActiveToday").val())
              return;

            let eventPlayers = d.child("Players");

            if (d.child("isHighScoreEvent").val()) {
                highscoreEvents.push(d);
            } else if (d.child("isJackpotEvent").val()) {
                topPlayersEvents.push(d);
            }else if (d.child("isAudienceEvent").val()) {
                wavescoreEvents.push(d);
            }else if (d.child("isExhibitionEvent").val()) {
                exhibitionEvents.push(d);
            } else if (eventPlayers != null && eventPlayers.hasChild(userId)) {
                joinedAndCompletedEvents.push(d);
            } else {
                notJoinedEvents.push(d);
            }
        });

        await Promise.all(joinedAndCompletedEvents.map(async (element) => {
            let gameCount = await tournament.getCurrentGameOfTournament(element.child("eventId").val(), 0, userId);
            if (gameCount > tournament.Sponsored_Games_Per_Set) {
                completedEvents.push(element);
            } else {
                joinedEvents.push(element);
            }
        }));

        joinedEvents = tournament.sortEventsBasedOnTimeRemaining(joinedEvents);
        notJoinedEvents = tournament.sortEventsBasedOnTimeRemaining(notJoinedEvents);
        completedEvents = tournament.sortEventsBasedOnTimeRemaining(completedEvents);
        topPlayersEvents = tournament.sortEventsBasedOnTimeRemaining(topPlayersEvents);
        highscoreEvents = tournament.sortEventsBasedOnTimeRemaining(highscoreEvents);
        wavescoreEvents = tournament.sortEventsBasedOnTimeRemaining(wavescoreEvents);
        exhibitionEvents = tournament.sortEventsBasedOnTimeRemaining(exhibitionEvents);

        console.log("exhibitionEvents : " + JSON.stringify(exhibitionEvents));
        orderedElements = [...exhibitionEvents, ...joinedEvents, ...notJoinedEvents, ...topPlayersEvents, ...highscoreEvents, ...wavescoreEvents, ...completedEvents];
    } catch (error) {
        orderedElements = [];
    }

    return orderedElements;
}

export async function getLeaderboardBackup(eventId: string): Promise<void> {
    const currentTime = new Date();

    let outStr = "getLeaderboardBackup BACKUP_START for eventId: " + eventId + "\n";

    const tournamentDataSS = await admin.database().ref(tournament.Active_Tournaments_DB + "/" + eventId).once('value');
    const tournamentDataVal = tournamentDataSS.val();

    const isAudienceEvent = tournamentDataVal.isAudienceEvent;
    const isHighScoreEvent = tournamentDataVal.isHighScoreEvent;
    const isJackpotEvent = tournamentDataVal.isJackpotEvent;
    const isExhibitionEvent = tournamentDataVal.isExhibitionEvent;
    const isCoinBasedEvent = tournamentDataVal.isCoinBasedEvent;
    const name = tournamentDataVal.name;
    const startDate = tournamentDataVal.startDate;
    const entryAllowedFor_lower = tournamentDataVal.entryAllowedFor?.lowerLimit;
    const entryAllowedFor_higher = tournamentDataVal.entryAllowedFor?.upperLimit;

    outStr += "Backup taken at: " + currentTime.toString() + "\n";
    outStr += "Name: " + name + "\n";
    outStr += "StartDate: " + startDate + "\n";
    outStr += "Eligibility Between: " + user_utils.PLAYER_LEVEL[entryAllowedFor_lower] + " to " + user_utils.PLAYER_LEVEL[entryAllowedFor_higher] +"\n";

    let lbData = null;
    const numOfRankers = 0;

    let fileName = currentTime.toISOString() + "_";
    let leaderboardType = "";

    if (isAudienceEvent) {
        leaderboardType = "WAVESCORE";
        fileName += leaderboardType;
        outStr += "Type: " + leaderboardType + " EVENT" + "\n";
        lbData = await getTopLeaderboard(Audience_Leaderboard, Leaderboard_Type.Audience, Audience_Field, null, numOfRankers);
    }
    else if (isHighScoreEvent) {
        leaderboardType = "HIGHSCORE";
        fileName += leaderboardType;
        outStr += "Type: " + leaderboardType + " EVENT" + "\n";
        lbData = await getTopLeaderboard(HighScore_Leaderboard, Leaderboard_Type.HighScore, HighScore_Field, null, numOfRankers);
    }
    else if (isJackpotEvent) {
        leaderboardType = "BEST_AVERAGE";
        fileName += leaderboardType;
        outStr += "Type: " + leaderboardType + " EVENT" + "\n";
        lbData = await getTopLeaderboard(Jackpot_Leaderboard, Leaderboard_Type.Jackpot, Jackpot_Field, null, numOfRankers);
    }
    else if (isExhibitionEvent) {
        leaderboardType = "EXHIBITION";
        fileName += leaderboardType;
        outStr += "Type: " + leaderboardType + " EVENT" + "\n";
        lbData = await getTopLeaderboard(eventId, Leaderboard_Type.BestSeries, Event_Field, null, numOfRankers);
    }
    else if (isCoinBasedEvent) {
        leaderboardType = "TOP_PLAYER";
        fileName += leaderboardType;
        outStr += "Type: " + leaderboardType + " EVENT" + "\n";
        lbData = await getTopLeaderboard(CoinBased_Leaderboard, Leaderboard_Type.CoinBased, CoinBased_Field, null, numOfRankers);
    }
    else //sponsored
    {
        leaderboardType = "SPONSORED"
        fileName += leaderboardType + "_" + name;
        outStr += "Type: " + leaderboardType + " EVENT" + "\n";
        lbData = await getTopLeaderboard(eventId, Leaderboard_Type.BestSeries, Event_Field, null, numOfRankers);
    }

    // outStr += "Leaderboard Data: \n" + JSON.stringify(lbData) + "\n";

    outStr += "getLeaderboardBackup BACKUP_END for eventId:" + eventId + "\n";

    const headers = ['Rank', 'Id', 'Name', 'Value', 'Phone', 'PrizeCoins', 'PrizeCash']
    const table = new Table({
        head: headers, // Define table headers
        // colWidths: [100, 100, 100, 100, 100, 100], // Optional: Set column widths
        style: { head: [], border: [] }
    });
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    worksheet.addRow(headers);

    // Populate the table with JSON data
    for (const item of lbData) {
        const phone = await user_utils.getPhonenumber(item.id);
        table.push([item.Rank, item.id, item.Name, item.Score, phone, item.prize.coins, item.prize.cash]);
        worksheet.addRow([item.Rank, item.id, item.Name, item.Score, phone, item.prize.coins, item.prize.cash]);
    }

    outStr += "\n" + table.toString() + "\n";
    const buffer = await workbook.xlsx.writeBuffer();

    const stor = storage.getStorage();
    await stor.bucket().file("TournamentEndReports/"+ fileName + ".xlsx").save(buffer);
    console.log(outStr);
}

//#endregion

export async function finalizeEventAwards(eventId: string): Promise<{ credited: number }> {
  let credited = 0;
  
  // Read event (prefer Historic)
  let evSnap = await admin.database().ref(`${tournament.Historic_Tournaments_DB}/${eventId}`).once("value");
  if (!evSnap.exists()) {
    evSnap = await admin.database().ref(`${tournament.Active_Tournaments_DB}/${eventId}`).once("value");
    if (!evSnap.exists()) return { credited };
  }

  const eventType = evSnap.child("eventType").exists() ? Number(evSnap.child("eventType").val()) : -1;
  const eventName = evSnap.child("name").val() || eventId;
  const prizesSnap = evSnap.child("prizes");
  if (!prizesSnap.exists()) return { credited };

  // Select leaderboard collection
  let leaderboardCollection = eventId;
  if (evSnap.child("isJackpotEvent").val()) leaderboardCollection = Jackpot_Leaderboard;
  else if (evSnap.child("isHighScoreEvent").val()) leaderboardCollection = HighScore_Leaderboard;
  else if (evSnap.child("isAudienceEvent").val()) leaderboardCollection = Audience_Leaderboard;
  else if (evSnap.child("isCoinBasedEvent").val()) leaderboardCollection = CoinBased_Leaderboard;

  const fsDB = admin.firestore();
  const colRef = fsDB.collection(leaderboardCollection);
  const counter = await colRef.doc("counter").get();
  if (!counter.exists) return { credited };

  const totalDocs = counter.get("count");
  const maxRank = Math.min(totalDocs, prizesSnap.numChildren());
  
  // Get top ranked docs (order by appropriate field)
  let orderField = "total"; // BestSeries default
  if (evSnap.child("isJackpotEvent").val()) orderField = "globalAverage_Score";
  else if (evSnap.child("isHighScoreEvent").val()) orderField = "highscore";
  else if (evSnap.child("isAudienceEvent").val()) orderField = "audience";
  else if (evSnap.child("isCoinBasedEvent").val()) orderField = "coins";

  const snap = await colRef.orderBy(orderField, "desc").limit(maxRank).get();

  let rank = 1;
  for (const doc of snap.docs) {
    const userId = doc.id;
    if (userId === "counter") continue; // skip metadata doc
    if (userId.startsWith("FAKE-")) { rank++; continue; }

    // Check ignore lists
    if (await IsTheUserToBeDiscardedFromLeaderboardUsingUserId(Leaderboard_Type.BestSeries, userId)) { 
      rank++; 
      continue; 
    }

    // Read prize directly from event.prizes array (rank-1 index)
    const prizeSnap = prizesSnap.child(String(rank - 1));
    if (!prizeSnap.exists()) { rank++; continue; }
    
    const prizeRaw = prizeSnap.val(); // e.g. { coins: 200, rank: 1 } or { bonk: 100000, rank: 1 }
    
    // Build token map for vault (filter out non-token fields like 'rank', 'image', etc.)
    const prizeObj: Record<string, number> = {};
    const tokenKeys = ["coins", "cash", "bonk", "zdlt", "digi", "pvs", "maka"];
    for (const k of tokenKeys) {
      if (prizeRaw[k] !== undefined && Number(prizeRaw[k]) > 0) {
        prizeObj[k] = Number(prizeRaw[k]);
      }
    }

    if (Object.keys(prizeObj).length === 0) { rank++; continue; }

   // Credit vault (returns detailed breakdown per token)
    const vaultResult = await vault.AddPrizeTokensToVault(userId, prizeObj);
    
    // Write WinningHistory with both raw and credited amounts
    await writeWinningHistory(userId, eventId, eventName, eventType, rank, prizeObj, vaultResult);
    
    
    credited++;
    rank++;
  }
  return { credited };
}

async function writeWinningHistory(
  userId: string,
  eventId: string,
  eventName: string,
  eventType: number,
  rank: number,
  prizeObj: Record<string, number>,
  vaultResult: Record<string, { raw: number; miningRate: number; credited: number; total: number }>
) {
  const histRef = admin.database().ref(`${tournament.Users_DB}/${userId}/WinningHistory/${eventId}`);
  const exists = (await histRef.once("value")).exists();
  if (exists) return; // idempotent
  
  // Build credited prize map from vaultResult
  const creditedPrize: Record<string, any> = {};
  for (const token of Object.keys(vaultResult)) {
    creditedPrize[token] = vaultResult[token].credited;
  }
  
  await histRef.set({
    eventId,
    eventName,
    eventType,
    rank,
    prizeRaw: prizeObj,           // original prize amounts
    prizeCredited: creditedPrize, // amount actually added to vault (raw * miningRate)
    miningRate: Object.keys(vaultResult).length > 0 ? vaultResult[Object.keys(vaultResult)[0]].miningRate : 0,
    timestamp: Date.now()
  });
}
