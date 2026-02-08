// ================================
// SIIIN CORE | SIIIN 3.0.0.1
// ================================

// ================================
// IMPORTS | CONFIG
// ================================
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

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
    console.log('🛑 SIGTERM signal received (Railway)...');
    try {
        const { LOG_CHANNEL_ID } = require('./config/constants');
        const { EmbedBuilder } = require('discord.js');
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle("⚠️ Railway Maintenance")
                .setColor(0xFF9900)
                .setDescription("The bot is restarting due to Railway maintenance.")
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {}
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
