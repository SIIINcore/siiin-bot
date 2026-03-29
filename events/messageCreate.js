const { handleAutomod } = require('../functions/automod');
const { handleTicketMessageFilter } = require('../functions/tickets');
const { CHAT_CHANNEL_ID, STAFF_IDS } = require('../config/constants');
const { shouldOfferTranslation, attachTranslationHelper } = require('../functions/translation');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (!message.guild) return;

        if (shouldOfferTranslation(message, client)) {
            await attachTranslationHelper(message);
        }

        if (message.author.bot) return;
        
        // Automod
        const isViolation = await handleAutomod(message);
        if (isViolation) return;
        
        // Ticket channel filter
        if (message.channel.name.startsWith('ticket-')) {
            await handleTicketMessageFilter(message);
        }
        
        // Chat reminder system
        if (message.channel.id === CHAT_CHANNEL_ID && !STAFF_IDS.includes(message.author.id)) {
            setTimeout(async () => {
                try {
                    const { updateChatReminder } = require('./ready');
                    await updateChatReminder(message.channel);
                } catch (err) {
                    console.error('[ChatReminder Update] Error:', err.message);
                }
            }, 1000);
        }
    }
};
