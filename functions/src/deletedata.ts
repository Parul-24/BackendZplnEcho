import * as admin from "firebase-admin";
import { appOptions } from "./environments";
import * as vault from "./vault";


if (!admin.apps.length) {
  admin.initializeApp(appOptions);
}

const db = admin.database();



async function main() {
  try {
    // existing behaviour: ensure Active_Tournaments node exists (non-destructive)
    await db.ref("/Active_Tournaments").set("").then(() => console.log("Active_Tournaments node added at root"));

    // destructive operation: reset all users progress/vaults (keeps genealogy intact)
    // WARNING: this will modify many user nodes in your database. Run only when intended.
    const defaultCoins = 5000;
    console.log("Starting ResetAllUsersProgressAndVaults with defaultCoins =", defaultCoins);

    const processed = await vault.ResetAllUsersProgressAndVaults(defaultCoins);
    console.log("ResetAllUsersProgressAndVaults completed. Users processed:", processed);
  } catch (err) {
    console.error("Error in deletedata script:", err);
  } finally {
    process.exit(0);
  }
}

main();
// admin
//   .database()
//   .ref("/Historic_Tournaments")
//   .remove()
//   .then(() => {
//     console.log("Historic_Tournaments node deleted.");
//   })
//   .catch((error) => {
//     console.error(" Error deleting node:", error);
//   });


//   async function findHighScoreEvents() {
//   const ref = admin.database().ref("/Historic_Tournaments");

//   try {
//     const snapshot = await ref.orderByChild("isJackpotEvent").equalTo(true).once("value");

//     if (!snapshot.exists()) {
//       console.log(" No events found with isHighScoreEvent = true.");
//       return;
//     }

//     const result = snapshot.val();
//     console.log(" Matching nodes:");
//     Object.entries(result).forEach(([key, value]) => {
//       console.log(`• ${key}`, value);
//     });

//   } catch (error) {
//     console.error(" Error querying database:", error);
//   }
// }

// findHighScoreEvents();

// const db = admin.database();

// db.ref("/Active_Tournaments")
//   .set("")
//   .then(() => console.log(" Active_Tournaments node added at root"))
//   .catch((error) => console.error(" Failed to add node:", error));
  