const { EmbedBuilder } = require('discord.js');
const { CHANNEL_WELCOME } = require('../config/constants');
const { updateStatsEmbed, postedGames, postedPromos, postedFreeToPlay, postedMobile } = require('../functions/contentUpdater');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            // Welcome message + role (simplified for now)
            const welcomeChannel = await client.channels.fetch(CHANNEL_WELCOME).catch(() => null);
            if (welcomeChannel) {
                // keep your welcome message or simplify
            }

            // Update stats after member join
            setTimeout(async () => {
                try {
                    await updateStatsEmbed(member.guild, client, postedGames, postedPromos, postedFreeToPlay, postedMobile);
                } catch (err) {
                    console.error('[Stats Update] Error:', err.message);
                }
            }, 5000);

        } catch (err) {
            console.error('[Welcome] Error:', err.message);
        }
    }
};