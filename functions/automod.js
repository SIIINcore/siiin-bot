const { containsBadWord, isDangerousLink } = require('../utils/validators');
const { EmbedBuilder } = require('discord.js');
const { AUTOMOD, STAFF_IDS, BAN_LOG_CHANNEL_ID } = require('../config/constants');

let userWarnings = new Map();
const MAX_WARNINGS = AUTOMOD_CONFIG.MAX_WARNINGS || 3;

async function handleAutomod(message) {
    if (STAFF_IDS.includes(message.author.id)) return false;
    
    const content = message.content;
    const authorId = message.author.id;
    
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
        .setTitle("🚫 Message Censored")
        .setDescription(`█████████████████████████████████████████████████`)
        .addFields(
            { name: 'Censorship Reason:', value: `**${reason}**`, inline: false },
            { name: 'User:', value: `<@${message.author.id}>`, inline: true },
            { name: 'Warnings:', value: `${newWarnings}/${MAX_WARNINGS}`, inline: true }
        )
        .setColor(0xFF0000)
        .setFooter({ text: 'Automod System • SIIIN Protection' })
        .setTimestamp();

    const warningMsg = await message.channel.send({ embeds: [censoredEmbed] });
    setTimeout(() => warningMsg.delete().catch(() => {}), 10000);
    
    userWarnings.set(authorId, newWarnings);
    
    if (newWarnings >= MAX_WARNINGS) {
        await handleBan(message.author, `Reached ${MAX_WARNINGS} automod warnings`, message.client);
    }
    
    try {
        await message.author.send({
            content: `⚠️ **You received a warning on ${message.guild.name}**\n` +
                    `**Reason:** ${reason}\n` +
                    `**Warnings:** ${newWarnings}/${MAX_WARNINGS}\n` +
                    `⚠️ **${MAX_WARNINGS - newWarnings} warning(s) remaining before ban**\n\n` +
                    `Please respect the server rules.`
        });
    } catch (err) {}
    
    return true;
}

async function handleDangerousLink(message, reason) {
    const authorId = message.author.id;
    
    try {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        const userMessages = messages.filter(m => m.author.id === authorId && Date.now() - m.createdTimestamp < 10 * 60 * 1000);
        
        for (const msg of userMessages.values()) {
            await msg.delete().catch(() => {});
        }
    } catch (err) {
        console.error('[Automod] Error deleting messages:', err.message);
    }
    
    await handleBan(message.author, `Dangerous link posted: ${reason}`, message.client);
    
    const banEmbed = new EmbedBuilder()
        .setTitle("⛔ IMMEDIATE BAN")
        .setDescription(`**User posted dangerous content**`)
        .addFields(
            { name: 'User:', value: `${message.author.tag} (${authorId})`, inline: false },
            { name: 'Reason:', value: reason, inline: false },
            { name: 'Action:', value: 'Immediate ban + message purge', inline: false }
        )
        .setColor(0xFF0000)
        .setFooter({ text: 'Automod Security System' })
        .setTimestamp();
    
    await message.channel.send({ embeds: [banEmbed] });
    
    return true;
}

async function handleBan(user, reason, client) {
    try {
        const banLogChannel = await client.channels.fetch(BAN_LOG_CHANNEL_ID).catch(() => null);
        
        await user.ban({ reason: reason, deleteMessageSeconds: 60 * 10 });
        
        if (banLogChannel) {
            const embed = new EmbedBuilder()
                .setTitle("🔨 User Banned")
                .setColor(0xFF0000)
                .addFields(
                    { name: 'User Tag:', value: user.tag, inline: true },
                    { name: 'User ID:', value: user.id, inline: true },
                    { name: 'Reason:', value: reason, inline: false },
                    { name: 'Banned by:', value: 'Automod System', inline: true },
                    { name: 'Time:', value: new Date().toLocaleString('en-US'), inline: true }
                )
                .setFooter({ text: 'SIIIN Security • Ban Log' })
                .setTimestamp();
            
            await banLogChannel.send({ embeds: [embed] });
        }
        
        console.log(`✅ Banned ${user.tag} for: ${reason}`);
        
    } catch (err) {
        console.error(`❌ Failed to ban ${user.tag}:`, err.message);
    }
}

module.exports = {
    handleAutomod,
    userWarnings
};
