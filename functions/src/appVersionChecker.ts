import * as admin from 'firebase-admin';
import * as tournament from "./tournament";
//import { compareVersions } from 'compare-versions';

export const FieldLiveAppVersion = "LiveAppVersion";
export const FieldIos = "ios";
export const FieldAndroid = "android";

export async function getTheCurrentAppVersion(platform: string, version: string): Promise<string>{
    var path = tournament.GameParameters_DB + "/" + FieldLiveAppVersion + "/" + FieldIos;
    if (platform === FieldIos) {
        path = tournament.GameParameters_DB + "/" + FieldLiveAppVersion + "/" + FieldIos;
    } else if (platform === FieldAndroid) {
        path = tournament.GameParameters_DB + "/" + FieldLiveAppVersion + "/" + FieldAndroid;
    }

    const parametersRef = await admin.database().ref(path).once('value');
    let doesFieldExist = parametersRef.exists() ? true : false;
    console.log("getTheCurrentAppVersion doesFieldExist:" + doesFieldExist + " - path:" + path);
  
    if(!doesFieldExist)
        return "";

    const currentVersion = (await parametersRef).val();
    return currentVersion;
}

export async function NeedUpdate(platform: string, version: string): Promise<any>{
    const currentVersion = await getTheCurrentAppVersion(platform, version);

    // compareVersions('11.1.1', '10.0.0'); //  1
    // compareVersions('10.0.0', '10.0.0'); //  0
    // compareVersions('10.0.0', '11.1.1'); // -1

    let compareStatus = 0;
    if(version<currentVersion){
       compareStatus=1;
    }
    

    console.log("compareStatus ---" + compareStatus + " --- currentVersion:" + currentVersion + " --- version:" + version);
    return (compareStatus == 1) ? true : false;
    

}