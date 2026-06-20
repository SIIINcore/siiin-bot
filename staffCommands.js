const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { STAFF_IDS } = require('./config/constants');

let commands = [];

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

        commands.push(sayCommand);

        // ========================
        // /SYBan command
        // ========================
        const sybanCommand = new SlashCommandBuilder()
            .setName('syban')
            .setDescription('Ban a user with logging (only works in Ban channel)')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('User to ban')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('Reason for the ban')
                    .setRequired(true));

        commands.push(sybanCommand);

        // Register commands
        try {
            await client.application.commands.set(commands);
            console.log('✅ Staff commands registered');
        } catch (error) {
            console.error('❌ Error registering staff commands:', error);
        }
    },

    // Handle interactions
    handleInteraction: async (interaction, client) => {
        if (!interaction.isChatInputCommand()) return false;

        // /say command
        if (interaction.commandName === 'say') {
            await handleSayCommand(interaction, client);
            return true;
        }

        // /SYBan command
        if (interaction.commandName === 'syban') {
            await handleSYBanCommand(interaction, client);
            return true;
        }

        return false;
    }
};

// /say command handler
async function handleSayCommand(interaction, client) {
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

        await channel.send(content);
        await interaction.editReply({ content: `✅ Message sent to ${channel}` });

    } catch (error) {
        console.error('[Say Command] Error:', error);
        await interaction.editReply({ content: `❌ Error: ${error.message}` });
    }
}

// ========================
// /SYBan Handler
// ========================
async function handleSYBanCommand(interaction, client) {
    const BAN_CHANNEL_ID = '1417568141428396063';

    if (interaction.channelId !== BAN_CHANNEL_ID) {
        return interaction.reply({
            content: '❌ This command can only be used in the Ban channel.',
            ephemeral: true
        });
    }

    if (!STAFF_IDS.includes(interaction.user.id)) {
        return interaction.reply({
            content: '❌ This command is reserved for staff.',
            ephemeral: true
        });
    }

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const embed = new EmbedBuilder()
        .setTitle('🔨 SYBan - Choose Ban Type')
        .setDescription(`**User:** ${targetUser}\n**Reason:** \`${reason}\``)
        .setColor(0xFF0000);

    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`syban_type:${targetUser.id}:${encodeURIComponent(reason)}`)
                .setPlaceholder('Select ban type')
                .addOptions([
                    { label: 'PermBan', value: 'perm', emoji: '🔴' },
                    { label: 'TempBan', value: 'temp', emoji: '🟠' }
                ])
        );

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}
