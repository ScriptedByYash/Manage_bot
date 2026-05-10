const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
`🚀 Welcome to OIC Fusion Manager

Use:
/plans - Pricing
/support - Contact Admin`);
});

bot.onText(/\/plans/, (msg) => {
    bot.sendMessage(msg.chat.id,
`💰 Pricing Plans

🔹 OIC — ₹300/month
🔹 Fusion — ₹300/month
🔹 Combo — ₹500/month`);
});

bot.onText(/\/support/, (msg) => {
    bot.sendMessage(msg.chat.id,
`📩 Contact Admin
Telegram: @yourusername`);
});

console.log("Bot Running...");
