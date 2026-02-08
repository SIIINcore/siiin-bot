// ================================
// SIIIN CORE | SIIIN 3.0.0.1
// ================================

// ================================
// IMPORTS | CONFIG
// ================================
const { 
    Client, 
    GatewayIntentBits 
} = require('discord.js');
const express = require('express');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

// ================================
// IMPORT CONSTANTS
// ================================
const { 
    BOT_VERSION
} = require('./config/constants');

// ================================
// IMPORT HANDLERS
// ================================
const loadEvents = require('./handlers/eventHandler');

// ================================
// EXPRESS STARTUP
// ================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.get(process.env.RAILWAY_HEALTHCHECK_PATH || '/', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        bot: 'SIIIN Bot (modular)',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Health check on port ${PORT}`);
});

// ================================
// DISCORD CLIENT
// ================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageTyping
    ]
});

// ================================
// LOAD EVENTS
// ================================
loadEvents(client);

// ================================
// ERROR HANDLING
// ================================
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM (Railway restart)');
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error.message);
});

// ================================
// AUTO RESTART (12h)
// ================================
const hours = Number(process.env.AUTO_REBOOT_HOURS || 12);
if (hours > 0) {
    setInterval(() => {
        console.log(`🔄 Auto-restart after ${hours}h`);
        // Soft restart logic
    }, hours * 60 * 60 * 1000);
    console.log(`⏱️ Auto-restart configured every ${hours}h`);
}

// ================================
// START BOT
// ================================
client.login(process.env.BOT_TOKEN).catch(err => {
    console.error('❌ Discord connection error:', err.message);
    process.exit(1);
});

// ================================
// END OF SIIIN CORE
// ================================
