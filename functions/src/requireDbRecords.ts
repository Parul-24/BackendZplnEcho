//import * as utils from "./utils";
import * as admin from 'firebase-admin';
import * as tournament from "./tournament";
import * as appVersionChecker from "./appVersionChecker"

export async function updateRequiredFields(): Promise<void> {

    await setAppVersionField();
}

export async function setAppVersionField(): Promise<void> {
    var path = tournament.GameParameters_DB + "/" + appVersionChecker.FieldLiveAppVersion
    const parametersRef = await admin.database().ref(path).once('value');
    let doesFieldExist = parametersRef.exists() ? true : false;

    console.log("requireDbRecords setAppVersionField path:" + path + " doesFieldExist:" + doesFieldExist);
    if (!doesFieldExist) {
        await admin.database().ref(tournament.GameParameters_DB)
            .update({
                [appVersionChecker.FieldLiveAppVersion]: {
                    [appVersionChecker.FieldAndroid]: "0.0",
                    [appVersionChecker.FieldIos]: "0.0"
                }
            }
            )
    }
}

