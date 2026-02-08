const { CHANNEL_WELCOME, BOT_VERSION } = require('../config/constants');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        console.log(`👋 ${member.user.tag} a rejoint le serveur!`);
        
        // Logique du welcome sera ajoutée plus tard
        // Pour l'instant juste un log
    }
};
