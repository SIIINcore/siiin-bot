const { updateAll, softRestart } = require('../functions/contentUpdater');
const { sendTicketEmbed } = require('../functions/tickets');
const { EmbedBuilder } = require('discord.js');
const { 
    LOG_CHANNEL_ID, 
    CHAT_CHANNEL_ID, 
    DONATION_CHANNEL_ID,
    BOT_VERSION,
    STATS_CHANNEL_ID
} = require('../config/constants');

let lastVersionLogged = null;

async function updateStatsEmbed(guild, client, postedGames, postedPromos, postedFreeToPlay) {
    try {
        const channel = await guild.channels.fetch(STATS_CHANNEL_ID);
        if (!channel) return;

        await guild.members.fetch();
        const totalMembers = guild.memberCount;
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        const maxBlocks = 20;
        const progress = Math.min(totalMembers / 1000, 1);
        const filledBlocks = Math.round(progress * maxBlocks);
        const emptyBlocks = maxBlocks - filledBlocks;
        const bar = '🟥'.repeat(filledBlocks) + '⬛'.repeat(emptyBlocks);

        const embed = new EmbedBuilder()
            .setTitle('📊 **S E R V E R   S T A T S**')
            .setColor('#FF0000')
            .setDescription(`${bar}\n\n👥 **Total members:** ${totalMembers}\n🧑 **Peoples:** ${humanCount}\n🤖 **Apps:** ${botCount}`)
            .addFields(
                { name: '🎮 Free games', value: `${postedGames.size} posted`, inline: true },
                { name: '🏪 Promotions', value: `${postedPromos.size} posted`, inline: true },
                { name: '🆓 Free-to-play', value: `${postedFreeToPlay.size} posted`, inline: true }
            )
            .setFooter({ text: 'SIIIN Stats • Automatic update' })
            .setTimestamp();

        const messages = await channel.messages.fetch({ limit: 5 });
        const botMessages = messages.filter(m => m.author.id === client.user.id);
        
        if (botMessages.size > 0) {
            await botMessages.first().edit({ embeds: [embed] });
        } else {
            await channel.send({ embeds: [embed] });
        }
        
    } catch (err) {
        console.error('[Stats] Error:', err.message);
    }
}

async function sendDonationMessage(client) {
    try {
        const channel = await client.channels.fetch(DONATION_CHANNEL_ID);
        if (!channel) {
            console.warn("❌ Donation channel not found!");
            return;
        }

        const messages = await channel.messages.fetch({ limit: 20 });
        for (const [, msg] of messages.filter(m => m.author.id === client.user.id)) {
            await msg.delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setTitle("💝 Support the Developers")
            .setDescription(
`Thank you for considering to support our work!

Your donations help us maintain and improve the server, as well as cover hosting costs.

**For the price of a coffee:**`
            )
            .setColor(0xFFD700)
            .addFields(
                { name: 'PayPal', value: '[Donate here](https://www.paypal.com/paypalme/LunaSiiin)', inline: true }
            )
            .setFooter({ text: 'SIIIN Development Team • Thank you for your support!' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log("✅ Donation message sent!");
        
    } catch (err) {
        console.error('[DonationMessage] Error:', err.message);
    }
}

async function updateChatReminder(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 10 });
        const botMessages = messages.filter(m => m.author.id === channel.client.user.id);
        
        if (botMessages.size > 0) {
            await botMessages.first().delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setTitle("# Welcome to SIIIN P&+ Discord")
            .setDescription(
`▪ You are in the dedicated chat channel, help is welcome here, but this is not the support channel.

# Rules reminder:
▪ No insults
▪ No links [Except YouTube]
▪ No spam
▪ This discord is not made for support.
▪ For any support request: create a ticket in <#1468090646442279206>

Please respect the rules for the happiness of Discord users.`
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'SIIIN Community • Be respectful' });

        await channel.send({ embeds: [embed] });
        
    } catch (err) {
        console.error('[ChatReminder] Error:', err.message);
    }
}

// Fonction pour initialiser Express depuis ready.js
function setupExpress(client) {
    const express = require('express');
    const app = express();
    const PORT = process.env.PORT || 3000;

    app.use(express.json());
    
    app.get(process.env.RAILWAY_HEALTHCHECK_PATH || '/', (req, res) => {
        res.status(200).json({ 
            status: 'ok', 
            bot: client?.user?.tag || 'SIIIN Bot (Starting...)',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    });

    app.listen(PORT, () => {
        console.log(`🚀 Health check on port ${PORT}`);
    });

    return app;
}

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`🤖 ${client.user.tag} connected! (v${BOT_VERSION})`);
        console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);

        try {
            
            // Send initial messages
            await sendTicketEmbed(client);
            await sendDonationMessage(client);
            
            // Initialize chat reminder
            const chatChannel = await client.channels.fetch(CHAT_CHANNEL_ID).catch(() => null);
            if (chatChannel) {
                await updateChatReminder(chatChannel);
            }

            // Log version to log channel
            const CURRENT_CHANGELOG = `# VERSION ${BOT_VERSION} - MODULAR UPDATE`;
            
            if (lastVersionLogged !== BOT_VERSION) {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle("🚀 Bot Online / Restarted")
                        .setColor("#00FF00")
                        .setDescription(`**Release:** ${BOT_VERSION}\n\n**Changelog:**\n${CURRENT_CHANGELOG}`)
                        .addFields(
                            { name: '👥 Servers', value: `${client.guilds.cache.size}`, inline: true },
                            { name: '📅 Date', value: new Date().toLocaleDateString('en-US'), inline: true },
                            { name: '⏰ Time', value: new Date().toLocaleTimeString('en-US'), inline: true },
                            { name: '🛡️ Security', value: 'Automod Active', inline: false },
                            { name: '🎮 APIs', value: 'Steam + Epic + CheapShark', inline: false }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
                lastVersionLogged = BOT_VERSION;
            }

            // Initial update
            const { postedGames, postedPromos, postedFreeToPlay } = require('../functions/contentUpdater');
            await updateAll(client);
            
            // Initial stats
            const guilds = client.guilds.cache;
            for (const guild of guilds.values()) {
                await updateStatsEmbed(guild, client, postedGames, postedPromos, postedFreeToPlay);
            }
            
            // Heartbeat every minute
            setInterval(() => {
                console.log('🟢 Bot alive:', new Date().toLocaleTimeString('en-US'));
            }, 60000);
            
            // Auto update every 30 minutes
            setInterval(() => updateAll(client), 30 * 60 * 1000);
            
            // Auto-restart every 12 hours
            const hours = Number(process.env.AUTO_REBOOT_HOURS || 12);
            if (hours > 0) {
                setInterval(() => softRestart(client), hours * 60 * 60 * 1000);
                console.log(`⏱️ Autorestart every ${hours}h`);
            }
            
        } catch (err) {
            console.error("❌ Startup error:", err.message);
        }
    }
};
