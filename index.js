const TelegramBot = require('node-telegram-bot-api');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const express = require('express');

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

/*
========================================
ADMIN SETTINGS
========================================
*/

const ADMIN_ID = 934377942;

/*
========================================
GOOGLE SHEETS CONFIG
========================================
*/

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const doc = new GoogleSpreadsheet(
  process.env.GOOGLE_SHEET_ID,
  serviceAccountAuth
);

/*
========================================
LOAD SHEET
========================================
*/

async function loadSheet() {
    await doc.loadInfo();
    return doc.sheetsByIndex[0];
}

/*
========================================
AUTO EXPIRY CHECK
========================================
*/

function isExpired(expiryDate) {

    const months = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11
    };

    const parts = expiryDate.split('-');

    const day = parseInt(parts[0]);
    const month = months[parts[1]];
    const year = parseInt(parts[2]);

    const expiry = new Date(year, month, day);
    const today = new Date();

    expiry.setHours(0,0,0,0);
    today.setHours(0,0,0,0);

    return today > expiry;
}

/*
========================================
VALIDATED USERS
========================================
*/

const validatedUsers = {};

/*
========================================
START
========================================
*/

bot.onText(/^\/start$/, (msg) => {

    bot.sendMessage(msg.chat.id,
`🚀 Welcome to OIC Fusion Manager

Commands:
/plans
/support
/validate CODE
/expiry
/newinstance`);
});

/*
========================================
PLANS
========================================
*/

bot.onText(/^\/plans$/, (msg) => {

    bot.sendMessage(msg.chat.id,
`💰 Pricing Plans

🔹 OIC — ₹300/month
🔹 Fusion — ₹300/month
🔹 Combo — ₹500/month`);
});

/*
========================================
SUPPORT
========================================
*/

bot.onText(/^\/support$/, (msg) => {

    bot.sendMessage(msg.chat.id,
`📩 Contact Admin

Telegram: @KLRAHUL_5646
WhatsApp: +919302613759`);
});

/*
========================================
VALIDATE
========================================
*/

bot.onText(/^\/validate (.+)/, async (msg, match) => {

    try {

        const code = match[1];
        const chatId = msg.chat.id;

        const sheet = await loadSheet();
        const rows = await sheet.getRows();

        const user = rows.find(row => row.Code == code);

        if(!user) {

            bot.sendMessage(chatId,
`❌ CODE NOT FOUND`);

            return;
        }

        if(isExpired(user.Expiry)) {

            user.Active = 'FALSE';
            await user.save();

            bot.sendMessage(chatId,
`❌ CODE EXPIRED

Code: ${code}

Status: EXPIRED
Access: DENIED`);

            return;
        }

        if(user.Active === 'TRUE') {

            validatedUsers[chatId] = code;

            bot.sendMessage(chatId,
`✅ BILL VALIDATED

Code: ${code}

Status: ACTIVE
Access: APPROVED`);
        }
        else {

            bot.sendMessage(chatId,
`❌ INVALID OR DISABLED CODE`);
        }

    } catch(error) {

        console.log(error);

        bot.sendMessage(msg.chat.id,
`❌ Validation Error`);
    }
});

/*
========================================
EXPIRY
========================================
*/

bot.onText(/^\/expiry$/, async (msg) => {

    try {

        const chatId = msg.chat.id;

        const code = validatedUsers[chatId];

        if(!code) {

            bot.sendMessage(chatId,
`❌ Access Denied

Validate first using:
/validate CODE`);

            return;
        }

        const sheet = await loadSheet();
        const rows = await sheet.getRows();

        const user = rows.find(row => row.Code == code);

        bot.sendMessage(chatId,
`⚠️ RENEWAL NOTICE

Code                 : ${code}
Paid                  : ${user.Paid}
Expiry               : ${user.Expiry}
Renew Date      : ${user.Renew}
Renew Contact : +919302613759

Action:
Contact us before renew date to keep your instance active.`);

    } catch(error) {

        console.log(error);

        bot.sendMessage(msg.chat.id,
`❌ Expiry Error`);
    }
});

/*
========================================
NEW INSTANCE
========================================
*/

bot.onText(/^\/newinstance$/, (msg) => {

    const chatId = msg.chat.id;

    const code = validatedUsers[chatId];

    if(!code) {

        bot.sendMessage(chatId,
`❌ Access Denied

Validate first using:
/validate CODE`);

        return;
    }

    bot.sendMessage(chatId,
`🆕 INSTANCE INFORMATION

Your instance is active.

Contact Admin:
Telegram: @KLRAHUL_5646
WhatsApp: +919302613759`);
});

/*
========================================
ADD USER
========================================
*/

bot.onText(/^\/adduser (.+)/, async (msg, match) => {

    try {

        if(msg.from.id !== ADMIN_ID) {

            bot.sendMessage(msg.chat.id,
`❌ Admin only command`);

            return;
        }

        const data = match[1].split(' ');

        if(data.length < 4) {

            bot.sendMessage(msg.chat.id,
`❌ Invalid Format

Example:
/adduser 7890 09-May-2026 09-Jun-2026 04-Jun-2026`);

            return;
        }

        const code = data[0];
        const paid = data[1];
        const expiry = data[2];
        const renew = data[3];

        const sheet = await loadSheet();

        await sheet.addRow({
            Code: code,
            Paid: paid,
            Expiry: expiry,
            Renew: renew,
            Active: 'TRUE'
        });

        bot.sendMessage(msg.chat.id,
`✅ USER ADDED

Code: ${code}`);

    } catch(error) {

        console.log(error);

        bot.sendMessage(msg.chat.id,
`❌ Add User Error`);
    }
});

console.log('Bot Running...');

/*
========================================
EXPRESS SERVER
========================================
*/

const app = express();

app.get('/', (req, res) => {
    res.send('Bot Running');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
