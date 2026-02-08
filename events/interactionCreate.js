const { handleTicketInteraction } = require('../functions/tickets');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        try {
            await handleTicketInteraction(interaction, client);
        } catch (error) {
            console.error('[Interaction] Error:', error.message);
            if (interaction.isRepliable()) {
                await interaction.reply({ 
                    content: '❌ An error occurred while processing this interaction.', 
                    ephemeral: true 
                }).catch(() => {});
            }
        }
    }
};
