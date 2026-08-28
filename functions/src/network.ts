import * as admin from 'firebase-admin'

//import * as functions from "firebase-functions";
//import * as utils from "./utils";
import DataSnapshot = admin.database.DataSnapshot;


export async function createNetworkList(snapshot: DataSnapshot){
    const parentId = snapshot.child('registrationLink').val();

    const parentRef = admin.database().ref('Users/'+parentId);
    const parentParents = await parentRef.once('value').then((parentSnap)=>{
        const listParents:any[] = [];
        if (parentSnap.exists()){
            parentSnap.child('parents').forEach((parentItem)=>{
                listParents.push(parentItem.val());
            });
        }
        return listParents;
    }).catch();
    if (parentId!='')
        parentParents.unshift(parentId);
    
    console.log("Parent Push:"+parentParents);
    admin.database().ref('Users/'+snapshot.key+'/parents').set(parentParents).catch();
    return true;
}

export async function addNetworkScoreByJoin(tournamentId: string, userId: string){
    const baseUserRef = admin.database().ref("Users/"+userId);

    const result = await baseUserRef.once('value').then(userData=>{
        let parents = userData.child("parents");
        let level = 0;
        parents.forEach(parent=>{
            level++;
            addNetworkScoreToUser(parent.val(),tournamentId,level).catch();
        });
        return true;
    }).catch();
    return result;
}

async function addNetworkScoreToUser(userId: string, tournamentId: string,level:number){
    const baseUserRef = admin.database().ref("Users/"+userId);

    const currentPoints = await baseUserRef.child('NetworkPoints/'+tournamentId+'/Score')
        .once('value').then(points=>{
            if (points.exists()) {
                return Number(points.val());
            }else{
                return 0;
            }
        }).catch();
    let levelPoints = 5;
    if (level < 50) levelPoints = 10;
    if (level < 30) levelPoints = 15;
    if (level < 20) levelPoints = 20;
    if (level < 10) levelPoints = 25;
    if (level === 3) levelPoints = 30;
    if (level === 2) levelPoints = 40;
    if (level === 1) levelPoints = 50;


    await baseUserRef.update({['NetworkPoints/'+tournamentId+'/Score']:currentPoints+levelPoints});
    return true;
}
