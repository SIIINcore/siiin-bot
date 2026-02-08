const { STAFF_IDS } = require('../config/constants');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;
        
        // Automod and tickets logic will be added later
        // For now, just keep the logic in index.js
        
        console.log(`📝 Message from ${message.author.tag}: ${message.content.substring(0, 50)}...`);
    }
};
