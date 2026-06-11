const { updateStatsEmbed, postedGames, postedPromos, postedFreeToPlay, postedMobile } = require('../functions/contentUpdater');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        console.log(`👋 ${member.user.tag} left the server.`);

        setTimeout(async () => {
            try {
                await updateStatsEmbed(member.guild, client, postedGames, postedPromos, postedFreeToPlay, postedMobile);
            } catch (err) {
                console.error('[Stats Update] Error:', err.message);
            }
        }, 5000);
    }
};