const { CHANNEL_WELCOME, BOT_VERSION } = require('../config/constants');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        console.log(`👋 ${member.user.tag} joined the server!`);
        
        // Welcome logic will be added later
        // For now just a log
    }
};
