const { STAFF_IDS } = require('../config/constants');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;
        
        // Ici on mettra l'automod et les tickets plus tard
        // Pour l'instant, on garde la logique dans index.js
        
        console.log(`📝 Message de ${message.author.tag}: ${message.content.substring(0, 50)}...`);
    }
};
