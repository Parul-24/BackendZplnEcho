/*
export const addPointsFromJoin =  functions.https.onRequest(async (request, response) => {
  const tId = String(request.query.eventId);
  const uId = String(request.query.userId);
  await network.addNetworkScoreByJoin(tId,uId);

  response.send('Data updated');

});
*/
/*
export const DailyRecapManual =  functions.https.onRequest(async (request, response) => {

  await tournament.dailyRecap(null);

  response.send('Data updated');

});
*/
/*export const addFieldsToDB = functions.https.onRequest(async (request, response) => {

  await AddFieldsInDB();

  response.send('Data updated');

});

export const GetPracticeGameParameters = functions.https.onRequest(async (request, response) => {
  const result = await tournament.getPracticeGameParameters();
  response.send(result);
});


async function AddFieldsInDB(){

  return admin.database().ref('Users/').once('value').then((snapshot) => {

    const promisses : any[] = [];

    snapshot.forEach((child) =>{

      const id : any = child.key;
      console.log(child.key);

      const dbRef = admin.database().ref('Users/').child(id);

      //promisses.push(dbRef.update( { 'myHighScoreCR' : 0, 'myPositionCR':0,  'mySkillCR':0, 'myHighScoreRank':0, 'myPositionRank':0, 'mySkillRank':0}));
      promisses.push(dbRef.update( { 'currentGameLevel' : 'LVL 1', 'currentGameID' : 1}));

    });

    return Promise.all(promisses);

  })

}
*/
/*
export const GetCurrentProfilePic = functions.https.onRequest(async (request, response) => {
  const userId = String(request.query.userId);
  if (request.query.userId === undefined){
    response.send("");
    return;
  }

  const url = await tournament.currentProfilePictureForUser(userId);
  response.send(url);
  return;
});
*/
/*
export const CreateCashEvent = functions.https.onRequest(async (request, response) => {
  let delayInDays: number = Number(request.query.delayInDays);

  if (request.query.delayInDays === undefined) {
    delayInDays = 0;
  }

  let imageIndex: number = Number(request.query.imageIndex);
  if (imageIndex === undefined){
    imageIndex = 0;
  }

  tournament_card.createCashAndCreditsEvent(delayInDays,
      "$227",
      imageIndex)
      .then((resp)=>response.send(resp))
      .catch(()=>response.send("Error"));
});
*/
/*
export const CreateZplnEvents = functions.https.onRequest(async (request, response) => {
  let delayInDays: number = Number(request.query.delayInDays);

  if (request.query.delayInDays === undefined) {
    delayInDays = 0;
  }

  let from: number = Number(request.query.from);

  if (request.query.from === undefined) {
    from = 0;
  }

  let to: number = Number(request.query.to);
  if (request.query.to === undefined) {
    to = 6;
  }

  tournament_card.createZplnEvents(delayInDays, from, to)
      .then((resp)=>response.send(resp))
      .catch(()=>response.send("Error"));
});
*/
/*
export const CreateDailyEvent = functions.https.onRequest(async (request, response) => {
  let delayInDays: number = Number(request.query.delayInDays);

  if (request.query.delayInDays === undefined) {
    delayInDays = 0;
  }
  tournament_card.createDailyEvent(delayInDays)
      .then((resp)=>response.send(resp))
      .catch(()=>response.send("Error"));
});

 */
/*
export const CreateBrandEvent = functions.https.onRequest(async (request, response) => {
  let delayInDays: number = Number(request.query.delayInDays);
  let prizePackageId: number =  Number(request.query.prizePackageId);
  let eventName:string = String(request.query.eventName);

  if (request.query.delayInDays === undefined) {
    delayInDays = 0;
  }
  if (request.query.eventName === undefined) {
    eventName = "unknown";
  }
  if (request.query.prizePackageId === undefined) {
    prizePackageId = 0;
  }

  tournament_card.createBrandEvent(delayInDays,eventName, prizePackageId)
      .then((resp)=>response.send(resp))
      .catch(()=>response.send("Error"));
});
*/
/*
export const AddBrandImages = functions.https.onRequest(async (request, response) => {
  const eventId: string = String(request.query.eventId);
  const logoImage: string = String(request.query.logoImage);
  const textImage: string = String(request.query.textImage);

  if (request.query.eventId === undefined) {
    response.send("No event Id");
    return;
  }
  if (request.query.logoImage === undefined) {
    response.send("No logo Image");
    return;
  }
  if (request.query.textImage === undefined) {
    response.send("No text Image");
    return;
  }

  tournament_card.addBrandImages(eventId,logoImage,textImage)
      .then((resp)=>response.send(resp))
      .catch(()=>response.send("Error"));
});

 */
/*
export const AddCarrouselImage = functions.https.onRequest(async (request, response) => {
  const eventId: string = String(request.query.eventId);
  const image: string = String(request.query.image);

  if (request.query.eventId === undefined) {
    response.send("No event Id");
    return;
  }
  if (request.query.image === undefined) {
    response.send("No Image");
    return;
  }


  tournament_card.addCarrouselImage(eventId,image)
      .then((resp)=>response.send(resp))
      .catch(()=>response.send("Error"));
});


 */
/*
export const PerformFB_DB_Operation = functions.https.onRequest(async (request, response) => {

  const InstagramLink = request.query.InstagramLink;
  const YoutubeLink = request.query.YoutubeLink;
  const TiktokLink = request.query.TiktokLink;
  const FacebookLink = request.query.FacebookLink;
  const TwitterLink = request.query.TwitterLink;

  const userID = request.query.userID;

    if(request.query.methodName === 'updateSocialLinks'){

    await UpdateSocialLinks( String(userID) ,String(TiktokLink),
        String(InstagramLink), String(YoutubeLink),String(FacebookLink),String(TwitterLink));

    console.log('Social links updated');
  }
  else if(request.query.methodName === 'getPlayerProfile'){

    await FetchPlayerProfile(String(userID), response);

    return;

  }

  response.send('Success '+request.query.methodName+"##");
});
*/
/*
async function FetchPlayerProfile(userID : string, resp : functions.Response<any>){

  const dbRef = admin.database().ref('Users/').child(userID);

  return dbRef.once('value').then(snapshot=>{

    MyData = snapshot.val();

    resp.send({
      MyData
    });

  })


}
*/
/*
async function UpdateSocialLinks(userID : string, tiktokLink : string,
                                 instagramLink : string,
                                 youtubeLink : string,
                                 facebookLink: string,
                                 twitterLink: string
){
  console.log('going to update player social links');
  const dbRef = admin.database().ref('Users/').child(userID);
  return dbRef.update( {'tiktokLink' : (tiktokLink),
                        'instagramLink' : (instagramLink),
                        'youtubeLink': (youtubeLink),
                        'facebookLink': facebookLink,
                        'twitterLink': twitterLink
                        });

}
*/
/*
export const createInvitationLink = functions.https.onRequest(async (request, response) => {

  if (request.query.userId=== undefined){
    response.send("Missing UserId");
  }

  const userId = request.query.userId;
  const invitation_link = `https://app.zpln.tv/?link=https://app.zpln.tv/${userId}&apn=com.ab.testzenduja&st=Invite&sd=Invite+a+Friend`;
  response.send(invitation_link);
});
*/
/*
export const RequestWeeklyActivity = functions.https.onRequest(async (request, response) => {

  if (request.query.userId=== undefined){
    response.send("Missing UserId");
    return;
  }

  const userId = String(request.query.userId);
  if (await audience.requestWeeklyAction(userId)){
    response.send("1")
  }else {
    response.send("0")
  }
});

 */
/*
export const CanRequestWeeklyActivity = functions.https.onRequest(async (request, response) => {

  if (request.query.userId=== undefined){
    response.send("Missing UserId");
    return;
  }

  const userId = String(request.query.userId);
  if (await tournament.canRequestWeeklyRewardByUserId(userId)){
    response.send("1")
  }else {
    response.send("0")
  }
});
*/
/*
export const addUser = functions.https.onRequest(async (request, response) => {

  const username  = request.query.username;
  let parentID  = request.query.parentID;
  const userId = request.query.userId;
  let path = tournament.Users_DB;
  if (request.query.userId !== undefined){
    path = path+"/"+userId;
  }
  if (request.query.parentID===undefined){
    parentID = '';
  }

  const dbRef = admin.database().ref(path);

  await dbRef.set({
    SavedAvatarURL : '',
    conversionRate : 0,
    country : '',
    email : '',
    firstName : username,
    lastName: username,
    level : 0,
    phone : '',
    registrationDate : '',
    registrationLink : parentID,
    userId :  userId,
    userName : username,
    vault: {coins: tournament.Weekly_Coins_Reward}

  });
  dbRef.once('value').then(async snap=>{
    //await network.createNetworkList(snap);
    await audience.setParentId(snap.key,snap.child("registrationLink").val());

    await utils.PlayerExtraConfiguration(snap);
  }).catch();



  response.send(dbRef.key);

});
*/
/*
export const ModifyProfile = functions.https.onRequest(async (request, response) => {
  let userId:string|null = String(request.query.userId);
  if (request.query.userId === undefined) {
    response.send("Error: no UserId");
    return;
  }

  let data: any = {userId:userId}
  if (request.query.userName !== undefined)
    data = {...data,...{userName: String(request.query.userName)}};

  if (request.query.profilePic !== undefined)
    data = {...data,...{SavedAvatarURL: String(request.query.profilePic)}};

  if (request.query.firstName !== undefined)
    data = {...data,...{firstName: String(request.query.firstName)}};

  if (request.query.lastName !== undefined)
    data = {...data,...{lastName: String(request.query.lastName)}};

  if (request.query.email !== undefined)
    data = {...data,...{email: String(request.query.email)}};

  if (request.query.email !== undefined)
    data = {...data,...{email: String(request.query.email)}};

  if (request.query.phone !== undefined)
    data = {...data,...{phone: String(request.query.phone)}};


  utils.ModifyUserProfile(userId, data)
      .then(()=>{response.send("1"); return})
      .catch((error)=>{response.send(error); return})
});
*/
/*
export const FakeHighScoreLeaderboard = functions.https.onRequest(async (request, response) => {
  leaderboards.createFakeHighScore(10000).then(() =>{
    return response.send("OK");
  }).catch();
});
*/
/*
export const AddScoreToLeaderboard = functions.https.onRequest(async (request, response): Promise<any> => {

  const eventId = String(request.query.eventId);
  const userId = String(request.query.userId);
  const score = Number(request.query.score);
  if (request.query.eventId === undefined || eventId === ""){
    return response.send({status: "error", message: "Event not defined"})
  }
  if (request.query.userId === undefined || userId === ""){
    return response.send({status: "error", message: "UserId not defined"})
  }

  leaderboards.updateHighScoreLeaderboard(userId,score,0).then(() =>{
    return response.send({status:"ok", message: ""});
  }).catch();
});
*/
