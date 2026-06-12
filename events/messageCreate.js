const { handleAutomod } = require('../functions/automod');
const { handleTicketMessageFilter } = require('../functions/tickets');
const { CHAT_CHANNEL_ID, STAFF_IDS } = require('../config/constants');

const { updateChatReminder } = require('../functions/contentUpdater');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (!message.guild) return;
        if (message.author.bot) return;

        // Automod
        const isViolation = await handleAutomod(message);
        if (isViolation) return;

        // Ticket channel filter
        if (message.channel.name.startsWith('ticket-')) {
            await handleTicketMessageFilter(message);
        }

        // Chat reminder
        if (message.channel.id === CHAT_CHANNEL_ID && !STAFF_IDS.includes(message.author.id)) {
            setTimeout(async () => {
                try {
                    await updateChatReminder(message.channel);
                } catch (err) {
                    console.error('[ChatReminder] Error:', err.message);
                }
            }, 1000);
        }
    }
};