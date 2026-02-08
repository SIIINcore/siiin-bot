const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { STAFF_IDS } = require('./config/constants');

module.exports = {
    // Initialiser les commandes
    init: async (client) => {
        console.log('🔧 Initializing staff commands...');
        
        // Commande /say
        const sayCommand = new SlashCommandBuilder()
            .setName('say')
            .setDescription('Envoyer un message en tant que bot (Staff only)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(option =>
                option.setName('content')
                    .setDescription('Contenu du message (markdown supporté)')
                    .setRequired(true))
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('Salon où envoyer le message')
                    .setRequired(true));
        
        // Enregistrer la commande
        try {
            await client.application.commands.set([sayCommand]);
            console.log('✅ Staff command /say registered');
        } catch (error) {
            console.error('❌ Error registering staff command:', error);
        }
    },
    
    // Gérer les interactions
    handleInteraction: async (interaction, client) => {
        if (!interaction.isChatInputCommand()) return false;
        
        // Vérifier si c'est une commande staff
        if (interaction.commandName === 'say') {
            await handleSayCommand(interaction, client);
            return true;
        }
        
        return false;
    }
};

// Fonction pour la commande /say
async function handleSayCommand(interaction, client) {
    // Vérification staff
    if (!STAFF_IDS.includes(interaction.user.id)) {
        return interaction.reply({ 
            content: '❌ This command is under staff restriction.', 
            ephemeral: true 
        });
    }

    await interaction.deferReply({ ephemeral: true });
    
    const content = interaction.options.getString('content');
    const channel = interaction.options.getChannel('channel');
    
    try {
        // Vérifications
        if (!channel.isTextBased()) {
            return interaction.editReply({ 
                content: '❌ This channel is not set for custom messages.' 
            });
        }
        
        const permissions = channel.permissionsFor(client.user);
        if (!permissions.has(PermissionFlagsBits.SendMessages)) {
            return interaction.editReply({ 
                content: '❌ I am not allowed to post here.' 
            });
        }
        
        // Envoyer le message
        await channel.send(content);
        
        await interaction.editReply({ 
            content: `✅ Message sent to ${channel}` 
        });
        
    } catch (error) {
        console.error('[Say Command] Error:', error);
        await interaction.editReply({ 
            content: `❌ Error: ${error.message}` 
        });
    }
}
