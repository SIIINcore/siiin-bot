const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { LOG_CHANNEL_ID } = require('../config/constants');

module.exports = {
    name: 'guildAuditLogEntryCreate',
    async execute(auditLogEntry, guild) {
        try {
            const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);
            if (!logChannel) return;
            
            const executor = auditLogEntry.executor;
            const target = auditLogEntry.target;
            
            if (executor?.bot) return;
            
            let embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTimestamp();
            
            switch (auditLogEntry.action) {
                case AuditLogEvent.MemberBanAdd:
                    embed
                        .setTitle("🔨 Member Banned")
                        .addFields(
                            { name: 'User:', value: target?.tag || 'Unknown', inline: true },
                            { name: 'User ID:', value: target?.id || 'Unknown', inline: true },
                            { name: 'Moderator:', value: executor?.tag || 'Unknown', inline: true },
                            { name: 'Reason:', value: auditLogEntry.reason || 'No reason provided', inline: false }
                        );
                    break;
                    
                case AuditLogEvent.MemberBanRemove:
                    embed
                        .setTitle("✅ Member Unbanned")
                        .addFields(
                            { name: 'User:', value: target?.tag || 'Unknown', inline: true },
                            { name: 'User ID:', value: target?.id || 'Unknown', inline: true },
                            { name: 'Moderator:', value: executor?.tag || 'Unknown', inline: true }
                        );
                    break;
                    
                case AuditLogEvent.MemberKick:
                    embed
                        .setTitle("👢 Member Kicked")
                        .addFields(
                            { name: 'User:', value: target?.tag || 'Unknown', inline: true },
                            { name: 'Moderator:', value: executor?.tag || 'Unknown', inline: true },
                            { name: 'Reason:', value: auditLogEntry.reason || 'No reason provided', inline: false }
                        );
                    break;
                    
                case AuditLogEvent.MemberUpdate:
                    if (auditLogEntry.changes?.some(change => change.key === '$add' || change.key === '$remove')) {
                        const addedRoles = auditLogEntry.changes.find(c => c.key === '$add')?.new || [];
                        const removedRoles = auditLogEntry.changes.find(c => c.key === '$remove')?.new || [];
                        
                        if (addedRoles.length > 0 || removedRoles.length > 0) {
                            embed.setTitle("🎭 Role Update");
                            
                            const fields = [];
                            fields.push({ name: 'User:', value: target?.tag || 'Unknown', inline: true });
                            fields.push({ name: 'Moderator:', value: executor?.tag || 'Unknown', inline: true });
                            
                            if (addedRoles.length > 0) {
                                const roleNames = addedRoles.map(r => `<@&${r.id}>`).join(', ');
                                fields.push({ name: 'Roles Added:', value: roleNames, inline: false });
                            }
                            
                            if (removedRoles.length > 0) {
                                const roleNames = removedRoles.map(r => `<@&${r.id}>`).join(', ');
                                fields.push({ name: 'Roles Removed:', value: roleNames, inline: false });
                            }
                            
                            embed.addFields(fields);
                        }
                    }
                    break;
                    
                default:
                    return;
            }
            
            if (embed.data.fields && embed.data.fields.length > 0) {
                await logChannel.send({ embeds: [embed] });
            }
            
        } catch (err) {
            console.error('[AuditLog] Error:', err.message);
        }
    }
};
