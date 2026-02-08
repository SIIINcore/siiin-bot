const { STATS_CHANNEL_ID } = require('../config/constants');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        console.log(`👋 ${member.user.tag} left the server.`);
        
        // Update stats
        setTimeout(async () => {
            try {
                const { updateStatsEmbed } = require('./ready');
                const { postedGames, postedPromos, postedFreeToPlay } = require('../functions/contentUpdater');
                await updateStatsEmbed(member.guild, client, postedGames, postedPromos, postedFreeToPlay);
            } catch (err) {
                console.error('[Stats Update] Error:', err.message);
            }
        }, 5000);
    }
};
