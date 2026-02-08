const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { SUPPORT_CHANNEL_ID } = require('../config/constants');

async function sendTicketEmbed(client) {
    try {
        const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID);
        if (!channel) {
            console.warn("❌ Support channel not found!");
            return;
        }

        // Supprimer anciens messages du bot
        const messages = await channel.messages.fetch({ limit: 10 });
        for (const [, msg] of messages.filter(m => m.author.id === client.user.id)) {
            await msg.delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setTitle("🎫 Support / Tickets")
            .setDescription("**Push the button to create a ticket**")
            .setColor(0x00FF99)
            .setFooter({ text: 'SIIIN Support • Click below' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('Open a ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫')
            );

        await channel.send({ embeds: [embed], components: [row] });
        console.log("✅ Ticket creation message sent!");
        
    } catch (err) {
        console.error('[SendTicketEmbed] Error:', err.message);
    }
}

module.exports = { sendTicketEmbed };
