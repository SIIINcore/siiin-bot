// ================================
// SIIIN CORE | SIIIN 3.0.0.1
// ================================

// ================================
// IMPORTS | CONFIG
// ================================
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
require('dotenv').config();

// ================================
// EXPRESS STARTUP (Cut flag)
// ================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check IMMÉDIAT, sans dépendre du client Discord
app.get(process.env.RAILWAY_HEALTHCHECK_PATH || '/', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        bot: 'SIIIN Bot (Initializing...)',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Health check on port ${PORT} (Express started immediately)`);
});

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
