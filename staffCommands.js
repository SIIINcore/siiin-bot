const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { STAFF_IDS } = require('./config/constants');

module.exports = {
    // Initialize commands
    init: async (client) => {
        console.log('🔧 Initializing staff commands...');
        
        // /say command
        const sayCommand = new SlashCommandBuilder()
            .setName('say')
            .setDescription('Send a message as the bot (Staff only)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(option =>
                option.setName('content')
                    .setDescription('Message content (markdown supported)')
                    .setRequired(true))
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('Channel to send the message to')
                    .setRequired(true));
        
        // Register command
        try {
            await client.application.commands.set([sayCommand]);
            console.log('✅ Staff command /say registered');
        } catch (error) {
            console.error('❌ Error registering staff command:', error);
        }
    },
    
    // Handle interactions
    handleInteraction: async (interaction, client) => {
        if (!interaction.isChatInputCommand()) return false;
        
        // Check if it's a staff command
        if (interaction.commandName === 'say') {
            await handleSayCommand(interaction, client);
            return true;
        }
        
        return false;
    }
};

// /say command handler
async function handleSayCommand(interaction, client) {
    // Staff verification
    if (!STAFF_IDS.includes(interaction.user.id)) {
        return interaction.reply({ 
            content: '❌ This command is reserved for staff.', 
            ephemeral: true 
        });
    }

    await interaction.deferReply({ ephemeral: true });
    
    const content = interaction.options.getString('content');
    const channel = interaction.options.getChannel('channel');
    
    try {
        // Validations
        if (!channel.isTextBased()) {
            return interaction.editReply({ 
                content: '❌ This channel does not support text messages.' 
            });
        }
        
        const permissions = channel.permissionsFor(client.user);
        if (!permissions.has(PermissionFlagsBits.SendMessages)) {
            return interaction.editReply({ 
                content: '❌ I do not have permission to send messages in this channel.' 
            });
        }
        
        // Send the message
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
