const { handleTicketInteraction } = require('../functions/tickets');
const staffCommands = require('../staffCommands');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        try {
            // First check if it's a staff slash command
            const isStaffCommand = await staffCommands.handleInteraction(interaction, client);
            if (isStaffCommand) return;
            
            // Then handle ticket buttons
            if (interaction.isButton()) {
                await handleTicketInteraction(interaction, client);
                return;
            }
            
            // Optional: Add other interaction types here
            // if (interaction.isModalSubmit()) { ... }
            // if (interaction.isSelectMenu()) { ... }
            
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
