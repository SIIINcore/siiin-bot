const { handleTicketInteraction } = require('../functions/tickets');
const staffCommands = require('../staffCommands');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        try {
            const isStaffCommand = await staffCommands.handleInteraction(interaction, client);
            if (isStaffCommand) return;

            if (interaction.isButton()) {
                await handleTicketInteraction(interaction, client);
                return;
            }
        } catch (error) {
            console.error('[Interaction] Error:', error.message);
            if (interaction.isRepliable()) {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ 
                        content: '❌ An error occurred while processing this interaction.', 
                        ephemeral: true 
                    }).catch(() => {});
                } else {
                    await interaction.reply({ 
                        content: '❌ An error occurred while processing this interaction.', 
                        ephemeral: true 
                    }).catch(() => {});
                }
            }
        }
    }
};