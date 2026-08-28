import * as admin from 'firebase-admin';
import * as tournament from "./tournament";
import * as vault from './vault'
import * as user_utils from './user_utils'
//import { UserRecord } from 'firebase-admin/auth';

const COUNTRYCODE_INDIA = '+91';

export async function analytics_getListOfAllUsernameAndPhonenumbersFromDB(): Promise<string> {

  let responseText = '';

  try {
    const snapshot = await admin.database().ref(`/${tournament.Users_DB}`).once('value');
    const users = snapshot.val();

    // const userNames = [];
    for (const userId in users) {
      const userName = users[userId].userName;
      const phone = users[userId].phone;
      if (userName && phone && !phone.startsWith(COUNTRYCODE_INDIA)) {
        responseText += `${userName}: ${phone}\n`;
      }
      console.log("userId:" + userId + " phone:" + phone + " name:" + userName);
    }

    // response.status(200).send(responseText);
  } catch (error) {
    console.error('Error fetching user names:', error);
    // response.status(500).send('Error fetching user names');
  }

  return responseText;
}

export async function analytics_getPlayersFromCoinBasedLbExceedingChipsCount(coinCountValue: number): Promise<string> {

  var rootRef = await admin.database().ref(tournament.Users_DB);
  var usersArray: { userId: string; coins: any; userName: string, phone:string }[] = [];
  let responseText = '';

  await rootRef.once('value').then(async function (snapshot) {
    snapshot.forEach(function (userSnapshot) {
      var coinsRef = userSnapshot.child(vault.Vault_User_DB + '/' + vault.Coins_Vault_User_DB);
      var coins = coinsRef.val();

      if ((coins != null) && (coins >= coinCountValue)) {

        var userId = String(userSnapshot.key);
        var userName = userSnapshot.child("userName").val();
        var phone = userSnapshot.child("phone").val();
        usersArray.push({ userId: userId, coins: coins, userName: userName, phone: phone });
      }
    });

    usersArray.sort(function (a, b) {
      return b.coins - a.coins;
    });


    usersArray.forEach(element => {
      responseText += `Name:${element.userName} Phone:${element.phone} Coins:${element.coins}\n`;
    });

  }).catch(function (error) {
  });

  return responseText;
}

export async function analytics_getPlayersJoinedAfterGivenTime(time: string): Promise<string> {

  console.log("analytics_getPlayersJoinedAfterGivenTime: " + time);
  let responseText = '';

  let usersRecord = await user_utils.getAllUsersFromAuthDescOrderedByCreationTime();

  // usersRecord.forEach((userRecord) => {
  //   // const details = {
  //   //   uid: userRecord.uid,
  //   //   creationTime: userRecord.metadata.creationTime,
  //   // };
  //   let name = await user_utils.getUsername(userRecord.uid);
  //   responseText += `Name:${name} Phone:${userRecord.phoneNumber} Joined:${userRecord.metadata.creationTime}\n`;
  //   return responseText;
  // });

  const timeAfter = new Date(time);
  responseText += "List of Users joined since " + timeAfter + "\n";
  responseText += "=========================================================================================================================\n";
  for (const userRecord of usersRecord) {
    const creationDate = new Date(userRecord.metadata.creationTime);
    // console.log(timeAfter + " " + creationDate);
    if (creationDate >= timeAfter) {
      try {
        const name = await user_utils.getUsername(userRecord.uid);
        responseText += `Name:${name} Phone:${userRecord.phoneNumber} Joined:${userRecord.metadata.creationTime}\n`;
      } catch (error) {
        console.error('Error processing user record:', error);
      }
    }
  }

  return responseText;
}

export async function analytics_getPlayersAtWave(phone: string, waveNumber: number): Promise<string> {
  let responseText = '';

  const userId = await user_utils.getUserIdByPhoneNumber(phone);
  const usernameOfUserInQuestion = await user_utils.getUsername(userId);
  const childrenSnapshot = await admin.database().ref(`Users/${userId}/childrenIds`).once('value');
  const childrenArr: any[] = childrenSnapshot.val() ? Object.values(childrenSnapshot.val()) : [];

  responseText += `Users under ${usernameOfUserInQuestion}(${phone}) at wave number ${waveNumber}:\n`;

  for (const element of childrenArr) {
    const name = await user_utils.getUsername(element);
    const number = await user_utils.getPhonenumber(element);
    responseText += `Name:${name} Phone:${number}\n`;
  }

  return responseText;
}