// ================================
// SIIIN CORE | SIIIN 3.0.0.1
// ================================

// ================================
// IMPORTS | CONFIG
// ================================
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
require('dotenv').config();
const staffCommands = require('./staffCommands');

// ================================
// EXPRESS STARTUP (Healthcheck immédiat)
// ================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
// START BOT (avec retry)
// ================================
const loginWithRetry = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            await client.login(process.env.BOT_TOKEN);
            console.log('✅ Successfully logged in to Discord');
            return;
        } catch (err) {
            console.error(`❌ Discord login attempt ${i + 1}/${retries} failed:`, err.message);
            if (i < retries - 1) {
                console.log('⏳ Retrying in 10 seconds...');
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }
    console.error('❌ All login attempts failed after retries.');
    // On ne fait plus de process.exit(1) pour éviter la boucle Railway
};

loginWithRetry();

// ================================
// END OF SIIIN CORE
// ================================
