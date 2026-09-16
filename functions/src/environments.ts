import * as admin from "firebase-admin";

export const STAGING = false;

const credential = admin.credential.applicationDefault();

const productionOptions = {
    credential,
    storageBucket: 'zpln-3be94.appspot.com',
    databaseURL: 'https://zpln-3be94.firebaseio.com/',
    webAPIKey: 'AIzaSyCWgV15Z9qdKkwgrUFyC1cW89VlhWm8_Sw'

};


const stagingOptions = {
    credential,
    storageBucket: 'zplndev.firebasestorage.app',
    databaseURL: 'https://zplndev-default-rtdb.firebaseio.com/',
    webAPIKey: 'AIzaSyAjsCx31wpis5YdnTxFOHUa8YKUR7M7XQ4'
};
//6q3eRF3futR64MrIefsyO1dT31hUMhx0ap6k8paV
// const stagingOptions = {
//     credential: admin.credential.cert(serviceAccount),
//     storageBucket: 'zpln-staging.appspot.com',
//     databaseURL: 'https://zpln-staging-default-rtdb.firebaseio.com/',
//     webAPIKey: 'AIzaSyC7o48rN8KipN8ztyZshru7dGG7UZ_3qbA'
// };
export const appOptions = STAGING ? stagingOptions : productionOptions;
