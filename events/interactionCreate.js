module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        
        console.log(`🖱️ Interaction: ${interaction.customId} by ${interaction.user.tag}`);
        
        // Ticket logic will be added later
    }
};
