//#region PracticeGames
import * as admin from "firebase-admin";
import {
    Practice_Games_Per_Set,
    Practice_Sets,
    PracticeAverageWindow_UserDB,
    PracticeGameParameters_DB,
    Users_DB
} from "./tournament";

export async function getPracticeGameParameters(): Promise<Object|null> {
    const uRef = admin.database().ref(PracticeGameParameters_DB);
    const paramValues = await uRef.once('value');

    if (!paramValues.exists()) return null;

    // @ts-ignore
    return paramValues.toJSON();
}

export async function addPracticeGameScore(userId: string,
                                           newScore: number,
                                           gameIndex: number,
                                           setIndex: number): Promise<any> {
    let score = 0;
    let count = 0;
    const averageWindowRef = admin.database()
        .ref(Users_DB + "/" + userId + "/" +PracticeAverageWindow_UserDB );
    const averageWindow = await averageWindowRef
        .once('value');

    const nowDate = Date.now();
    const weekDate = new Date(nowDate);
    weekDate.setDate(weekDate.getDate() - 7);
    const promises:any[] = [];

    const currentSeriesCandidates: any[] = [];
    averageWindow.forEach(chNode => {
        const valDate = new Date(chNode.child("date").val())
        let valScore = 0;
        if (valDate<weekDate){
            //To remove
            console.log("To remove from window "+valDate);
            promises.push(chNode.ref.remove());
        } else {
            valScore =  chNode.child("score").val();
            score += valScore;
            count ++;
        }

        const valGameIndex = chNode.child("gameIndex").val();
        const valSetIndex = chNode.child("setIndex").val();
        if (valSetIndex === setIndex){
            currentSeriesCandidates.push(
                {
                    date: valDate,
                    gameIndex: valGameIndex,
                    setIndex: valSetIndex,
                    score: valScore
                })
        }
    });

    const sortedSet = currentSeriesCandidates.sort((a,b)=>
        (a.date<b.date)?1:(a.date>b.date)?-1:0
    ).slice(0,10);
    console.log(JSON.stringify(sortedSet));
    let seriesTotal = 0
    let indexes = [0,1,2]
    sortedSet.every((val)=>{
        console.log("Series Total: "+seriesTotal+" ... "+ JSON.stringify(val)+ " ... "+ JSON.stringify(indexes));
        seriesTotal += (val.gameIndex<gameIndex && indexes.includes(val.gameIndex))
            ?val.score
            :0;
        indexes = indexes.filter(function(item) {
            return item !== val.gameIndex
        })
        return indexes.length !== 0;

    });
    seriesTotal += newScore;

    if (newScore > 0) {
        await averageWindowRef.push({date: nowDate,
            score: newScore,
            gameIndex: gameIndex,
            setIndex: setIndex
        });
        score += newScore;
        count++;
    }
    const globalAverageValue = count===0?0:Math.round(score / count)

    const response = {
        practiceGlobalAverage: globalAverageValue,
        practiceSeriesTotal: seriesTotal,
        currentPracticeGameSet: ((gameIndex +1) % Practice_Games_Per_Set) !== 0
            ?setIndex
            :(setIndex +1) % Practice_Sets,
        currentPracticeGameIndex: (gameIndex +1) % Practice_Games_Per_Set
    }

    await admin.database()
        .ref(Users_DB + "/" + userId)
        .update(response);


    return response;

}

class PracticeParameters {
    gameSongs: string[] = [];
    gameThemes: number[] = [];

}
export async function getNextPracticeGameInfo(userId: string): Promise<any> {
    const userDb = await admin.database()
        .ref(Users_DB + "/" + userId).once('value');

    const parameters: PracticeParameters = Object.assign( new PracticeParameters,await getPracticeGameParameters());

    let result: any = {
        currentPracticeGameSet:0,
        currentPracticeGameIndex:0
    }
    if (!userDb.child("currentPracticeGameSet").exists()
        || !userDb.child("currentPracticeGameIndex").exists()){
        await userDb.ref.update(result);
    } else {
        result.currentPracticeGameSet = userDb.child("currentPracticeGameSet").val();
        result.currentPracticeGameIndex = userDb.child("currentPracticeGameIndex").val();
    }


    const nextIndex = result.currentPracticeGameSet *  Practice_Games_Per_Set + result.currentPracticeGameIndex;
    result = {
        nextSongUrl: parameters.gameSongs[nextIndex],
        nextTheme: parameters.gameThemes[nextIndex],
        ...result
    }

    return result
}

export async function getPracticeGameFromGameIndex(gameIndex: number): Promise<any> {
    const parameters: PracticeParameters = Object.assign( new PracticeParameters,await getPracticeGameParameters());

    let result: any = {
        currentPracticeGameSet:gameIndex,
        currentPracticeGameIndex:gameIndex
    }

    result = {
        nextSongUrl: parameters.gameSongs[gameIndex],
        nextTheme: parameters.gameThemes[gameIndex],
        ...result
    }

    return result
}