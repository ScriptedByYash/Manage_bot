const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();

const PORT = process.env.PORT || 10000;

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, {
    polling: true
});

/*
========================================
ADMIN SESSION STORAGE
========================================
*/

const adminSessions = {};

/*
========================================
TELEGRAM MENU COMMANDS - USER
========================================
*/

bot.setMyCommands([

    { command: 'start', description: 'Start Bot' },
    { command: 'validate', description: 'Validate Your Code' },
    { command: 'expiry', description: 'Check Subscription' },
    { command: 'renew', description: 'Renew Subscription' },
    { command: 'admincontact', description: 'Contact Admin' },
    { command: 'fusioninstance', description: 'Fusion Instance Detail' },
    { command: 'oicinstance', description: 'OIC Instance Detail' },
    { command: 'oicsftpdetail', description: 'OIC SFTP Detail' },
    { command: 'atpdetail', description: 'ATP Detail' },
    { command: 'ftpdetail', description: 'FTP Detail' },
    { command: 'vbcsdbdetail', description: 'VBCS DB Detail' }

]);

/*
========================================
TELEGRAM MENU COMMANDS - ADMIN ONLY
========================================
*/

bot.setMyCommands([

    { command: 'start', description: 'Start Bot' },
    { command: 'validate', description: 'Validate Your Code' },
    { command: 'expiry', description: 'Check Subscription' },
    { command: 'renew', description: 'Renew Subscription' },
    { command: 'admincontact', description: 'Contact Admin' },
    { command: 'fusioninstance', description: 'Fusion Instance Detail' },
    { command: 'oicinstance', description: 'OIC Instance Detail' },
    { command: 'oicsftpdetail', description: 'OIC SFTP Detail' },
    { command: 'atpdetail', description: 'ATP Detail' },
    { command: 'ftpdetail', description: 'FTP Detail' },
    { command: 'vbcsdbdetail', description: 'VBCS DB Detail' },
    { command: 'createuser', description: 'Create New User' },
    { command: 'updateuser', description: 'Update User' }

],
{
    scope: {
        type: 'chat',
        chat_id: parseInt(process.env.ADMIN_ID)
    }
});

/*
========================================
GOOGLE SHEET CONFIG
========================================
*/

const SHEET_ID = '1vY_lDqZSYY39EJXK2WIUwVvD21yPsftfbw8MwoKp3G4';

const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const doc = new GoogleSpreadsheet(
    SHEET_ID,
    serviceAccountAuth
);

/*
========================================
LOAD SHEETS
========================================
*/

async function loadUsersSheet() {

    await doc.loadInfo();

    return doc.sheetsByTitle['Users'];
}

async function loadCredentialsSheet() {

    await doc.loadInfo();

    return doc.sheetsByTitle['Credentials'];
}

/*
========================================
UPDATE TELEGRAM ID
========================================
*/

async function updateTelegramId(
    code,
    telegramId
) {

    const sheet = await loadUsersSheet();

    const rows = await sheet.getRows();

    for(const row of rows) {

        const rowCode = String(
            row.get('Code')
        ).trim();

        if(rowCode === code) {

            const existingTelegramId = String(
                row.get('User Telegram Id') || ''
            ).trim();

            if(existingTelegramId) {

                return {
                    success: false,
                    message: 'Telegram ID already exists'
                };
            }

            row.set(
                'User Telegram Id',
                telegramId.toString()
            );

            await row.save();

            return { success: true };
        }
    }

    return {
        success: false,
        message: 'Code not found'
    };
}

/*
========================================
UPDATE USER FIELD
========================================
*/

async function updateUserField(code, fieldName, fieldValue) {

    const sheet = await loadUsersSheet();

    const rows = await sheet.getRows();

    for(const row of rows) {

        const rowCode = String(
            row.get('Code')
        ).trim();

        if(rowCode === code) {

            row.set(fieldName, fieldValue);

            /*
            ========================================
            AUTO UPDATE RENEW DATE IF EXPIRY CHANGES
            ========================================
            */

            if(fieldName === 'Expiry') {

                const renewDate = calculateRenewDate(fieldValue);

                row.set('Renew', renewDate);
            }

            await row.save();

            return { success: true };
        }
    }

    return {
        success: false,
        message: 'Code not found'
    };
}

/*
========================================
CALCULATE RENEW DATE (EXPIRY - 5 DAYS)
========================================
*/

function calculateRenewDate(expiryStr) {

    const months = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3,
        May: 4, Jun: 5, Jul: 6, Aug: 7,
        Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

    const parts = expiryStr.split('-');

    const expiryDate = new Date(
        parseInt(parts[2]),
        months[parts[1]],
        parseInt(parts[0])
    );

    expiryDate.setDate(expiryDate.getDate() - 5);

    return expiryDate
        .toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
        .replace(/ /g, '-');
}

/*
========================================
GENERATE NEXT CODE
========================================
*/

async function generateNextCode() {

    const sheet = await loadUsersSheet();

    const rows = await sheet.getRows();

    let maxCode = 15550;

    for(const row of rows) {

        const code = parseInt(row.get('Code'));

        if(!isNaN(code) && code > maxCode) {

            maxCode = code;
        }
    }

    return (maxCode + 1).toString();
}

/*
========================================
CHECK EXPIRY
========================================
*/

function isExpired(expiryDate) {

    const months = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3,
        May: 4, Jun: 5, Jul: 6, Aug: 7,
        Sep: 8, Oct: 9, Nov: 10, Dec: 11
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
GET USER BY CODE
========================================
*/

async function getUserByCode(code) {

    const sheet = await loadUsersSheet();

    const rows = await sheet.getRows();

    const users = rows.map(row => ({
        Code: String(row.get('Code')).trim(),
        Paid: row.get('Paid'),
        Expiry: row.get('Expiry'),
        Renew: row.get('Renew'),
        Active: String(row.get('Active')).trim(),
        LastPayment: row.get('Last payment'),
        UserName: row.get('User Name'),
        UserCountryCode: row.get('User Country Code'),
        UserMobile: row.get('User Mobile'),
        UserTelegramId: String(row.get('User Telegram Id') || '').trim(),
        Instances: String(row.get('Instances')).trim().replace(/\s/g, '').toUpperCase()
    }));

    return users.find(u => u.Code === code);
}

/*
========================================
GET USER BY TELEGRAM ID
========================================
*/

async function getUserByTelegramId(chatId) {

    const sheet = await loadUsersSheet();

    const rows = await sheet.getRows();

    const users = rows.map(row => ({
        Code: String(row.get('Code')).trim(),
        Paid: row.get('Paid'),
        Expiry: row.get('Expiry'),
        Renew: row.get('Renew'),
        Active: String(row.get('Active')).trim(),
        LastPayment: row.get('Last payment'),
        UserName: row.get('User Name'),
        UserCountryCode: row.get('User Country Code'),
        UserMobile: row.get('User Mobile'),
        UserTelegramId: String(row.get('User Telegram Id') || '').trim(),
        Instances: String(row.get('Instances')).trim().replace(/\s/g, '').toUpperCase()
    }));

    return users.find(u => u.UserTelegramId === chatId.toString());
}

/*
========================================
GET CREDENTIALS
========================================
*/

async function getCredentials() {

    const sheet = await loadCredentialsSheet();

    const rows = await sheet.getRows();

    if(rows.length === 0) return null;

    return {
        fusion: rows[0].get('Fusion Detail'),
        oic: rows[0].get('OIC Detail'),
        sftp: rows[0].get('SFTP Detail'),
        atp: rows[0].get('ATP Detail'),
        ftp: rows[0].get('FTP Detail'),
        vbcs: rows[0].get('VBCS DB Detail')
    };
}

/*
========================================
ACCESS CHECK
========================================
*/

function hasFusionAccess(type) {
    return type === 'FUSION' || type === 'BOTH';
}

function hasOICAccess(type) {
    return type === 'OIC' || type === 'BOTH';
}

/*
========================================
ADMIN CHECK
========================================
*/

function isAdmin(userId) {
    return userId.toString() === process.env.ADMIN_ID;
}

/*
========================================
VALID USER CHECK
========================================
*/

async function validateUserAccess(chatId) {

    const user = await getUserByTelegramId(chatId);

    if(!user) {
        return {
            success: false,
            message:
`❌ VALIDATE FIRST

/validate CODE

Need Help?
/admincontact`
        };
    }

    if(
        user.Active.toUpperCase() !== 'TRUE' ||
        isExpired(user.Expiry)
    ) {
        return {
            success: false,
            message:
`⚠️ INSTANCE EXPIRED

━━━━━━━━━━━━━━

Code
${user.Code}

Expiry Date
${user.Expiry}

━━━━━━━━━━━━━━

Need Help?
/admincontact`
        };
    }

    return { success: true, user };
}

/*
========================================
SAVE CREATE USER TO SHEET
========================================
*/

async function saveNewUser(chatId, data) {

    const code = await generateNextCode();

    const today = new Date();

    const paidDate = today
        .toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
        .replace(/ /g, '-');

    const renewDate = calculateRenewDate(data.expiry);

    const sheet = await loadUsersSheet();

    await sheet.addRow({
        Code: code,
        Paid: paidDate,
        Expiry: data.expiry,
        Renew: renewDate,
        Active: 'TRUE',
        Instances: data.plan,
        'Last payment': data.payment,
        'User Name': data.userName,
        'User Country Code': data.countryCode || '',
        'User Mobile': data.mobile || '',
        'User Telegram Id': ''
    });

    bot.sendMessage(
        chatId,

`✅ USER CREATED

━━━━━━━━━━━━━━

👤 User
${data.userName}

🔑 Code
${code}

📦 Plan
${data.plan}

💰 Payment
${data.payment}

🌍 Country Code
${data.countryCode ? '+' + data.countryCode : 'N/A'}

📞 Mobile
${data.mobile || 'N/A'}

📅 Expiry
${data.expiry}

📅 Renew
${renewDate}

━━━━━━━━━━━━━━`
    );

    delete adminSessions[chatId];
}

/*
========================================
SHOW UPDATE FIELD BUTTONS
========================================
*/

function showUpdateFieldButtons(chatId, user) {

    bot.sendMessage(
        chatId,

`✏️ UPDATE USER

━━━━━━━━━━━━━━

👤 User
${user.UserName || 'N/A'}

🔑 Code
${user.Code}

📦 Plan
${user.Instances}

📅 Expiry
${user.Expiry}

🔄 Renew
${user.Renew}

💰 Last Payment
${user.LastPayment || 'N/A'}

🌍 Country Code
${user.UserCountryCode || 'N/A'}

📞 Mobile
${user.UserMobile || 'N/A'}

🔘 Active
${user.Active}

📱 Telegram ID
${user.UserTelegramId || 'N/A'}

━━━━━━━━━━━━━━

Select Field to Update:`,

        {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '👤 Name', callback_data: 'upd_field_name' },
                        { text: '📦 Plan', callback_data: 'upd_field_plan' }
                    ],
                    [
                        { text: '📅 Expiry', callback_data: 'upd_field_expiry' },
                        { text: '💰 Payment', callback_data: 'upd_field_payment' }
                    ],
                    [
                        { text: '🌍 Country Code', callback_data: 'upd_field_country' },
                        { text: '📞 Mobile', callback_data: 'upd_field_mobile' }
                    ],
                    [
                        { text: '🔘 Active', callback_data: 'upd_field_active' },
                        { text: '📱 Telegram ID', callback_data: 'upd_field_telegram' }
                    ],
                    [
                        { text: '❌ Cancel', callback_data: 'upd_cancel' }
                    ]
                ]
            }
        }
    );
}

/*
========================================
CREATE USER COMMAND
========================================
*/

bot.onText(/^\/createuser$/, async (msg) => {

    try {

        if(!isAdmin(msg.from.id)) {
            bot.sendMessage(msg.chat.id, 'Unauthorized');
            return;
        }

        adminSessions[msg.chat.id] = {
            action: 'create_user',
            step: 'name',
            data: {}
        };

        bot.sendMessage(
            msg.chat.id,

`👤 CREATE USER

━━━━━━━━━━━━━━

Enter User Name:`
        );

    } catch(error) {
        console.log(error);
    }
});

/*
========================================
UPDATE USER COMMAND
========================================
*/

bot.onText(/^\/updateuser$/, async (msg) => {

    try {

        if(!isAdmin(msg.from.id)) {
            bot.sendMessage(msg.chat.id, 'Unauthorized');
            return;
        }

        adminSessions[msg.chat.id] = {
            action: 'update_user',
            step: 'code',
            data: {}
        };

        bot.sendMessage(
            msg.chat.id,

`✏️ UPDATE USER

━━━━━━━━━━━━━━

Enter User Code:`
        );

    } catch(error) {
        console.log(error);
    }
});

/*
========================================
START
========================================
*/

bot.onText(/^\/start$/, async (msg) => {

    const chatId = msg.chat.id.toString();

    const user = await getUserByTelegramId(chatId);

    if(!user) {

        bot.sendMessage(msg.chat.id,
`╔═════════════════════╗
🚀 Oracle Instance Provider 🚀
╚═════════════════════╝

Welcome to 🚀 Oracle Instance Provider 🚀

Please validate your code first.

Example:
/validate 1111

👨‍💼 Support
/admincontact

────────────────────────

⚡ Fast Access | 🔒 Secure Details | 📞 24×7 Support`);

        return;
    }

    bot.sendMessage(msg.chat.id,
`╔═════════════════════╗
🚀 Oracle Instance Provider 🚀
╚═════════════════════╝

Welcome to 🚀 Oracle Instance Provider 🚀

Hello ${user.UserName || 'User'}!
I provide high-speed access to Oracle Fusion and OIC instances, including SFTP & ATP details.

📋 COMMANDS
────────────────────────

📅 /expiry
  (Check Expiry Date)

🔄 /renew
  (Renew Subscription)

👨‍💼 /admincontact
  (Contact Admin)

🚀 /fusioninstance
  (Fusion Instance Details)

☁️ /oicinstance
  (OIC Instance Details)

📂 /oicsftpdetail
  (OIC SFTP Details)

🗄 /atpdetail
  (ATP Database Details)

📁 /ftpdetail
  (FTP Details)

🗃 /vbcsdbdetail
  (VBCS Database Details)

────────────────────────

⚡ Fast Access | 🔒 Secure Details | 📞 24×7 Support`);
});

/*
========================================
ADMIN SESSION FLOW (CREATE + UPDATE)
========================================
*/

bot.on('message', async (msg) => {

    try {

        if(!msg.text) return;

        if(!isAdmin(msg.from.id)) return;

        const session = adminSessions[msg.chat.id];

        if(!session) return;

        /*
        ========================================
        CREATE USER FLOW
        ========================================
        */

        if(session.action === 'create_user') {

            /*
            ----------------------------------------
            NAME
            ----------------------------------------
            */

            if(session.step === 'name') {

                session.data.userName = msg.text;

                session.step = 'plan';

                bot.sendMessage(
                    msg.chat.id,

`📦 SELECT PLAN

━━━━━━━━━━━━━━

Send Any One:

OIC
FUSION
BOTH`
                );

                return;
            }

            /*
            ----------------------------------------
            PLAN
            ----------------------------------------
            */

            if(session.step === 'plan') {

                const plan = msg.text.trim().toUpperCase();

                if(
                    plan !== 'OIC' &&
                    plan !== 'FUSION' &&
                    plan !== 'BOTH'
                ) {
                    bot.sendMessage(msg.chat.id, 'Invalid Plan. Send OIC, FUSION or BOTH');
                    return;
                }

                session.data.plan = plan;

                session.step = 'expiry';

                bot.sendMessage(
                    msg.chat.id,

`📅 ENTER EXPIRY DATE

━━━━━━━━━━━━━━

Example:
15-Jun-2026`
                );

                return;
            }

            /*
            ----------------------------------------
            EXPIRY
            ----------------------------------------
            */

            if(session.step === 'expiry') {

                session.data.expiry = msg.text;

                session.step = 'payment';

                bot.sendMessage(
                    msg.chat.id,

`💰 ENTER LAST PAYMENT

━━━━━━━━━━━━━━

Example:
500`
                );

                return;
            }

            /*
            ----------------------------------------
            PAYMENT
            ----------------------------------------
            */

            if(session.step === 'payment') {

                session.data.payment = msg.text;

                session.step = 'country_code';

                bot.sendMessage(
                    msg.chat.id,

`🌍 ENTER COUNTRY CODE

━━━━━━━━━━━━━━

Example:
91`,

                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: '⏭ Skip',
                                        callback_data: 'skip_country'
                                    }
                                ]
                            ]
                        }
                    }
                );

                return;
            }

            /*
            ----------------------------------------
            COUNTRY CODE (TEXT INPUT)
            ----------------------------------------
            */

            if(session.step === 'country_code') {

                session.data.countryCode = msg.text;

                session.step = 'mobile';

                bot.sendMessage(
                    msg.chat.id,

`📞 ENTER MOBILE NUMBER

━━━━━━━━━━━━━━

Example:
9876543210`,

                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: '⏭ Skip',
                                    callback_data: 'skip_mobile'
                                }
                            ]
                        ]
                    }
                }
            );

            return;
        }

        /*
        ========================================
        SKIP MOBILE (CREATE USER)
        ========================================
        */

        if(data === 'skip_mobile') {

            const session = adminSessions[chatId];

            if(!session || session.action !== 'create_user') return;

            session.data.mobile = '';

            bot.answerCallbackQuery(query.id, { text: 'Mobile Skipped' });

            await saveNewUser(chatId, session.data);

            return;
        }

        /*
        ========================================
        UPDATE USER - CANCEL
        ========================================
        */

        if(data === 'upd_cancel') {

            delete adminSessions[chatId];

            await bot.editMessageReplyMarkup(
                { inline_keyboard: [] },
                {
                    chat_id: chatId,
                    message_id: query.message.message_id
                }
            );

            bot.answerCallbackQuery(query.id, { text: 'Cancelled' });

            bot.sendMessage(chatId, '❌ Update Cancelled');

            return;
        }

        /*
        ========================================
        UPDATE USER - FIELD SELECTION
        ========================================
        */

        if(data.startsWith('upd_field_')) {

            const session = adminSessions[chatId];

            if(!session || session.action !== 'update_user') return;

            await bot.editMessageReplyMarkup(
                { inline_keyboard: [] },
                {
                    chat_id: chatId,
                    message_id: query.message.message_id
                }
            );

            const fieldMap = {
                'upd_field_name':     { label: '👤 Name',        sheet: 'User Name',          type: 'text' },
                'upd_field_plan':     { label: '📦 Plan',        sheet: 'Instances',           type: 'plan' },
                'upd_field_expiry':   { label: '📅 Expiry',      sheet: 'Expiry',              type: 'text' },
                'upd_field_payment':  { label: '💰 Payment',     sheet: 'Last payment',        type: 'text' },
                'upd_field_country':  { label: '🌍 Country Code', sheet: 'User Country Code',  type: 'text' },
                'upd_field_mobile':   { label: '📞 Mobile',      sheet: 'User Mobile',         type: 'text' },
                'upd_field_active':   { label: '🔘 Active',      sheet: 'Active',              type: 'active' },
                'upd_field_telegram': { label: '📱 Telegram ID', sheet: 'User Telegram Id',   type: 'text' }
            };

            const selected = fieldMap[data];

            if(!selected) return;

            session.data.field = selected.sheet;
            session.data.fieldLabel = selected.label;

            bot.answerCallbackQuery(query.id, { text: selected.label + ' Selected' });

            /*
            ----------------------------------------
            PLAN - SHOW BUTTONS
            ----------------------------------------
            */

            if(selected.type === 'plan') {

                bot.sendMessage(
                    chatId,

`📦 SELECT NEW PLAN

━━━━━━━━━━━━━━

Code: ${session.data.code}`,

                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'OIC', callback_data: 'upd_val_OIC' },
                                    { text: 'FUSION', callback_data: 'upd_val_FUSION' },
                                    { text: 'BOTH', callback_data: 'upd_val_BOTH' }
                                ],
                                [
                                    { text: '❌ Cancel', callback_data: 'upd_cancel' }
                                ]
                            ]
                        }
                    }
                );

                return;
            }

            /*
            ----------------------------------------
            ACTIVE - SHOW BUTTONS
            ----------------------------------------
            */

            if(selected.type === 'active') {

                bot.sendMessage(
                    chatId,

`🔘 SELECT ACTIVE STATUS

━━━━━━━━━━━━━━

Code: ${session.data.code}`,

                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '✅ TRUE', callback_data: 'upd_val_TRUE' },
                                    { text: '❌ FALSE', callback_data: 'upd_val_FALSE' }
                                ],
                                [
                                    { text: '❌ Cancel', callback_data: 'upd_cancel' }
                                ]
                            ]
                        }
                    }
                );

                return;
            }

            /*
            ----------------------------------------
            TEXT - ASK TO TYPE
            ----------------------------------------
            */

            session.step = 'enter_value';

            bot.sendMessage(
                chatId,

`✏️ ENTER NEW VALUE

━━━━━━━━━━━━━━

Field: ${selected.label}
Code: ${session.data.code}

Type new value:`
            );

            return;
        }

        /*
        ========================================
        UPDATE USER - VALUE BUTTONS (PLAN/ACTIVE)
        ========================================
        */

        if(data.startsWith('upd_val_')) {

            const session = adminSessions[chatId];

            if(!session || session.action !== 'update_user') return;

            const newValue = data.replace('upd_val_', '');

            const result = await updateUserField(
                session.data.code,
                session.data.field,
                newValue
            );

            await bot.editMessageReplyMarkup(
                { inline_keyboard: [] },
                {
                    chat_id: chatId,
                    message_id: query.message.message_id
                }
            );

            if(!result.success) {

                bot.answerCallbackQuery(query.id, { text: 'Update Failed' });

                bot.sendMessage(chatId, `❌ Update Failed: ${result.message}`);

                delete adminSessions[chatId];

                return;
            }

            bot.answerCallbackQuery(query.id, { text: 'Updated!' });

            bot.sendMessage(
                chatId,

`✅ UPDATED SUCCESSFULLY

━━━━━━━━━━━━━━

🔑 Code
${session.data.code}

📝 Field
${session.data.fieldLabel}

✏️ New Value
${newValue}

━━━━━━━━━━━━━━`
            );

            delete adminSessions[chatId];

            return;
        }

    } catch(error) {
        console.log(error);
    }
});

/*
========================================
ADMIN CONTACT
========================================
*/

bot.onText(/^\/admincontact$/, async (msg) => {

    bot.sendMessage(msg.chat.id,
`👨‍💻 ADMIN CONTACT

━━━━━━━━━━━━━━

Telegram
@KLRAHUL_5646

━━━━━━━━━━━━━━

For:
• Renewal
• Login Issues
• Expiry Issues
• Access Problems
• Technical Support

━━━━━━━━━━━━━━`);
});

/*
========================================
EXPIRY
========================================
*/

bot.onText(/^\/expiry$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {
            bot.sendMessage(msg.chat.id, result.message);
            return;
        }

        const user = result.user;

        bot.sendMessage(msg.chat.id,
`📅 SUBSCRIPTION DETAILS

━━━━━━━━━━━━━━

👤 User
${user.UserName || 'N/A'}

🔑 Code
${user.Code}

📦 Plan
${user.Instances}

💰 Last Payment
${user.LastPayment || 'N/A'}

📅 Expiry
${user.Expiry}

🔄 Renew Before
${user.Renew}

🟢 Status
ACTIVE

Need Help?
/admincontact

━━━━━━━━━━━━━━`);

    } catch(error) {
        console.log(error);
    }
});

/*
========================================
RENEW
========================================
*/

bot.onText(/^\/renew$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {
            bot.sendMessage(msg.chat.id, result.message);
            return;
        }

        const user = result.user;

        bot.sendMessage(msg.chat.id,
`💳 RENEW SUBSCRIPTION

━━━━━━━━━━━━━━

👤 User
${user.UserName || 'N/A'}

🔑 Code
${user.Code}

📦 Plan
${user.Instances}

📅 Expiry
${user.Expiry}

━━━━━━━━━━━━━━

CONTACT ADMIN

Telegram
@KLRAHUL_5646

━━━━━━━━━━━━━━`);

    } catch(error) {
        console.log(error);
    }
});

/*
========================================
FUSION INSTANCE
========================================
*/

bot.onText(/^\/fusioninstance$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {
            bot.sendMessage(msg.chat.id, result.message);
            return;
        }

        const user = result.user;

        if(!hasFusionAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ FUSION ACCESS NOT AVAILABLE

Need Help?
/admincontact`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`🚀 FUSION INSTANCE DETAIL

━━━━━━━━━━━━━━

${creds.fusion}

━━━━━━━━━━━━━━

Need Help?
/admincontact`);

    } catch(error) {
        console.log(error);
    }
});

/*
========================================
OIC INSTANCE
========================================
*/

bot.onText(/^\/oicinstance$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {
            bot.sendMessage(msg.chat.id, result.message);
            return;
        }

        const user = result.user;

        if(!hasOICAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ OIC ACCESS NOT AVAILABLE

Need Help?
/admincontact`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`☁️ OIC INSTANCE DETAIL

━━━━━━━━━━━━━━

${creds.oic}

━━━━━━━━━━━━━━

Need Help?
/admincontact`);

    } catch(error) {
        console.log(error);
    }
});

/*
========================================
SFTP DETAIL
========================================
*/

bot.onText(/^\/oicsftpdetail$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {
            bot.sendMessage(msg.chat.id, result.message);
            return;
        }

        const user = result.user;

        if(!hasOICAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ OIC ACCESS NOT AVAILABLE

Need Help?
/admincontact`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`📂 SFTP DETAIL

━━━━━━━━━━━━━━

${creds.sftp}

━━━━━━━━━━━━━━

Need Help?
/admincontact`);

    } catch(error) {
        console.log(error);
    }
});

/*
========================================
ATP DETAIL
========================================
*/

bot.onText(/^\/atpdetail$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {
            bot.sendMessage(msg.chat.id, result.message);
            return;
        }

        const user = result.user;

        if(!hasOICAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ OIC ACCESS NOT AVAILABLE

Need Help?
/admincontact`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`🗄 ATP DETAIL

━━━━━━━━━━━━━━

${creds.atp}

━━━━━━━━━━━━━━

Need Help?
/admincontact`);

    } catch(error) {
        console.log(error);
    }
});

/*
========================================
FTP DETAIL
========================================
*/

bot.onText(/^\/ftpdetail$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {
            bot.sendMessage(msg.chat.id, result.message);
            return;
        }

        const user = result.user;

        if(!hasOICAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ OIC ACCESS NOT AVAILABLE

Need Help?
/admincontact`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`📁 FTP DETAIL

━━━━━━━━━━━━━━

${creds.ftp}

━━━━━━━━━━━━━━

Need Help?
/admincontact`);

    } catch(error) {
        console.log(error);
    }
});

/*
========================================
VBCS DB DETAIL
========================================
*/

bot.onText(/^\/vbcsdbdetail$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {
            bot.sendMessage(msg.chat.id, result.message);
            return;
        }

        const user = result.user;

        if(!hasOICAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ OIC ACCESS NOT AVAILABLE

Need Help?
/admincontact`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`🗃 VBCS DB DETAIL

━━━━━━━━━━━━━━

${creds.vbcs}

━━━━━━━━━━━━━━

Need Help?
/admincontact`);

    } catch(error) {
        console.log(error);
    }
});

/*
========================================
ROOT & HEALTH
========================================
*/

app.get('/', (req, res) => {
    res.send('Bot Running...');
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

/*
========================================
START SERVER
========================================
*/

app.listen(PORT, () => {
    console.log('Bot Running...');
    console.log(`Server running on port ${PORT}`);
});

console.log('Bot Running...');