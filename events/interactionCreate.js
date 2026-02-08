module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        
        console.log(`🖱️ Interaction: ${interaction.customId} par ${interaction.user.tag}`);
        
        // Logique des tickets sera ajoutée plus tard
    }
};
