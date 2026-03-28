const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { LOG_CHANNEL_ID, BAN_LOG_CHANNEL_ID } = require('../config/constants');

async function sendSimpleBanLog(guild, userId, reason) {
    try {
        const banLogChannel = await guild.channels.fetch(BAN_LOG_CHANNEL_ID).catch(() => null);
        if (!banLogChannel || !banLogChannel.isTextBased()) return;
        await banLogChannel.send(`<@${userId}> \`${reason || 'No reason provided'}\``);
    } catch (err) {
        console.error('[AuditLog] Failed to send simple ban log:', err.message);
    }
}

module.exports = {
    name: 'guildAuditLogEntryCreate',
    async execute(auditLogEntry, guild) {
        try {
            const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            const executor = auditLogEntry.executor;
            const target = auditLogEntry.target;

            if (executor?.bot) return;

            let embed = new EmbedBuilder().setColor(0x5865F2).setTimestamp();

            switch (auditLogEntry.action) {
                case AuditLogEvent.MemberBanAdd:
                    embed
                        .setTitle('🔨 Member banned')
                        .addFields(
                            { name: 'User', value: target?.tag || `<@${target?.id || 'unknown'}>`, inline: true },
                            { name: 'User ID', value: target?.id || 'Unknown', inline: true },
                            { name: 'Moderator', value: executor?.tag || 'Unknown', inline: true },
                            { name: 'Reason', value: auditLogEntry.reason || 'No reason provided', inline: false }
                        );

                    if (target?.id) {
                        await sendSimpleBanLog(guild, target.id, auditLogEntry.reason || 'No reason provided');
                    }
                    break;

                case AuditLogEvent.MemberBanRemove:
                    embed
                        .setTitle('✅ Member unbanned')
                        .addFields(
                            { name: 'User', value: target?.tag || 'Unknown', inline: true },
                            { name: 'User ID', value: target?.id || 'Unknown', inline: true },
                            { name: 'Moderator', value: executor?.tag || 'Unknown', inline: true }
                        );
                    break;

                case AuditLogEvent.MemberKick:
                    embed
                        .setTitle('👢 Member kicked')
                        .addFields(
                            { name: 'User', value: target?.tag || 'Unknown', inline: true },
                            { name: 'Moderator', value: executor?.tag || 'Unknown', inline: true },
                            { name: 'Reason', value: auditLogEntry.reason || 'No reason provided', inline: false }
                        );
                    break;

                case AuditLogEvent.MemberUpdate: {
                    const addedRoles = auditLogEntry.changes?.find(c => c.key === '$add')?.new || [];
                    const removedRoles = auditLogEntry.changes?.find(c => c.key === '$remove')?.new || [];

                    if (addedRoles.length === 0 && removedRoles.length === 0) return;

                    embed.setTitle('🎭 Role update').addFields(
                        { name: 'User', value: target?.tag || 'Unknown', inline: true },
                        { name: 'Moderator', value: executor?.tag || 'Unknown', inline: true }
                    );

                    if (addedRoles.length > 0) {
                        embed.addFields({
                            name: 'Roles added',
                            value: addedRoles.map(r => `<@&${r.id}>`).join(', '),
                            inline: false
                        });
                    }

                    if (removedRoles.length > 0) {
                        embed.addFields({
                            name: 'Roles removed',
                            value: removedRoles.map(r => `<@&${r.id}>`).join(', '),
                            inline: false
                        });
                    }
                    break;
                }

                default:
                    return;
            }

            if (logChannel && embed.data.fields?.length) {
                await logChannel.send({ embeds: [embed] });
            }
        } catch (err) {
            console.error('[AuditLog] Error:', err.message);
        }
    }
};
