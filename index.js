// ================================
// SIIIN CORE | SIIIN 3.0.0.1
// ================================

// ================================
// IMPORTS | CONFIG
// ================================
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// ================================
// IMPORT HANDLERS
// ================================
const loadEvents = require('./handlers/eventHandler');

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
    console.log('🛑 SIGTERM signal received (Railway)...');
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

// ================================
// START BOT
// ================================
client.login(process.env.BOT_TOKEN).catch(err => {
    console.error('❌ Discord connection error:', err);
    process.exit(1);
});

// ================================
// END OF SIIIN CORE
// ================================
