const { updateAll, softRestart, postedGames, postedPromos, postedFreeToPlay, postedMobile } = require('../functions/contentUpdater');
const { sendTicketEmbed } = require('../functions/tickets');
const { EmbedBuilder } = require('discord.js');
const { ensureTranslationHelperForMessage } = require('../functions/translation');
const {
    LOG_CHANNEL_ID,
    CHAT_CHANNEL_ID,
    DONATION_CHANNEL_ID,
    BOT_VERSION,
    STATS_CHANNEL_ID,
    SEARCH_CHANNEL_ID
} = require('../config/constants');
const staffCommands = require('../staffCommands');

let lastVersionLogged = null;

function buildMonoBar(percent = 0.8, total = 20) {
    const filled = Math.max(0, Math.min(total, Math.round(total * percent)));
    const empty = Math.max(0, total - filled);
    return `${'▬'.repeat(filled)}${'▭'.repeat(empty)}`;
}

function buildClassProgress(count) {
    if (count <= 0) return '▭';
    return '▬'.repeat(Math.min(10, Math.ceil(count / 10)));
}

async function updateStatsEmbed(guild, client, freeGamesSet, promosSet, freeToPlaySet, mobileSet) {
    try {
        const channel = await guild.channels.fetch(STATS_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        await guild.members.fetch();
        const totalMembers = guild.memberCount;
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        const embed = new EmbedBuilder()
            .setTitle('📊 **S E R V E R      S T A T S**')
            .setColor('#66C2FF')
            .setDescription(
                `${buildMonoBar(0.8)}\n\n` +
                `👥 **Total members:** ${totalMembers}\n` +
                `🧑 **People:** ${humanCount}\n` +
                `🤖 **Apps:** ${botCount}`
            )
            .addFields({
                name: 'Content tracking',
                value:
                    `🎮 **Free games** — ${freeGamesSet.size} posted\n${buildClassProgress(freeGamesSet.size)}\n` +
                    `🏪 **Promotions** — ${promosSet.size} posted\n${buildClassProgress(promosSet.size)}\n` +
                    `🆓 **Free-to-play** — ${freeToPlaySet.size} posted\n${buildClassProgress(freeToPlaySet.size)}\n` +
                    `📱 **Mobile** — ${mobileSet.size} posted\n${buildClassProgress(mobileSet.size)}`,
                inline: false
            })
            .setFooter({ text: 'SIIIN Stats • Automatic update' })
            .setTimestamp();

        const messages = await channel.messages.fetch({ limit: 5 });
        const botMessages = messages.filter(m => m.author.id === client.user.id);

        if (botMessages.size > 0) {
            await botMessages.first().edit({ embeds: [embed] });
        } else {
            const sentMessage = await channel.send({ embeds: [embed] });
        await ensureTranslationHelperForMessage(sentMessage, client);
        }
    } catch (err) {
        console.error('[Stats] Error:', err.message);
    }
}

async function sendDonationMessage(client) {
    try {
        const channel = await client.channels.fetch(DONATION_CHANNEL_ID).catch(() => null);
        if (!channel) {
            console.warn('❌ Donation channel not found!');
            return;
        }

        const messages = await channel.messages.fetch({ limit: 20 });
        for (const [, msg] of messages.filter(m => m.author.id === client.user.id)) {
            await msg.delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setTitle('💝 Support the Developers')
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

        const sentMessage = await channel.send({ embeds: [embed] });
        await ensureTranslationHelperForMessage(sentMessage, client);
    } catch (err) {
        console.error('[DonationMessage] Error:', err.message);
    }
}

async function sendSearchLinksMessage(client) {
    try {
        const channel = await client.channels.fetch(SEARCH_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 20 });
        for (const [, msg] of messages.filter(m => m.author.id === client.user.id)) {
            await msg.delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setTitle('🔎 Search | Common links')
            .setColor(0x66C2FF)
            .setDescription(
                `[Informations](https://discord.com/channels/1033462383798140978/1177257234787471422) ▪ <#1468126872297672928> ▪ <#1469855556356542649> ▪ <#1469855518695624725> ▪ <#1487769618733858956> ▪ [Support Rules](https://discord.com/channels/1033462383798140978/1379581746466783385/1379584565466763307) ▪ <#1189391329097166989> ▪ <#1468090646442279206> ▪ <#1376863261625946173>`
            )
            .setFooter({ text: 'SIIIN Search • Refreshed on every bot reboot' })
            .setTimestamp();

        const sentMessage = await channel.send({ embeds: [embed] });
        await ensureTranslationHelperForMessage(sentMessage, client);
    } catch (err) {
        console.error('[SearchLinks] Error:', err.message);
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
            .setTitle('# Welcome to SIIIN P&+ Discord')
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

        const sentMessage = await channel.send({ embeds: [embed] });
        await ensureTranslationHelperForMessage(sentMessage, client);
    } catch (err) {
        console.error('[ChatReminder] Error:', err.message);
    }
}

async function updateInformationMessage(client) {
    try {
        const INFO_CHANNEL_ID = '1033506664810287134';
        const EXISTING_MESSAGE_ID = '1469900307688325242';

        const infoChannel = await client.channels.fetch(INFO_CHANNEL_ID).catch(() => null);
        if (!infoChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('📋 SIIIN PATCHES & EXTRA - INFORMATION')
            .setDescription(
`Welcome to our community! Here you'll find patches, mods, and extras for various games.

**Important links:**

**Server Invitation Link:**
\`\`\`
https://discord.gg/eFBDgY2bup
\`\`\`

**Quick navigation:**
• [Rules](https://discord.com/channels/1033462383798140978/1177257234787471422/1468570201095274552)
• <#1237650687249092670>
• <#1468090646442279206>
• <#1469855556356542649>
• <#1469855518695624725>
• <#1487769618733858956>

**[Click to read from the Beginning](https://discord.com/channels/1033462383798140978/1033506664810287134/1440058017545584871)**`
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'SIIIN Community • Updated links' })
            .setTimestamp();

        try {
            const existingMessage = await infoChannel.messages.fetch(EXISTING_MESSAGE_ID);
            await existingMessage.edit({ embeds: [embed] });
        } catch {
            await infoChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('[UpdateInformationMessage] Error:', err.message);
    }
}

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        console.log(`🤖 ${client.user.tag} connected! (v${BOT_VERSION})`);
        console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);

        try {
            await updateInformationMessage(client);
            await staffCommands.init(client);
            await sendTicketEmbed(client);
            await sendDonationMessage(client);
            await sendSearchLinksMessage(client);

            const chatChannel = await client.channels.fetch(CHAT_CHANNEL_ID).catch(() => null);
            if (chatChannel) {
                await updateChatReminder(chatChannel);
            }

            if (lastVersionLogged !== BOT_VERSION) {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🚀 Bot Online / Restarted')
                        .setColor('#00FF00')
                        .setDescription(`**Release:** ${BOT_VERSION}\n\n**Changelog:**\n# VERSION ${BOT_VERSION} - CONTENT UPDATE`)
                        .addFields(
                            { name: '👥 Servers', value: `${client.guilds.cache.size}`, inline: true },
                            { name: '📅 Date', value: new Date().toLocaleDateString('en-US'), inline: true },
                            { name: '⏰ Time', value: new Date().toLocaleTimeString('en-US'), inline: true },
                            { name: '🛡️ Security', value: 'Automod Active', inline: false },
                            { name: '🎮 APIs', value: 'Steam + Epic + GOG + CheapShark + Mobile', inline: false }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
                lastVersionLogged = BOT_VERSION;
            }

            await updateAll(client);

            for (const guild of client.guilds.cache.values()) {
                await updateStatsEmbed(guild, client, postedGames, postedPromos, postedFreeToPlay, postedMobile);
            }

            setInterval(() => {
                console.log('🟢 Bot alive:', new Date().toLocaleTimeString('en-US'));
            }, 60000);

            setInterval(async () => {
                await updateAll(client);
                for (const guild of client.guilds.cache.values()) {
                    await updateStatsEmbed(guild, client, postedGames, postedPromos, postedFreeToPlay, postedMobile);
                }
            }, 30 * 60 * 1000);

            const hours = Number(process.env.AUTO_REBOOT_HOURS || 12);
            if (hours > 0) {
                setInterval(() => softRestart(client), hours * 60 * 60 * 1000);
                console.log(`⏱️ Autorestart every ${hours}h`);
            }
        } catch (err) {
            console.error('❌ Startup error:', err.message);
        }
    }
};
