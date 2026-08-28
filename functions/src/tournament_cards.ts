import * as tournament from "./tournament";
import * as admin from "firebase-admin";
import DataSnapshot = admin.database.DataSnapshot;
import * as leaderboards from "./leaderboards";
import {DefaultTimeZoneSwift} from "./utils";
import {appOptions} from "./environments";

const DefaultNumberOfGames = 3;
const DefaultNumberOfSeries = 1;
const DefaultSerieDurantion = 48;
const DefaultCreditCost = 50;
const DefaultCreditJackpot = 5000;

const DefaultCoinsJackpot = 1000;

const DefaultGameThemes = [0,1,2];
const DefaultGameSeeds = [1001,1002,1003];
const DefaultGameSongs = [0,1,2];
const DefaultNumberOfPrizes = 25;

const GameThemesGroups = [[2,0,3],[0,2,3],[0,2,3],[1,2,3]];

export enum Event_Types {
    CreditsOnly = 0,
    CoinAndCredits = 1,
    EGiftOnly = 2,
    EGiftAndCredits = 3,
    CashAndCredits = 4,
    CashOnly = 5,
    CoinsOnly = 6,
    BonkOnly = 7,
    ZDLTOnly = 8,
    DIGIOnly = 9,
    PVSOnly = 10,
    MakaOnly = 11
}

// Bonk default prize matrices (50 ranks) for each eligibility tier
const BONK_PRIZES_BY_ELIGIBILITY: Record<string, number[]> = {
  Celestial: [
    100000,70000,50000,40000,30000,25000,20000,18000,15000,12000,
    10000,10000,10000,10000,10000,8000,8000,8000,7000,7000,
    7000,5000,5000,5000,5000,1000,1000,1000,1000,1000,
    1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,
    1000,1000,1000,1000,1000,1000,1000,1000,1000,1000
  ],
  Alpha: [
    150000,100000,70000,60000,50000,40000,30000,25000,20000,15000,
    15000,15000,15000,15000,15000,12000,12000,12000,10000,10000,
    10000,8000,7000,7000,7000,2000,2000,2000,2000,2000,
    2000,2000,2000,2000,2000,2000,2000,2000,2000,2000,
    2000,2000,2000,2000,2000,2000,2000,2000,2000,2000
  ],
  Omega: [
    200000,150000,100000,70000,60000,50000,40000,30000,25000,20000,
    20000,20000,20000,20000,20000,15000,15000,15000,12000,12000,
    12000,10000,10000,10000,9000,3000,3000,3000,3000,3000,
    3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,
    3000,3000,3000,3000,3000,3000,3000,3000,3000,3000
  ],
  Genius: [
    300000,200000,150000,120000,100000,80000,70000,60000,50000,40000,
    40000,40000,40000,40000,35000,25000,25000,25000,20000,20000,
    20000,15000,15000,15000,15000,4000,4000,4000,4000,4000,
    4000,4000,4000,4000,4000,4000,4000,4000,4000,4000,
    4000,4000,4000,4000,4000,4000,4000,4000,4000,4000
  ]
};

// ZDLT default prize matrices (50 ranks) for each eligibility tier
const ZDLT_PRIZES_BY_ELIGIBILITY: Record<string, number[]> = {
  Celestial: [
    320,280,200,160,120,100,80,70,60,50,
    40,40,40,40,40,30,30,30,30,30,
    30,20,20,20,20,4,4,4,4,4,
    4,4,4,4,4,4,4,4,4,4,
    4,4,4,4,4,4,4,4,4,4
  ],
  Alpha: [
    400,360,300,240,200,120,100,76,72,68,
    64,60,56,52,48,44,40,40,40,40,
    40,30,30,30,30,30,30,30,30,20,
    20,20,20,20,20,20,20,20,10,10,
    10,10,10,10,10,10,10,10,10,10
  ],
  Omega: [
    500,400,350,300,250,160,120,100,90,80,
    80,70,70,60,60,60,50,50,50,50,
    50,50,50,50,50,50,50,50,50,40,
    40,40,40,40,40,40,40,40,20,20,
    20,20,20,20,20,20,20,20,20,20
  ],
  Genius: [
    800,600,400,350,300,250,200,150,120,120,
    120,110,110,100,100,100,90,90,90,90,
    80,80,80,80,80,80,80,80,70,70,
    70,70,70,60,60,60,60,50,50,50,
    40,40,40,30,30,30,30,30,30,30
  ]
};

// DIGI default prize matrices (50 ranks) for each eligibility tier
const DIGI_PRIZES_BY_ELIGIBILITY: Record<string, number[]> = {
  Celestial: [
    1000,700,500,400,300,250,200,180,150,120,
    100,100,100,100,100,80,80,80,70,70,
    70,50,50,50,50,10,10,10,10,10,
    10,10,10,10,10,10,10,10,10,10,
    10,10,10,10,10,10,10,10,10,10
  ],
  Alpha: [
    1500,1000,700,600,500,400,300,250,200,150,
    150,150,150,150,150,120,120,120,100,100,
    100,80,70,70,70,20,20,20,20,20,
    20,20,20,20,20,20,20,20,20,20,
    20,20,20,20,20,20,20,20,20,20
  ],
  Omega: [
    2000,1500,1000,700,600,500,400,300,250,200,
    200,200,200,200,200,150,150,150,120,120,
    120,100,100,100,90,30,30,30,30,30,
    30,30,30,30,30,30,30,30,30,30,
    30,30,30,30,30,30,30,30,30,30
  ],
  Genius: [
    3000,2000,1500,1200,1000,800,700,600,500,400,
    400,400,400,400,350,250,250,250,200,200,
    200,150,150,150,150,40,40,40,40,40,
    40,40,40,40,40,40,40,40,40,40,
    40,40,40,40,40,40,40,40,40,40
  ]
};

// PVS default prize matrices (50 ranks) for each eligibility tier
const PVS_PRIZES_BY_ELIGIBILITY: Record<string, number[]> = {
  Celestial: [
    200,140,100,80,60,50,40,36,30,24,
    20,20,20,20,20,16,16,16,14,14,
    14,10,10,10,10,2,2,2,2,2,
    2,2,2,2,2,2,2,2,2,2,
    2,2,2,2,2,2,2,2,2,2
  ],
  Alpha: [
    300,200,140,120,100,80,60,50,40,30,
    30,30,30,30,30,24,24,24,20,20,
    20,16,14,14,14,4,4,4,4,4,
    4,4,4,4,4,4,4,4,4,4,
    4,4,4,4,4,4,4,4,4,4
  ],
  Omega: [
    400,300,200,140,120,100,80,60,50,40,
    40,40,40,40,40,30,30,30,24,24,
    24,20,20,20,18,6,6,6,6,6,
    6,6,6,6,6,6,6,6,6,6,
    6,6,6,6,6,6,6,6,6,6
  ],
  Genius: [
    600,400,300,240,200,160,140,120,100,80,
    80,80,80,80,70,50,50,50,40,40,
    40,30,30,30,30,8,8,8,8,8,
    8,8,8,8,8,8,8,8,8,8,
    8,8,8,8,8,8,8,8,8,8
  ]
};



// Maka default prize matrices (50 ranks) for each eligibility tier
const MAKA_PRIZES_BY_ELIGIBILITY: Record<string, number[]> = {
  Celestial: [
    100000,70000,50000,40000,30000,25000,20000,18000,15000,12000,
    10000,10000,10000,10000,10000,8000,8000,8000,7000,7000,
    7000,5000,5000,5000,5000,1000,1000,1000,1000,1000,
    1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,
    1000,1000,1000,1000,1000,1000,1000,1000,1000,1000
  ],
  Alpha: [
    150000,100000,70000,60000,50000,40000,30000,25000,20000,15000,
    15000,15000,15000,15000,15000,12000,12000,12000,10000,10000,
    10000,8000,7000,7000,7000,2000,2000,2000,2000,2000,
    2000,2000,2000,2000,2000,2000,2000,2000,2000,2000,
    2000,2000,2000,2000,2000,2000,2000,2000,2000,2000
  ],
  Omega: [
    200000,150000,100000,70000,60000,50000,40000,30000,25000,20000,
    20000,20000,20000,20000,20000,15000,15000,15000,12000,12000,
    12000,10000,10000,10000,9000,3000,3000,3000,3000,3000,
    3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,
    3000,3000,3000,3000,3000,3000,3000,3000,3000,3000
  ],
  Genius: [
    300000,200000,150000,120000,100000,80000,70000,60000,50000,40000,
    40000,40000,40000,40000,35000,25000,25000,25000,20000,20000,
    20000,15000,15000,15000,15000,4000,4000,4000,4000,4000,
    4000,4000,4000,4000,4000,4000,4000,4000,4000,4000,
    4000,4000,4000,4000,4000,4000,4000,4000,4000,4000
  ]
};

/**
 * Return default prize list (array of { bonk|coins|cash : number, rank })
 * eventType: use Event_Types enum
 * eligibility: one of "Celestial","Alpha","Omega","Genius"
 * count: number of ranks (default 50)
 */
export function getDefaultPrizeDataByType(eventType: number, eligibility: string, count: number = 50): any[] {
  const normalized = String(eligibility || "").trim();
  const result: any[] = [];

  if (eventType === Event_Types.BonkOnly) {
    const table = BONK_PRIZES_BY_ELIGIBILITY[normalized] || BONK_PRIZES_BY_ELIGIBILITY["Celestial"];
    for (let i = 0; i < Math.min(count, table.length); i++) {
      result.push({ bonk: table[i], rank: i + 1 });
    }
    // if count > table length, pad with last value or zeros
    for (let i = table.length; i < count; i++) {
      result.push({ bonk: table[table.length - 1] || 0, rank: i + 1 });
    }
    return result;
  }

   if (eventType === Event_Types.ZDLTOnly) {
    const table = ZDLT_PRIZES_BY_ELIGIBILITY[normalized] || ZDLT_PRIZES_BY_ELIGIBILITY["Celestial"];
    for (let i = 0; i < Math.min(count, table.length); i++) {
      result.push({ zdlt: table[i], rank: i + 1 });
    }
    for (let i = table.length; i < count; i++) {
      result.push({ zdlt: table[table.length - 1] || 0, rank: i + 1 });
    }
    return result;
  }

    if (eventType === Event_Types.DIGIOnly) {
    const table = DIGI_PRIZES_BY_ELIGIBILITY[normalized] || DIGI_PRIZES_BY_ELIGIBILITY["Celestial"];
    for (let i = 0; i < Math.min(count, table.length); i++) {
      result.push({ digi: table[i], rank: i + 1 });
    }
    for (let i = table.length; i < count; i++) {
      result.push({ digi: table[table.length - 1] || 0, rank: i + 1 });
    }
    return result;
  }

    if (eventType === Event_Types.PVSOnly) {
    const table = PVS_PRIZES_BY_ELIGIBILITY[normalized] || PVS_PRIZES_BY_ELIGIBILITY.Celestial;
    for (let i = 0; i < Math.min(count, table.length); i++) result.push({ pvs: table[i], rank: i + 1 });
    for (let i = table.length; i < count; i++) result.push({ pvs: table[table.length - 1] || 0, rank: i + 1 });
    return result;
  }

  if (eventType === Event_Types.MakaOnly) {
    const table = MAKA_PRIZES_BY_ELIGIBILITY[normalized] || MAKA_PRIZES_BY_ELIGIBILITY["Celestial"];
    for (let i = 0; i < Math.min(count, table.length); i++) {
      result.push({ maka: table[i], rank: i + 1 });
    }
    for (let i = table.length; i < count; i++) {
      result.push({ maka: table[table.length - 1] || 0, rank: i + 1 });
    }
    return result;
  }

  // fallback: return coins template (keeps legacy behavior)
  const baseCoins = 200;
  const step = 3;
  for (let i = 0; i < count; i++) {
    result.push({ coins: Math.max(0, Math.round(baseCoins - i * step)), rank: i + 1 });
  }
  return result;
}


const DefaultEventData = {
    eventId: "EventId",
    name: "EventName",
    isActiveToday: 0,
    startDate: new Date(Date.UTC(2021,1,1)).toUTCString(),
    gamesNumber: DefaultNumberOfGames,
    numberOfSeries: DefaultNumberOfSeries,
    currentPhase: 1,
    phaseHours: DefaultSerieDurantion,
    remainingTime: DefaultSerieDurantion,
    remainsHours: DefaultSerieDurantion,
    [tournament.CoinsCost_Tournaments_DB]: DefaultCreditCost,
    //sponsorLogo: "",
    prizeScreen: "",
    postgameScreen: "",
    posteventScreenSS: "",
    posteventScreenHS: "",
    posteventScreenNS: "",
    gameThemes: DefaultGameThemes,
    gameSeeds: DefaultGameSeeds,
    gameSongs: DefaultGameSongs,
    isZplnEvent: false,
    zplnIndex: 0,
    isDailyEvent: false,
    isJackpotEvent: false,
    isBrandEvent: false,
    isHighScoreEvent: false,
    isAudienceEvent: false,
    autoRenewal: true,
    coinsJackpot: 0,
    creditJackpot: 0,
    carrouselImages: [],
    brandLogoImage: "",
    brandTextImage: "",
    brandPrizePackage: 0,

    backgroundImage: "",

    totalPrize: 0,
    numberOfPrizes: 0,
    prizes: []
};


function createGeneralEventInfo(eventData: any, eventName:string, delayInDays:number, numberOfPrizes:number):any{
    const today = new Date();
    const startDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()+delayInDays,
        DefaultTimeZoneSwift);

    const eventId = "E_"+eventData.eventType+"_"+startDate.toDateString()+"_"+today.getMilliseconds()+"_"+Math.floor(Math.random()*10000);

    const gameSeeds = Array.from({length: eventData.gamesNumber}, () => Math.floor(Math.random() * 100000));

    let themeGroup = Math.round(Math.random()*GameThemesGroups.length);

    themeGroup = 0; // Last Decision for Only 3 themes fixed

    if (themeGroup<0 || themeGroup>=GameThemesGroups.length){
        themeGroup = 0;
    }
    console.log("Using group: "+themeGroup+" -> "+GameThemesGroups[themeGroup]);
    eventData.gameThemes = GameThemesGroups[themeGroup];
    eventData.eventId = eventId;
    eventData.name = eventName;

    eventData.startDate = startDate.toUTCString();

    console.log(
        " StartDate :"+ startDate.toLocaleString()+
        " eventData in UTC: "+eventData.startDate+
        " current utc: "+today.toUTCString()+
        " current locale: "+today.toLocaleString()+
        " recovered: "+new Date(eventData.startDate).toLocaleString('en-US',{
            timeZone:'America/Los_Angeles', timeStyle: 'full'
        })
    );
    eventData.gameSeeds = gameSeeds;
    eventData.gameSongs = [
        "","",""
    ]
    eventData.numberOfPrizes = numberOfPrizes;

    return eventData;
}

export async function addCarrouselImage(eventId: string, imageUrl: string): Promise<any>{
    const carrouselImagesRef = admin.database()
        .ref(tournament.Active_Tournaments_DB+'/'+eventId+"/carrouselImages");
    const carImgs=await carrouselImagesRef.once("value");
    let idx = 0;
    if (carImgs.exists()) {
        idx = carImgs.numChildren()
    }
    return carrouselImagesRef.child(""+idx).set({imageUrl});
    /*
    return admin.database()
        .ref(tournament.Active_Tournaments_DB+'/'+eventId+"/carrouselImages")
        .push().set({imageUrl});*/
}

export async function setCarrouselImage(eventId: string, carrouselDataSnap: DataSnapshot): Promise<any>{
    return admin.database()
        .ref(tournament.Active_Tournaments_DB+'/'+eventId+"/carrouselImages")
        .set(carrouselDataSnap.val());
}


//#region  CreditsOnly


const ZplnEventsSerieDuration = 48; // updated

const ZplnEventsImages = [
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT1.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT2.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT3.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT4.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT5.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT6.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT7.jpg"
];

const BackgroundImages = [
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT1BG.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT2BG.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT3BG.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT4BG.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT5BG.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT6BG.jpg",
    "gs://"+appOptions.storageBucket+"/Images/Events/July2022/EVENT7BG.jpg"
]

const ZplnEventsSponsorLogo = "gs://"+appOptions.storageBucket+"/Images/Events/June2022/sponsored-by-zenduja.png";
const ZplnEventsBrandLogo = "gs://"+appOptions.storageBucket+"/Images/Events/June2022/zpln-logo.png";






export async function createZplnEvents(delayInDays: number=0,
                                       from: number=0,
                                       to:number=ZplnEventsImages.length): Promise<any>{

    console.log("Creating ZplnEvents ("+from+","+to+") delay = "+delayInDays)
    let result:any[]  = [];
    let delay = delayInDays;
    for (let i=from; i<to; i++) {
        const img = ZplnEventsImages[i];
        const images = {
            brandLogo: ZplnEventsBrandLogo,
            sponsorLogo: ZplnEventsSponsorLogo,
            prizeScreen: img,
            postgameScreen: img,
            posteventScreen: img,
            prizeImage: img,
            backgroundImage: BackgroundImages[i]
        };
        result.push(await createZplnEvent(delay,"VIP Event "+(i+1), images, i));
        delay ++;
    }
    return result;
}

async function createZplnEvent(delayInDays: number=0, eventName:string = "VIP Event", images:any, zplnIndex: number): Promise<any>{
    let eventData = CoinsOnly_Template;
    eventData.phaseHours= ZplnEventsSerieDuration;
    eventData.remainingTime= ZplnEventsSerieDuration;
    eventData.remainsHours= ZplnEventsSerieDuration;

    eventData.isZplnEvent = true;
    eventData.isBrandEvent = true;
    eventData.autoRenewal = false;
    eventData.zplnIndex = zplnIndex;

    eventData = {...eventData,...images};
    return await createCoinsOnlyEvent(delayInDays, eventName,DefaultNumberOfPrizes,eventData);
}



export async function getCurrentAudienceEventRunning(): Promise<DataSnapshot|null> {
    const eventsData = await  admin.database().ref(tournament.Active_Tournaments_DB).once('value');
    let eventId: DataSnapshot|null = null;

    await eventsData.forEach((eventData)=>{

        if (eventData.child("isAudienceEvent").val()===true){
            eventId = eventData;

            return true;
        }
        return false;
    });
    return eventId;
}

export async function getCurrentCoinBasedEventRunning(): Promise<DataSnapshot|null> {
    const eventsData = await  admin.database().ref(tournament.Active_Tournaments_DB).once('value');
    let eventId: DataSnapshot|null = null;

    await eventsData.forEach((eventData)=>{

        if (eventData.child("isCoinBasedEvent").val()===true){
            eventId = eventData;

            return true;
        }
        return false;
    });
    return eventId;
}

//#endregion

//region CashAndCredits
const DefaultCashAndCreditsImages = {
    brandTextImage: ZplnEventsSponsorLogo,//"gs://"+appOptions.storageBucket+"/Images/Events/PreBeta/starbucks-logo64.png",
    brandLogoImage: ZplnEventsBrandLogo,
    prizeScreen: ZplnEventsImages[0],
    backgroundImage: BackgroundImages[0],
    postgameScreen:  "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Daily event.png",
    posteventScreen: "",
    prizeImage:""
};
export const CashAndCredits_Template = {...DefaultEventData, ...DefaultCashAndCreditsImages,...{
        eventType : Event_Types.CashAndCredits,
        isBrandEvent: true,
        isZplnEvent: true,
        creditJackpot: DefaultCreditJackpot,
    }};
export const CashAndCreditsPrize_Template = {
    description: "",
    cash: 0,
    credits: 0,
    rank: 1,
    image: DefaultCashAndCreditsImages.prizeScreen
};

const DefaultCashPrizes =
    [
        350,300,250,100,80,
        70,60,50,40,30,
        10,10,10,10,10,
        10,10,10,10,10,
        10,10,10,10,10
    ]
/*    [
        500,20,20,20,20,
        20,20,20,20,20
    ]
    /*[
        300,200,100,90,80,
        70,60,50,40,30
    ]*/
/*
/*[
    50,37.50,25,20,17.50,
    12.50,10,9,8,7,
    6,5,0,0,0,
    0,0,0,0,0,
    0,0,0,0,0
]/[
    100,50,35,25,20,
    15,13,12,11,10,
    9,8,7,6,5,
    4,4,4,4,4,
    3,3,3,3,3
]*/

export async function createCashAndCreditsEvent(delayInDays: number,
                                                defaultDescription:string,
                                                imageIndex: number =0,
                                                imageList: string[] = ZplnEventsImages,
                                                backgroundList: string[] = BackgroundImages,
                                                eventName:string="VIP Event",
                                                numberOfPrizes:number=DefaultNumberOfPrizes,
                                                prizesList:number[]=DefaultCashPrizes,
                                                template:any=CashAndCredits_Template): Promise<any>{
    let eventData:any = template;
    eventData = createGeneralEventInfo(eventData,eventName,delayInDays,numberOfPrizes);
    eventData.totalPrize = defaultDescription;
    eventData.prizeScreen= imageList[imageIndex];
    eventData.backgroundImage = backgroundList[imageIndex];

    let prizes:any[] = [];
    for (let i=0;i<eventData.numberOfPrizes;i++){

        let desc = "$1";
        let prize:number = 1;
        if (i<prizesList.length){
            desc = "$"+prizesList[i];
            prize = prizesList[i]
        } else {
            desc = "$0";
            prize = 0;
        }

        prizes.push({...CashAndCreditsPrize_Template,
            ...{rank:i+1, description: desc, cash: prize, image:eventData.prizeImage}})
    }
    // @ts-ignore
    eventData.prizes =prizes;

    return admin.database()
        .ref(tournament.Active_Tournaments_DB+'/'+eventData.eventId)
        .set(eventData)
        .catch(()=>{return "";})
        .then(()=>{
            return tournament.precalculateCreditPrizeAllocation(eventData.eventId, eventData.creditJackpot)
                .then(()=>{return eventData.eventId;})
                .catch(()=>{return ""});
        });


}

//endregion

//#region CoinsAndCredits
const DefaultCoinsAndCreditsImages = {
    sponsorLogo: "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Dailycoins.png",//"gs://"+appOptions.storageBucket+"/Images/Events/October2021/Daily_Coins.png",
    prizeScreen: "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Dailycoins.png",
    postgameScreen:  "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Dailycoins.png",
    posteventScreen: "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Dailycoins.png",
    prizeImage:"gs://"+appOptions.storageBucket+"/Images/Events/December2021/Dailycoins.png"
};

const DailyEventsImages = ["gs://"+appOptions.storageBucket+"/Images/Events/December2021/Dailycoins.png"]

export const CoinsAndCredits_Template = {...DefaultEventData,...DefaultCoinsAndCreditsImages,...{
        eventType : Event_Types.CoinAndCredits,
        creditJackpot: DefaultCreditJackpot,
        coinsVault: DefaultCoinsJackpot
    }};
export const CoinsAndCreditsPrize_Template = {
    credits: 0,
    coins: 0,
    rank: 1,
    image: DefaultCoinsAndCreditsImages.prizeImage
};

export async function createDailyEvent(delayInDays: number): Promise<any>{
    let eventData = CoinsAndCredits_Template;
    eventData.isDailyEvent = true;

    const today = new Date();
    const idx = (today.getDay()+delayInDays)%DailyEventsImages.length;
    const img = DailyEventsImages[idx];
    const images = {
        sponsorLogo: img,
        prizeScreen: img,
        postgameScreen: img,
        posteventScreen: img,
        prizeImage: img
    };
    eventData = {...eventData,...images};
    return createCoinsAndCreditsEvent(delayInDays, "Daily Event "+idx, DefaultNumberOfPrizes, eventData)
}

export async function createCoinsAndCreditsEvent(delayInDays: number, eventName:string="Credit Event",
                                             numberOfPrizes:number=DefaultNumberOfPrizes, template:any=CoinsAndCredits_Template): Promise<any>{
    let eventData = template;
    eventData = createGeneralEventInfo(eventData,eventName,delayInDays,numberOfPrizes);

    let prizes = [];
    for (let i=0;i<eventData.numberOfPrizes;i++){
        prizes.push({...CoinsAndCreditsPrize_Template,
            ...{rank:i+1, coins:eventData.coinsVault, image:eventData.prizeImage}})
    }
    // @ts-ignore
    eventData.prizes =prizes;

    return admin.database()
        .ref(tournament.Active_Tournaments_DB+'/'+eventData.eventId)
        .set(eventData)
        .catch(()=>{return "";})
        .then(()=>{
            return tournament.precalculateCreditPrizeAllocation(eventData.eventId, eventData.creditJackpot)
                .catch(()=>{return "";})
                .then(()=>{return tournament.precalculateCoinsPrizeAllocation(eventData.eventId, eventData.coinsVault)
                    .catch(()=> {return "";})
                    .then(()=> {return {eventId:eventData.eventId};})
                });
        });
}
//#endregion

//#region EGiftOnly
const DefaultEGiftOnlyImages = {
    sponsorLogo: "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Jackpot.png",//"gs://"+appOptions.storageBucket+"/Images/Events/October2021/Zpln_Jackpot.png",
    prizeScreen: "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Jackpot.png",
    postgameScreen:  "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Jackpot.png",
    posteventScreen: "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Jackpot.png",
    prizeImage:"gs://"+appOptions.storageBucket+"/Images/Events/December2021/Jackpot.png"
};

export const EGiftOnly_Template = {...DefaultEventData,...DefaultEGiftOnlyImages,...{
        eventType : Event_Types.EGiftOnly,
        gamesNumber: DefaultNumberOfGames,
        phaseHours: DefaultSerieDurantion,
        remainsHours: DefaultSerieDurantion,
    }};
export const EGiftOnlyPrize_Template = {
    description: "$ eGift",
    rank: 1,
    image: DefaultEGiftOnlyImages.prizeImage
};


export async function createEGiftOnlyEvent(delayInDays: number, eventName:string="Credit Event",
                                           numberOfPrizes:number=DefaultNumberOfPrizes,
                                           defaultDescription:string,
                                           descriptions: string[]=[],
                                           template: any=EGiftOnly_Template): Promise<any>{
    let eventData = template;
    eventData = createGeneralEventInfo(eventData,eventName,delayInDays,numberOfPrizes);

    let prizes = [];
    for (let i=0;i<eventData.numberOfPrizes;i++){
        let desc = defaultDescription;
        if (i<descriptions.length) desc = descriptions[i];

        prizes.push({...EGiftOnlyPrize_Template,
            ...{rank:i+1, description:desc, image:eventData.prizeImage, egift: desc}})
    }
    // @ts-ignore
    eventData.prizes =prizes;

    return admin.database()
        .ref(tournament.Active_Tournaments_DB+'/'+eventData.eventId)
        .set(eventData)
        .catch(()=>{return "";})
        .then(()=>{
            return  {eventId:eventData.eventId};
        });


}
//#endregion

//#region EGiftAndCredits
const DefaultEGiftAndCreditsImages = {
    sponsorLogo: "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Sponser2.png",//"gs://"+appOptions.storageBucket+"/Images/Events/PreBeta/starbucks-logo64.png",
    prizeScreen: "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Sponser2.png",//"gs://"+appOptions.storageBucket+"/Images/Events/Beta/Adidas/adidas_3.jpg",
    postgameScreen:  "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Sponser2.png",
    posteventScreen: "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Sponser2.png",
    prizeImage:"gs://"+appOptions.storageBucket+"/Images/Events/December2021/Sponser2.png"
};
export const EGiftAndCredits_Template = {...DefaultEventData,...DefaultEGiftAndCreditsImages,...{
        eventType : Event_Types.EGiftAndCredits,
        creditJackpot: DefaultCreditJackpot,
    }};
export const EGiftAndCreditsPrize_Template = {
    description: "$ e-Gift",
    credits: 0,
    rank: 1,
    image: DefaultEGiftAndCreditsImages.prizeImage
};

const BrandEGiftCardPrizes = 25;
const BrandEventDuration = 48;

const PrizePackages=[
    [1200,1000,900,800,700,650,600,550,500,450,400,
        350,300,250,225,200,175,150,125,100,75,75,75,75,75],
    [3000,2500,2250,2000,1750,1625,1500,1375,1250,
1125,1000,875,750,625,565,500,440,375,325,250,
200,200,200,200,200]
]
const PrizePackageDescription= ["$10000","$25000"]
export async function createBrandEvent(delayInDays: number,
                                       eventName: string,
                                       prizePackageId:number=0): Promise<any> {
    let eventData = EGiftAndCredits_Template;
    eventData.gamesNumber = DefaultNumberOfGames;
    eventData.phaseHours = BrandEventDuration;
    eventData.remainingTime = BrandEventDuration;
    eventData.remainsHours = BrandEventDuration;
    eventData.brandPrizePackage = prizePackageId;

    eventData.isBrandEvent = true;

    const descriptions:string[] = [];

    const prizes = PrizePackages[prizePackageId];

    for (let i=0; i<prizes.length; i++){
        if (i>=BrandEGiftCardPrizes){
            descriptions.push("");
        }else {
            descriptions.push("$"+(prizes[i])+" e-Gift");
        }

    }

    return createEGiftAndCreditsEvent(delayInDays, eventName,
        prizes.length, PrizePackageDescription[prizePackageId], descriptions,eventData)
}

export async function addBrandImages(eventId: string, imageLogoUrl: string, imageTextUrl:string): Promise<any>{
    console.log("Add brand images to: "+eventId+" ("+imageLogoUrl+","+imageTextUrl+")");
    return admin.database()
        .ref(tournament.Active_Tournaments_DB+'/'+eventId)
        .update({
            brandLogoImage: imageLogoUrl,
            brandTextImage: imageTextUrl});
}

export async function createEGiftAndCreditsEvent(delayInDays: number, eventName:string="eGift And Credit Event",
                                           numberOfPrizes:number=DefaultNumberOfPrizes,
                                           defaultDescription:string,
                                                 descriptions:string[]=[],
                                                 template:any=EGiftAndCredits_Template): Promise<any>{
    let eventData = template;
    eventData = createGeneralEventInfo(eventData,eventName,delayInDays,numberOfPrizes);
    eventData.totalPrize = defaultDescription;

    let prizes = [];
    for (let i=0;i<eventData.numberOfPrizes;i++){
        let desc = defaultDescription;
        if (i<descriptions.length) desc = descriptions[i];

        prizes.push({...EGiftAndCreditsPrize_Template,
            ...{rank:i+1, description: desc, egift: desc, image:eventData.prizeImage}})
    }
    // @ts-ignore
    eventData.prizes =prizes;

    return admin.database()
        .ref(tournament.Active_Tournaments_DB+'/'+eventData.eventId)
        .set(eventData)
        .catch(()=>{return "";})
        .then(()=>{
            return tournament.precalculateCreditPrizeAllocation(eventData.eventId, eventData.creditJackpot)
                .then(()=>{return eventData.eventId;})
                .catch(()=>{return ""});
        });


}
//#endregion


//#region  CoinsOnly

const EventsBrandLogoImage = "gs://"+appOptions.storageBucket+"/Images/Events/June2022/sponsored-by-zenduja.png";
const EventsBrandTextImage = "gs://"+appOptions.storageBucket+"/Images/Events/June2022/zpln-logo.png";
const EventsBackgroundImage = "gs://"+appOptions.storageBucket+"/Images/Events/June2022/zpln-logo.png";



const DefaultCoinsOnlyImages = {
    brandTextImage: EventsBrandTextImage,//"gs://"+appOptions.storageBucket+"/Images/Events/October2021/Zpln_Event.png",
    brandLogoImage: EventsBrandLogoImage,
    backgroundImage: EventsBackgroundImage,
    creditprizeScreen: "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Daily event.png",
    postgameScreen:  "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Daily event.png",
    posteventScreen: "gs://"+appOptions.storageBucket+"/Images/Events/December2021/Daily event.png",
    prizeImage:"gs://"+appOptions.storageBucket+"/Images/Events/December2021/Daily event.png"
};
export const CoinsOnly_Template = {
    ...DefaultEventData,
    ...DefaultCoinsOnlyImages,
    ...{
        eventType : Event_Types.CoinsOnly,
        creditJackpot: DefaultCoinsJackpot,
    }};
export const CoinsOnlyPrize_Template = {
    coins: 0,
    rank: 1,
    image: DefaultCoinsOnlyImages.prizeImage
};

// const DefaultEventCoinPrizes = [
//     500, 475, 450, 425, 400,
//     375, 350, 325, 300, 275,
//     250, 225, 200, 175, 150
// ]
export async function createCoinsOnlyEvent(delayInDays: number, eventName:string="Credit Event",
                                             numberOfPrizes:number=DefaultNumberOfPrizes, template:any=CoinsOnly_Template): Promise<any>{
    let eventData = template;

    eventData = createGeneralEventInfo(eventData,eventName,delayInDays,numberOfPrizes);

    // let prizes = [];
    // let coinsPrize = 0
    // for (let i=0;i<eventData.numberOfPrizes;i++){
    //     if (i<DefaultEventCoinPrizes.length){
    //         coinsPrize = DefaultEventCoinPrizes[i]
    //     } else{
    //         coinsPrize = 0
    //     }
    //     prizes.push({
    //         ...CoinsOnlyPrize_Template,
    //         ...{rank:i+1,
    //             coins: coinsPrize,
    //             //image:eventData.prizeImage
    //         }
    //     })
    // }
    // // @ts-ignore
    // eventData.prizes =prizes;

    return admin.database()
        .ref(tournament.Active_Tournaments_DB+'/'+eventData.eventId)
        .set(eventData)
        .catch((err)=>{
            console.warn("Renew "+eventData.eventId+ " error "+err);
            return {eventId:"", eventData: eventData};
        })
        .then(()=>{
            console.log("Renew "+eventData.eventId+ " ok ");
            return {eventId:eventData.eventId, eventData: eventData};
        });
}

const HighScoreEventCoinPrizes = [
    1000, 950, 900, 850, 800,
    750, 700, 650, 600, 550,
    500, 450, 400, 350, 300
]
const HighScoreEventSerieDuration = 168; //1 week
const HighScoreEventImages = [
    "gs://"+appOptions.storageBucket+"/Images/Events/June2022/WeeklyHighscoreEvent-l.jpg"
    ];
const HighScoreEventJackpot = 9750;
export async function createHighScoreEvent(delayInDays: number): Promise<any>{
    let eventData = CoinsOnly_Template;
    eventData.isHighScoreEvent = true;

    eventData.remainsHours= HighScoreEventSerieDuration;
    eventData.coinsJackpot = HighScoreEventJackpot;

    const img = HighScoreEventImages[0];
    //eventData.sponsorLogo= img; //Could be removed
    eventData.creditprizeScreen= img; // Main image of Event
    eventData.postgameScreen= img;
    eventData.posteventScreen= img; //Could be removed
    eventData.prizeImage = img; //Could be removed
    eventData.brandLogoImage = ZplnEventsBrandLogo; // first image under main
    eventData.brandTextImage = ZplnEventsSponsorLogo; // image to be added after "sponsored by"

    const createResult = await createCoinsOnlyEvent(delayInDays, "HighScore Event ",
        DefaultNumberOfPrizes, eventData);

    if (createResult.eventId === "") {
        console.error("Create HighScore Event ERROR: "+ JSON.stringify(createResult))
        return createResult;
    }

    let prizes: any[] = [];
    let coinsPrize: number = 0
    for (let i=0;i<eventData.numberOfPrizes;i++){
        if (i<HighScoreEventCoinPrizes.length){
            coinsPrize = HighScoreEventCoinPrizes[i]
        } else{
            coinsPrize = 0
        }
        prizes.push({
            ...CoinsOnlyPrize_Template,
            ...{rank:i+1,
                coins: coinsPrize,
                //image:eventData.prizeImage
            }
        })
    }

    return admin.database()
        .ref(tournament.Active_Tournaments_DB+'/'+createResult.eventId)
        .update({prizes: prizes})
        .then(()=>{ return {...createResult,...{prizes: prizes}}})
        .catch((err)=>{ return {error:err}});

}

const TopPlayerEventImages = {
    sponsorLogo: "gs://"+appOptions.storageBucket+"/Images/Events/June2022/TopPlayerEvent-l.jpg",//"gs://"+appOptions.storageBucket+"/Images/Events/October2021/Zpln_Jackpot.png",
    brandLogoImage: "gs://"+appOptions.storageBucket+"/Images/Events/June2022/zpln-logo.png",
    brandTextImage: "gs://"+appOptions.storageBucket+"/Images/Events/June2022/sponsored-by-zenduja.png",
    creditprizeScreen: "gs://"+appOptions.storageBucket+"/Images/Events/June2022/TopPlayerEvent-l.jpg",
    postgameScreen:  "gs://"+appOptions.storageBucket+"/Images/Events/June2022/TopPlayerEvent-l.jpg",
    posteventScreen: "gs://"+appOptions.storageBucket+"/Images/Events/June2022/TopPlayerEvent-l.jpg",
    prizeImage:"gs://"+appOptions.storageBucket+"/Images/Events/June2022/TopPlayerEvent-l.jpg"
};

const TopPlayerSerieDuration = 168; //1 week //720; // 1 month //1440; // 2 month // //

const TopPlayerCashPrizes: number[] =
    [
        1200, 1000, 900, 850, 800,
        750, 700, 650, 600, 550,
        500, 450, 400, 350, 300
    ]

export async function createTopPlayerEvent(delayInDays: number): Promise<string> {
    const eventData = {...CoinsOnly_Template,...TopPlayerEventImages};
    eventData.isJackpotEvent = true;
    eventData.phaseHours= TopPlayerSerieDuration;
    eventData.remainsHours= TopPlayerSerieDuration;

    const createResult = await createCoinsOnlyEvent(delayInDays, "TopPlayer Event ",
        DefaultNumberOfPrizes, eventData);

    if (createResult.eventId === "") {
        console.error("Create HighScore Event ERROR: "+ JSON.stringify(createResult))
        return createResult;
    }

    let prizes: any[] = [];
    let coinsPrize: number = 0
    for (let i=0;i<eventData.numberOfPrizes;i++){
        if (i<TopPlayerCashPrizes.length){
            coinsPrize = TopPlayerCashPrizes[i]
        } else{
            coinsPrize = 0
        }
        prizes.push({
            ...CoinsOnlyPrize_Template,
            ...{rank:i+1,
                coins: coinsPrize,
                //image:eventData.prizeImage
            }
        })
    }
    return admin.database()
        .ref(tournament.Active_Tournaments_DB+'/'+createResult.eventId)
        .update({prizes: prizes})
        .then(()=>{ return {...createResult,...{prizes: prizes}}})
        .catch((err)=>{ return {error:err}});

}

const SponsoredEventPrizes: number[] =
    [
        500, 450, 425, 400, 375,
        350, 325, 300, 275, 250,
        225, 200, 175, 150, 125,
        100, 90, 80, 70, 60,
        50, 40, 30, 20, 10,
    ]

const SponsoredEventImages = {
    BrandImageEntry: "gs://"+appOptions.storageBucket+"/Images/Events/Brands/SJ/Entry.png",
    BrandImageGameCompletion: "gs://"+appOptions.storageBucket+"/Images/Events/Brands/SJ/GameCompletion.png",
    BrandImageJoinEvent: "gs://"+appOptions.storageBucket+"/Images/Events/Brands/SJ/JoinEvent.png",
    BrandImageLeaderboard: "gs://"+appOptions.storageBucket+"/Images/Events/Brands/SJ/Leaderboard.png",
    BrandImageLogo: "gs://"+appOptions.storageBucket+"/Images/Events/Brands/SJ/Logo.png",
    BrandImagePostGameStats: "gs://"+appOptions.storageBucket+"/Images/Events/Brands/SJ/PostGameStats.png",
    BrandImageResults: "gs://"+appOptions.storageBucket+"/Images/Events/Brands/SJ/Results.png",
    BrandImageRunwayImage: "gs://"+appOptions.storageBucket+"/Images/Events/Brands/SJ/RunwayImage.png",
};

export const SponsoredEventDataTemplate = {
    autoRenewal: false,
    backgroundImage: "",
    brandColor: "125,125,125,255",
    brandLogoImage: "gs://zpln-3be94.appspot.com/Images/Events/Brands/SJ/Logo.png",
    brandText: "Official Event Sponsor",
    brandTextImage: "gs://zpln-3be94.appspot.com/Images/Events/Brands/SJ/Logo.png",
    coinsCost: 50,
    coinsJackpot: 10000,
    creditprizeScreen: "gs://zpln-3be94.appspot.com/Images/Events/Brands/SJ/JoinEvent.png",
    currentPhase: 1,
    eventId: "EventId",
    eventOrder: 1000,
    eventType: 6,
    finaleBackgroundImage: "",
    gamesNumber: DefaultNumberOfGames,
    gameSeeds: DefaultGameSeeds,
    gameSongs: DefaultGameSongs,
    gameThemes: DefaultGameThemes,
    isActiveToday: true,
    isAudienceEvent: false,
    isBrandEvent: true,
    isHighScoreEvent: false,
    isJackpotEvent: false,
    isZplnEvent: true,
    joinBackgroundImage: "",
    name: "EventName",
    numberOfPhases: 1,
    numberOfPrizes: 25,
    prizes: [],
    remainsHours: DefaultSerieDurantion,
    shouldUpdate: true,
    startDate: new Date().toUTCString(),
    videoURL: "",
    ...SponsoredEventImages
};

// export async function createSponsoredEvent(delayInDays: number): Promise<string> {//WIP
//     const eventData = {
//         ...SponsoredEventDataTemplate,
//         };

//     //add code to check the input received and respectively apply those changes to the params that are received, also validate before updating.

//     const createResult = await createCoinsOnlyEvent(delayInDays, "Sponsored Event ",
//         DefaultNumberOfPrizes, eventData);

//     if (createResult.eventId === "") {
//         console.error("Create Sponsored Event ERROR: "+ JSON.stringify(createResult))
//         return createResult;
//     }

//     let prizes: any[] = [];
//     let coinsPrize: number = 0

//     for (let i=0;i<eventData.numberOfPrizes;i++){
//         if (i<SponsoredEventPrizes.length){
//             coinsPrize = SponsoredEventPrizes[i]
//         } else{
//             coinsPrize = 0
//         }
//         prizes.push({
//             ...CoinsOnlyPrize_Template,
//             ...{rank:i+1,
//                 coins: coinsPrize,
//                 //image:eventData.prizeImage
//             }
//         })
//     }

//     return admin.database()
//         .ref(tournament.Active_Tournaments_DB+'/'+createResult.eventId)
//         .update({prizes: prizes})
//         .then(()=>{ return {...createResult,...{prizes: prizes}}})
//         .catch((err)=>{ return {error:err}});

// }

///------------------New Event creation system start-----------------///
export async function createSponsoredEvent(delayInDays: number, templateOverride?: any): Promise<any> { // updated to accept override
  try {
    // clone base template and merge override (do not mutate exported const)
    const baseTemplate: any = JSON.parse(JSON.stringify(SponsoredEventDataTemplate || {}));
    const override: any = templateOverride || {};

    // allow-list of fields we accept from override
    const allowedFields = [
      "name", "brandLogoImage", "brandText", "brandTextImage",
      "coinsCost", "coinsJackpot", "creditprizeScreen",
      "isAudienceEvent", "isBrandEvent", "isEchoEvent", "isExhibitionEvent",
      "isHighScoreEvent", "isJackpotEvent", "isZplnEvent",
      "redirectURL", "totalAttemptsAllowed", "videoURL", "visitSponsorReward",
      "joinBackgroundImage", "finaleBackgroundImage", "startDate", "remainsHours",
      "numberOfPrizes", "gameSeeds", "gameSongs", "gameThemes", "prizes", "numberOfPlayers",
      "numberOfPhases", "eventOrder", "eventType", "prizes"
    ];

    // simple sanitizers
    const parseNumber = (v: any, def: number) => {
      if (v === undefined || v === null || v === "") return def;
      const n = Number(v);
      return isNaN(n) ? def : n;
    };
    const parseBool = (v: any, def: boolean) => {
      if (v === undefined || v === null) return def;
      if (typeof v === "boolean") return v;
      const s = String(v).toLowerCase();
      return s === "true" || s === "1" || s === "yes";
    };
    const parseJSONorArray = (v: any, def: any) => {
      if (v === undefined || v === null || v === "") return def;
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try { return JSON.parse(v); } catch { return v.split(",").map((s: string) => s.trim()).filter(Boolean); }
      }
      return v;
    };

    // build filtered overrides
    const filtered: any = {};
    for (const k of allowedFields) {
      if (override[k] === undefined) continue;
      switch (k) {
        case "coinsCost":
        case "coinsJackpot":
        case "visitSponsorReward":
        case "remainsHours":
        case "numberOfPrizes":
        case "numberOfPlayers":
        case "numberOfPhases":
        case "eventOrder":
        case "eventType":
        case "totalAttemptsAllowed":
          filtered[k] = parseNumber(override[k], baseTemplate[k]);
          break;
        case "isAudienceEvent":
        case "isBrandEvent":
        case "isEchoEvent":
        case "isExhibitionEvent":
        case "isHighScoreEvent":
        case "isJackpotEvent":
        case "isZplnEvent":
          filtered[k] = parseBool(override[k], baseTemplate[k]);
          break;
        case "gameSeeds":
        case "gameSongs":
        case "gameThemes":
        case "prizes":
          filtered[k] = parseJSONorArray(override[k], baseTemplate[k]);
          break;
        default:
          filtered[k] = override[k];
      }
    }

    const eventData: any = {
      ...baseTemplate,
      ...filtered,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // ensure name and numberOfPrizes defaults
    eventData.name = eventData.name || "Sponsored Event";
    eventData.numberOfPrizes = Number(eventData.numberOfPrizes || DefaultNumberOfPrizes);

    // call existing creator
    const createResult: any = await createCoinsOnlyEvent(delayInDays, eventData.name, eventData.numberOfPrizes, eventData);

    if (!createResult || !createResult.eventId) {
      console.error("Create Sponsored Event ERROR: " + JSON.stringify(createResult));
      return { error: "createCoinsOnlyEvent failed", detail: createResult };
    }

    // build prizes array (reuse SponsoredEventPrizes or zeros)
    const prizes: any[] = [];
    let coinsPrize = 0;
    for (let i = 0; i < eventData.numberOfPrizes; i++) {
      if (i < (eventData.prizes && eventData.prizes.length ? eventData.prizes.length : 0)) {
        // if explicit prizes provided in override use them
        const p = eventData.prizes[i];
        prizes.push({
          ...CoinsOnlyPrize_Template,
          ...(typeof p === "object" ? p : { rank: i + 1, coins: Number(p || 0) })
        });
      } else {
        if (i < SponsoredEventPrizes.length) coinsPrize = SponsoredEventPrizes[i];
        else coinsPrize = 0;
        prizes.push({
          ...CoinsOnlyPrize_Template,
          rank: i + 1,
          coins: coinsPrize
        });
      }
    }

    await admin.database()
      .ref(tournament.Active_Tournaments_DB + '/' + createResult.eventId)
      .update({ prizes: prizes });

    return { ...createResult, prizes };
  } catch (err) {
    console.error("createSponsoredEvent error:", err);
    return { error: String(err) };
  }
}
// ...existing code...

////------------------------------------------------------------------////

//#endregion



export async function renewEvent(tour: admin.database.DataSnapshot): Promise<any> {
    const eventType = tour.child("eventType").val();
    const eventName = tour.child("name").val();
    const eventId = tour.child("eventId").val()
    console.log("renewEvent: Renew "+eventId+" ("+eventName+") => "+eventType);
    switch (eventType) {
        case Event_Types.EGiftOnly:
            const isJpEvent = Boolean(tour.child("isJackpotEvent").val());
            if (isJpEvent) {
                console.log("Reset Jackpot Event");
                await leaderboards.resetJackpotLeaderboard();
                return await createTopPlayerEvent(0);
            }
            break;
        case Event_Types.EGiftAndCredits:

            const isBrandEvent = Boolean(tour.child("isBrandEvent").val());
            console.log("Renew brand event "+tour.key+": "+isBrandEvent);
            if (isBrandEvent){
                const brandLogo = tour.child("brandLogoImage").val();
                const brandText = tour.child("brandTextImage").val();
                const prizePackage=  tour.child("brandPrizePackage").val();
                const newEventId= await createBrandEvent(0,eventName,prizePackage);
                await addBrandImages(newEventId,brandLogo,brandText);
                await setCarrouselImage(newEventId,tour.child("carrouselImages"));
                return newEventId;

            }
            break;

        case Event_Types.CoinsOnly:
            const isHSEvent = tour.child("isHighScoreEvent").val();
            console.log(eventId+ " isHighScore "+isHSEvent);
            if (isHSEvent) {
                console.log("Reset HighScore Event");
                await leaderboards.resetHighScoreLeaderboard();
                return await createHighScoreEvent(0)
            }
            const isTPEvent = tour.child("isHighScoreEvent").val();
            console.log(eventId+ " isHighScore "+isHSEvent);
            if (isTPEvent) {
                console.log("Reset HighScore Event");
                await leaderboards.resetJackpotLeaderboard();
                return await createTopPlayerEvent(0)
            }
/*
            const isAuEvent = tour.child("isAudienceEvent").val();
            console.log(eventId+ " isAudience "+isAuEvent);
            if (isAuEvent){
                console.log("Reset Audience Event");
                await leaderboards.resetAudienceLeaderboard();
                return await createAudienceEvent(0)
            }*/
            console.log("Reset Zpln Event")
            /*const zplnIndex = tour.child("zplnIndex").val();
            const img = ZplnEventsImages[zplnIndex];
            const images = {
                sponsorLogo: img,
                prizeScreen: img,
                postgameScreen: img,
                posteventScreen: img,
                prizeImage: img,
                backgroundImage: BackgroundImages[zplnIndex]
            };
            return await createZplnEvent(0,"Zpln Event", images, zplnIndex);
            */

            return await createCoinsOnlyEvent(0,eventName,DefaultNumberOfPrizes,
                tour.toJSON());
        case Event_Types.CoinAndCredits:
            return await createDailyEvent(0);
    }
}


export async function getCurrentHighScoreEventRunning(): Promise<DataSnapshot|null> {
    const eventsData = await  admin.database().ref(tournament.Active_Tournaments_DB).once('value');
    let jackpotEventId: DataSnapshot|null = null;

    eventsData.forEach((eventData)=>{

        if (eventData.child("isHighScoreEvent").val()===true){
            jackpotEventId = eventData;

            return true;
        }
        return false;
    });
    return jackpotEventId;
}

export async function getCurrentJackpotEventRunning(): Promise<DataSnapshot|null> {
    const eventsData = await  admin.database().ref(tournament.Active_Tournaments_DB).once('value');
    let jackpotEventId: DataSnapshot|null = null;

    eventsData.forEach((eventData)=>{

        if (eventData.child("isJackpotEvent").val()===true){
            jackpotEventId = eventData;

            return true;
        }
        return false;
    });
    return jackpotEventId;
}