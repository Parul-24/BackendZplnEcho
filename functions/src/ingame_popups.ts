import * as admin from 'firebase-admin';
const { v4: uuidv4 } = require('uuid');

export const FieldIngamePopups = "IngamePopups";

export async function createPlaceholder() {
    await admin.database().ref(FieldIngamePopups)
        .update({"dummy":"dummy"})
}

export async function getIngamePopupsList(): Promise<any> {

    const ingamePopups = await admin.database().ref(FieldIngamePopups).once('value');
    if (!ingamePopups.exists()) {
        // createPlaceholder();
        return "";
    }
    return ingamePopups.val();
}

export async function addIngamePopupsList(img: string): Promise<any> {

    const uniqueId = uuidv4();

    const lastPopupInfo = await getIngamePopupsList();
    console.log("addIngamePopupsList --- lastPopupInfo:" + JSON.stringify(lastPopupInfo));

    await admin.database().ref(FieldIngamePopups)
        .update({"id": uniqueId, "img": img, "isActive": true});
    
    const newPopupInfo = await getIngamePopupsList();
    console.log("addIngamePopupsList --- newPopupInfo:" + JSON.stringify(newPopupInfo));

}