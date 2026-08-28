const nodemailer = require('nodemailer');

const MAILER_HOST_NAME = 'smtp.gmail.com'
const MAILER_PORT_NUMBER = 587
export const MAILER_AUTH_USER_EMAIL = 'username@xyz.com'
const MAILER_AUTH_USER_PASSWORD = 'password'


var transporter = nodemailer.createTransport({
    host: MAILER_HOST_NAME,
    port: MAILER_PORT_NUMBER,
    secure: false,
    auth: {
        user: MAILER_AUTH_USER_EMAIL,
        pass: MAILER_AUTH_USER_PASSWORD
    }
});

export function sendEmail(to: string, subject: string, content: string): void{
    const mailOptions = {
        from: MAILER_AUTH_USER_EMAIL,
        to: to,
        subject: subject,
        html: `<div> ${content} </div>
         <p>`
    };

    return transporter.sendMail(mailOptions, (error: any, data: any) => {
        if (error) {
            console.log("Error: " + error)
            return
        }
        console.log("Sent!")
    });
}
