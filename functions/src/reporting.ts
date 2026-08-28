import * as admin from "firebase-admin";
import * as storage  from 'firebase-admin/storage';

//import * as storage from "@firebase/storage";
//import * as storage from "firebase/storage"
//import * as vault from "./vault";
//import * as leaderboards from './leaderboards';
import * as tournaments from "./tournament";

const ObjectsToCsv = require("objects-to-csv");



export async function generateReports(fromDays: number=7){
    const startReportDate = new Date();
    startReportDate.setUTCDate(startReportDate.getUTCDate()-fromDays);
    const eventList = await admin.database()
        .ref(tournaments.Historic_Tournaments_DB+'/')
        //.startAt(startReportDate.getTime())
        .once('value')
    await generateEventsReports(eventList);//["E_0_Mon Jul 04 2022_963_9180","E_0_Sat Jul 09 2022_785_4679"])
    //await generateMainLeaderboardReports()


    //await generatePlayerStatistics()
    await generatePlayerVaults();
}

async function generateEventsReports(eventList: admin.database.DataSnapshot, eventIdList: string[]=[]){
    //const activeTournametsRef = admin.database().ref(tournaments.Active_Tournaments_DB+'/');
    //const histoTournametsRef = admin.database().ref(tournaments.Historic_Tournaments_DB+'/');
    const eventResultList: any[] = [];

    const allPromises: any[] = [];
    eventList.forEach((tour)=>{
        if (!tour.exists()){

            console.log("Tournament "+tour.key+ " does not exist");

        } else {
            console.log("Generating Event "+tour.key+" Report");
            tour.child(tournaments.Player_Tournaments_DB).forEach((user)=>{
                allPromises.push(
                    getPlayerEventFinale(user.key,
                        tour.key!==null?tour.key:"",
                        tour.child("name").val(),
                        tour.child("startDate").val(),
                        eventResultList))
           });
        }
    })
/*    for (const eventId of eventList.forEach()) {
        let tour = await histoTournametsRef.child(eventId).once('value');

        if (!tour.exists()){

                console.log("Tournament "+eventId+ " does not exist");
                continue;
        }

        tour.child(tournaments.Player_Tournaments_DB).forEach((user)=>{
            allPromises.push(getPlayerEventFinale(user.key,eventId,eventResultList))
        });
    }
*/
    await Promise.all(allPromises);
    const csv = new ObjectsToCsv(eventResultList);

    // Save to file:
    const fileName = "GR-"+Date.now()+".csv";
    await csv.toDisk('./'+fileName);


    const stor = storage.getStorage();
   // const storageRef = storage.ref(stor,"Reports/report.csv");

// Raw string is the default if no format is provided
    const message = await csv.toString(true,true);
    await stor.bucket().file("Reports/"+fileName).save(message);

    // Return the CSV file as string:
    console.log(message);

}

async function getPlayerEventFinale(userId: string|null,
                                    eventId: string,
                                    eventName: string,
                                    eventDate: string,
                                    eventList: any[]): Promise<boolean>{
    if (userId === null) return false;

    const usersRef = admin.database().ref(tournaments.Users_DB+'/'+userId);
    const user = await usersRef.once('value');
    if (!user.exists()){
        console.log("User: "+userId+" does not exist");
        return false;
    }

    let claimed = false;
    let coinsPrize = 0;
    let cashPrize = 0;
    let egiftPrize = "";
    let rank = 0;
    if (!user.child(tournaments.Event_Finales_Users_DB+"/"+eventId).exists()){
        console.log("User "+userId+" not in Event Finale "+eventId);
        return false;
    } else {
        const finale =user.child(tournaments.Event_Finales_Users_DB+"/"+eventId);
        claimed = finale.child("claimed").val();
        coinsPrize = finale.child("prize/coins").val();
        cashPrize = finale.child("prize/cash").val();
        egiftPrize = finale.child("prize/egift").val();
        rank = finale.child("prize/rank").val();
    }

    console.log("Generating report for event "+eventId + " for user "+userId);

    const tournamentData = user.child(tournaments.Tournaments_Users_DB+"/"+eventId)

    const eventData: any = {
        eventId: eventId,
        userId: userId,
        eventName: eventName,
        eventDate: eventDate.replace(","," "),
        phoneNumber: user.child("phone").val(),
        userName: user.child("userName").val(),
        userPic: user.child("SavedAvatarURL").val(),
        game1Score: tournamentData.child("games/1/highScore").val(),
        game2Score: tournamentData.child("games/2/highScore").val(),
        game3Score: tournamentData.child("games/3/highScore").val(),
        gameTotalScore: tournamentData.child("total").val(),
        game1Coins: tournamentData.child("games/1/coins").val(),
        game2Coins: tournamentData.child("games/2/coins").val(),
        game3Coins: tournamentData.child("games/3/coins").val(),
        coinsPrize: coinsPrize,
        cashPrize: cashPrize,
        egiftPrize: egiftPrize,
        claimed : claimed,
        rank : rank

    }

    eventList.push(eventData);
    return true;
}

export async function findPlayerByUserName(userName: string): Promise<any> {

    const allUsersRef = admin.database().ref(tournaments.Users_DB+'/');

    const userList: string[] = []

    await allUsersRef.orderByChild('userName').equalTo(userName).on("value", function(snapshot) {
        console.log(snapshot.val());

        snapshot.forEach(function(data) {
            console.log(data.key);
            if (data.key!==null)
                userList.push(data.key);
        });

    });
    return userList;

}

async function generatePlayerVaults():Promise<boolean> {
    const allUsersRef = admin.database().ref(tournaments.Users_DB+'/');

    const userList: any[] = []

    const users = await allUsersRef.once("value");


    users.forEach(function(data) {
        console.log(data.key);
        if (data.key!==null)
            userList.push({
                userId: data.key,
                userName: data.child("userName").val(),
                cash: data.child("vault/cash").exists()?data.child("vault/cash").val():0,
                coins: data.child("vault/coins").exists()?data.child("vault/coins").val():0,
                coinsValue: data.child("vault/coinsValue").exists()?data.child("vault/coinsValue").val():0
            });
    });


    const csv = new ObjectsToCsv(userList);

    // Save to file:
    const fileName = "Vaults-"+Date.now()+".csv";
    await csv.toDisk('./'+fileName);


    const stor = storage.getStorage();
    // const storageRef = storage.ref(stor,"Reports/report.csv");

// Raw string is the default if no format is provided
    const message = await csv.toString(true,true);
    await stor.bucket().file("Reports/"+fileName).save(message);

    // Return the CSV file as string:
    console.log(message);



    return true;



}

export async function getDAU(startDate: number, daysCount: number=1): Promise<any> {
    const endDateTime = startDate + (daysCount * 24 * 60 * 60 * 1000);

    console.log("Using: "+new Date(startDate).toUTCString()+ "=> "+new Date(endDateTime).toUTCString());

    const allUsersRef = await admin.database().ref(tournaments.Users_DB + '/')
        .orderByChild("lastActivity")
        .startAt(startDate)
        .endAt(endDateTime)
        .once("value");

    const date = new Date(startDate);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    return {date: formattedDate, dau: allUsersRef.numChildren()};
}

export async function createReportLastWeekDAU(startDate: Date=new Date(Date.now())): Promise<string>{
    const result = []
    for (let i = 1; i <= 7; i++) {
        result.push(await getDAU(startDate.getTime()+(-i * 24 * 60 * 60 * 1000)))
    }

    console.log("Result: \n"+JSON.stringify(result))

    const csv = new ObjectsToCsv(result);

    // Save to file:
    const fileName = "DAU-"+Date.now()+".csv";
    await csv.toDisk('./'+fileName);

    return fileName
}