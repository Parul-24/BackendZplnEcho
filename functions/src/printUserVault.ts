// ...existing code...
import * as admin from "firebase-admin";

// Initialize admin with DB URL or allow emulator
if (!admin.apps.length) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT || "zpln-3be94";

  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    // Emulator: default init is fine
    admin.initializeApp();
    console.log("Using RTDB emulator:", process.env.FIREBASE_DATABASE_EMULATOR_HOST);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Service account available -> use applicationDefault creds and explicit DB URL
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
    console.log("Initialized Admin SDK with projectId:", projectId);
  } else {
    // Fallback: try default init with inferred DB URL
    admin.initializeApp({
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
    console.log("Initialized Admin SDK fallback with projectId:", projectId);
  }
}
// ...existing code...
async function main() {
  const usersSnap = await admin.database().ref("Users").once("value");
  if (!usersSnap.exists()) {
    console.log("No users found");
    return;
  }

  const users = usersSnap.val();
  const ids = Object.keys(users);
  console.log(`Found ${ids.length} users\n`);

  for (const id of ids) {
    const u = users[id] || {};
    const userName = u.userName ?? "(no userName)";
    const phone = u.phoneNumber ?? u.phone ?? "(no phone)";
    const vault = u.vault ?? {};
    const coins = Number(vault.coins ?? 0);
    const NeoMiningRate = Number(vault.NeoMiningRate ?? vault.NeoMiningRate ?? 0);
    const NeoZplnMining = Number(vault.NeoZplnMining ?? vault.NeoZplnMining ?? 0);

    console.log(`${id} | ${userName} | ${phone} | coins=${coins} | NeoMiningRate=${NeoMiningRate} | NeoZplnMining=${NeoZplnMining}`);
  }
}
main();