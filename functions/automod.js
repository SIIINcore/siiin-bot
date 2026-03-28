const { containsBadWord, isDangerousLink } = require('../utils/validators');
const { EmbedBuilder } = require('discord.js');
const { STAFF_IDS, BAN_LOG_CHANNEL_ID } = require('../config/constants');

let userWarnings = new Map();
const MAX_WARNINGS = 3;

async function handleAutomod(message) {
    if (!message?.guild || !message?.author || STAFF_IDS.includes(message.author.id)) return false;

    const content = message.content || '';
    const badWordCheck = containsBadWord(content);
    if (badWordCheck.found) {
        await handleViolation(message, badWordCheck.reason);
        return true;
    }

    const linkCheck = isDangerousLink(content);
    if (linkCheck.dangerous) {
        await handleDangerousLink(message, linkCheck.reason);
        return true;
    }

    return false;
}

async function handleViolation(message, reason) {
    const authorId = message.author.id;
    const warnings = userWarnings.get(authorId) || 0;
    const newWarnings = warnings + 1;

    await message.delete().catch(() => {});

    const censoredEmbed = new EmbedBuilder()
        .setTitle('🚫 Message removed')
        .setDescription('A message was removed by automod.')
        .addFields(
            { name: 'Reason', value: reason, inline: false },
            { name: 'User', value: `<@${message.author.id}>`, inline: true },
            { name: 'Warnings', value: `${newWarnings}/${MAX_WARNINGS}`, inline: true }
        )
        .setColor(0xFF0000)
        .setFooter({ text: 'Automod System • SIIIN Protection' })
        .setTimestamp();

    const warningMsg = await message.channel.send({ embeds: [censoredEmbed] }).catch(() => null);
    if (warningMsg) setTimeout(() => warningMsg.delete().catch(() => {}), 10000);

    userWarnings.set(authorId, newWarnings);

    if (newWarnings >= MAX_WARNINGS) {
        await handleBan(message.member, `Reached ${MAX_WARNINGS} automod warnings`, message.client, 'Automod System');
    }

    try {
        await message.author.send({
            content:
                `⚠️ You received a warning on ${message.guild.name}\n` +
                `Reason: ${reason}\n` +
                `Warnings: ${newWarnings}/${MAX_WARNINGS}\n` +
                `${Math.max(0, MAX_WARNINGS - newWarnings)} warning(s) remaining before ban.`
        });
    } catch (_) {}

    return true;
}

async function handleDangerousLink(message, reason) {
    const authorId = message.author.id;

    try {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        const userMessages = messages.filter(
            m => m.author.id === authorId && Date.now() - m.createdTimestamp < 10 * 60 * 1000
        );

        for (const msg of userMessages.values()) {
            await msg.delete().catch(() => {});
        }
    } catch (err) {
        console.error('[Automod] Error deleting messages:', err.message);
    }

    await handleBan(message.member, `Dangerous link posted: ${reason}`, message.client, 'Automod System');

    const banEmbed = new EmbedBuilder()
        .setTitle('⛔ Immediate ban')
        .setDescription('A dangerous link was detected and removed.')
        .addFields(
            { name: 'User', value: `${message.author.tag} (${authorId})`, inline: false },
            { name: 'Reason', value: reason, inline: false },
            { name: 'Action', value: 'Immediate ban + recent message cleanup', inline: false }
        )
        .setColor(0xFF0000)
        .setFooter({ text: 'Automod Security System' })
        .setTimestamp();

    await message.channel.send({ embeds: [banEmbed] }).catch(() => {});

    return true;
}

async function sendBanLog(client, userId, reason) {
    try {
        const banLogChannel = await client.channels.fetch(BAN_LOG_CHANNEL_ID).catch(() => null);
        if (!banLogChannel || !banLogChannel.isTextBased()) return;
        await banLogChannel.send(`<@${userId}> \`${reason || 'No reason provided'}\``);
    } catch (err) {
        console.error('[Automod] Failed to send ban log:', err.message);
    }
}

async function handleBan(member, reason, client, moderatorTag = 'Automod System') {
    try {
        if (!member || !member.guild) {
            console.error('❌ Failed to ban: member object missing');
            return;
        }

        await member.ban({ reason, deleteMessageSeconds: 60 * 10 });
        await sendBanLog(client, member.id, reason);
        console.log(`✅ Banned ${member.user?.tag || member.id} for: ${reason} (${moderatorTag})`);
    } catch (err) {
        console.error(`❌ Failed to ban ${member?.user?.tag || member?.id || 'unknown'}:`, err.message);
    }
}

module.exports = {
    handleAutomod,
    userWarnings,
    handleBan,
    sendBanLog
};
