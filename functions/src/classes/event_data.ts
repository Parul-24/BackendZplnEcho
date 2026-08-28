import * as admin from "firebase-admin";

const Active_Tournaments_DB = "Active_Tournaments";
const Historic_Tournaments_DB = "Historic_Tournaments";

const DefaultNumberOfGames = 3;
const DefaultInitialHoursPerEvent = 3;
const DefaultCoinsCost = 50;

const DefaultCoinsJackpot = 1000;

const DefaultGameThemes = [0,1,2];
const DefaultGameSeeds = [1001,1002,1003];
const DefaultGameSongs = ["","",""];
const DefaultNumberOfPrizes = 25;

const DefaultCashPrizes =
    [
        350,300,250,100,80,
        70,60,50,40,30,
        10,10,10,10,10,
        10,10,10,10,10,
        10,10,10,10,10
    ]

export class Event_Data {
    eventId: string
    name: string
    isActiveToday: boolean
    startDate: string
    gamesNumber: number
    initialHours: number
    remainsHours: number
    coinsCost: number
    mainImage: string
    brandLogoImage: string
    brandTextImage: string
    gameThemes: number[]
    gameSeeds: number[]
    gameSongs: string[]
    isZplnEvent: boolean
    isJackpotEvent: boolean
    isHighScoreEvent: boolean
    isAudienceEvent: boolean
    autoRenewal: boolean
    coinsJackpot: number
    players: string[]

    numberOfPrizes!: number
    prizes: Prize[]

    ref?: string
    historic?:boolean


    constructor(eventId: string) {
        this.eventId = eventId
        this.name = ""
        this.isActiveToday = false
        this.startDate = new Date(Date.now()).toUTCString()
        this.gamesNumber = DefaultNumberOfGames
        this.initialHours = DefaultInitialHoursPerEvent
        this.remainsHours = this.initialHours
        this.coinsCost = DefaultCoinsCost
        this.mainImage = ""
        this.brandLogoImage = ""
        this.brandTextImage = ""
        this.gameThemes = DefaultGameThemes
        this.gameSeeds = DefaultGameSeeds
        this.gameSongs = DefaultGameSongs
        this.isAudienceEvent = false
        this.isZplnEvent = false
        this.isJackpotEvent = false
        this.isHighScoreEvent = false
        this.autoRenewal = false
        this.coinsJackpot = DefaultCoinsJackpot
        this.numberOfPrizes = DefaultNumberOfPrizes
        this.prizes = []
        for (let i=1;i<=this.numberOfPrizes;i++) {
            this.prizes.push(new Prize(i))
        }
        this.players = []
    }

    static async get_from_database(eventId: string, active: boolean=true): Promise<Event_Data> {
        const ref = (active?Active_Tournaments_DB:Historic_Tournaments_DB+ "/" + eventId)
        const eventData = await admin.database().ref(ref)
            .once('value');
        if (!eventData.exists()) throw new Error(eventId+" not in "+Active_Tournaments_DB);

        let result: Event_Data;
        result = eventData.val();
        result.ref = ref;
        result.historic = !active;
        return result;
    }

    async join_player(userId: string): Promise<boolean>{
        return true;
    }
    /*private async check_join_requirements(): Promise<boolean> {

        const playerIn:boolean = this.players.indexOf("turtles") > -1;

        return admin.database().ref(Users_DB + '/' + userId)
            .once('value')
            .then((userData) => {
                const userCoins = userData.child(Coins_Users_DB).val();
                return userCoins >= cost && !playerIn;
            }).catch();
    }*/
}

class Prize {
    description: string
    cash?: number
    coins?: number
    rank: number
    image?: string

    constructor(rank: number) {
        if (rank<=DefaultCashPrizes.length)
            this.description = "$"+DefaultCashPrizes[rank-1]
        else
            this.description = "$0"
        this.rank = rank
    }
}
