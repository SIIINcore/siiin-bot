const { updateAll } = require('../functions/contentUpdater');
const { sendTicketEmbed } = require('../functions/tickets');
const { BOT_VERSION } = require('../config/constants');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`🤖 ${client.user.tag} connected! (v${BOT_VERSION})`);
        
        try {
            // Initialization
            await sendTicketEmbed(client);
            console.log('✅ Ticket embed sent');
            
            await updateAll(client);
            console.log('✅ Initial content updated');
            
            console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
            
            // Heartbeat
            setInterval(() => {
                console.log('🟢 Bot alive:', new Date().toLocaleTimeString('en-US'));
            }, 60000);
            
            // Auto update every 30 minutes
            setInterval(() => updateAll(client), 30 * 60 * 1000);
            
        } catch (error) {
            console.error('❌ Error during ready event:', error.message);
        }
    }
};
