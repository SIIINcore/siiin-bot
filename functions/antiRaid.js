const { EmbedBuilder } = require('discord.js');

const QUARANTINE_ROLE_ID = '1518006090359509205';
const ALERT_CHANNEL_ID = '1517951149301305535';

// Store recent joins (last 10 minutes)
let recentJoins = [];

async function handleAntiRaid(member, client) {
    const now = Date.now();
    const accountAgeMs = now - member.user.createdTimestamp;
    const accountAgeMinutes = Math.floor(accountAgeMs / (1000 * 60));

    // Clean joins older than 10 minutes
    recentJoins = recentJoins.filter(timestamp => now - timestamp < 10 * 60 * 1000);

    // Add current join
    recentJoins.push(now);

    const isVeryNewAccount = accountAgeMinutes < 15;
    const isMassJoin = recentJoins.length > 5;

    if (!isVeryNewAccount && !isMassJoin) {
        return;
    }

    // Assign Quarantine role
    try {
        const quarantineRole = member.guild.roles.cache.get(QUARANTINE_ROLE_ID);
        if (quarantineRole) {
            await member.roles.add(quarantineRole);
        }
    } catch (err) {
        console.error('[AntiRaid] Error adding Quarantine role:', err.message);
    }

    // Send alert
    try {
        const alertChannel = await client.channels.fetch(ALERT_CHANNEL_ID).catch(() => null);
        if (!alertChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('🚨 Anti-Raid - Suspicious Account')
            .setColor(0xFF0000)
            .addFields(
                { name: 'User', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                { name: 'Account Age', value: `${accountAgeMinutes} minute(s)`, inline: true },
                { name: 'Recent Joins (10 min)', value: `${recentJoins.length}`, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false }
            )
            .setTimestamp();

        if (isVeryNewAccount) {
            embed.addFields({ name: 'Reason', value: 'Very new account (less than 15 minutes old)', inline: false });
        }
        if (isMassJoin) {
            embed.addFields({ name: 'Reason', value: 'Mass join detected (more than 5 joins in 10 minutes)', inline: false });
        }

        await alertChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[AntiRaid] Error sending alert:', err.message);
    }
}

module.exports = { handleAntiRaid };
