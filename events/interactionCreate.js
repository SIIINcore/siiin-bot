const { handleTicketInteraction } = require('../functions/tickets');
const staffCommands = require('../staffCommands');
const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        try {
            // Staff commands
            const isStaffCommand = await staffCommands.handleInteraction(interaction, client);
            if (isStaffCommand) return;

            // Ticket system
            if (interaction.isButton()) {
                await handleTicketInteraction(interaction, client);
                return;
            }

            // /SYBan Select Menu
            if (interaction.isStringSelectMenu() && interaction.customId.startsWith('syban_type:')) {
                await handleSYBanSelectMenu(interaction, client);
                return;
            }

            // /SYBan Modal (for TempBan duration)
            if (interaction.isModalSubmit() && interaction.customId.startsWith('syban_duration:')) {
                await handleSYBanModal(interaction, client);
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

// ========================
// /SYBan Select Menu Handler
// ========================
async function handleSYBanSelectMenu(interaction, client) {
    const [_, userId, encodedReason] = interaction.customId.split(':');
    const reason = decodeURIComponent(encodedReason);
    const targetUser = await client.users.fetch(userId).catch(() => null);

    if (!targetUser) {
        return interaction.update({ content: '❌ User not found.', components: [] });
    }

    const choice = interaction.values[0];

    if (choice === 'perm') {
        // PermBan direct
        try {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (member) {
                await member.ban({ reason: reason });
            }

            const logChannel = await interaction.guild.channels.fetch('1417568141428396063').catch(() => null);
            if (logChannel) {
                await logChannel.send(`<@${userId}> \`${reason}\` | \`PermBAN\``);
            }

            await interaction.update({
                content: `✅ <@${userId}> has been permanently banned.`,
                embeds: [],
                components: []
            });
        } catch (err) {
            console.error('[SYBan] PermBan error:', err);
            await interaction.update({ content: '❌ Failed to ban user.', components: [] });
        }
    }

    if (choice === 'temp') {
        // Show modal for duration
        const modal = new ModalBuilder()
            .setCustomId(`syban_duration:${userId}:${encodedReason}`)
            .setTitle('Temporary Ban Duration');

        const daysInput = new TextInputBuilder()
            .setCustomId('days')
            .setLabel('Duration in days')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 7')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(daysInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }
}

// ========================
// /SYBan Modal Handler (TempBan)
// ========================
async function handleSYBanModal(interaction, client) {
    const [_, userId, encodedReason] = interaction.customId.split(':');
    const reason = decodeURIComponent(encodedReason);
    const days = interaction.fields.getTextInputValue('days');

    try {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '❌ User not found or already left.', ephemeral: true });
        }

        await member.ban({
            reason: `${reason} (TempBan: ${days} days)`,
            deleteMessageSeconds: 0
        });

        const logChannel = await interaction.guild.channels.fetch('1417568141428396063').catch(() => null);
        if (logChannel) {
            await logChannel.send(`<@${userId}> \`${reason}\` | \`${days} days\``);
        }

        await interaction.reply({
            content: `✅ <@${userId}> has been banned for ${days} days.`,
            ephemeral: true
        });
    } catch (err) {
        console.error('[SYBan] TempBan error:', err);
        await interaction.reply({ content: '❌ Failed to ban user.', ephemeral: true });
    }
}
