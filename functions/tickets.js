const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    AttachmentBuilder,
    ChannelType
} = require('discord.js');
const {
    SUPPORT_CHANNEL_ID,
    TICKET_CATEGORY_ID,
    LOG_CHANNEL_ID,
    TICKET_TRANSCRIPT_CHANNEL_ID,
    BOT_ID,
    STAFF_IDS,
    ALLOWED_FILE_EXTENSIONS
} = require('../config/constants');

function buildTicketSlug(username, userId) {
    const cleaned = (username || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();

    const shortName = cleaned.slice(0, 6);
    return shortName.length === 6 ? shortName : userId;
}

function getTicketChannelName(user) {
    return `ticket-${buildTicketSlug(user.username, user.id)}`;
}

function getTicketOwnerIdFromChannel(channel) {
    if (!channel?.topic) return null;
    const match = channel.topic.match(/ticket-owner:(\d{17,20})/);
    return match ? match[1] : null;
}

async function fetchAllMessages(channel) {
    const allMessages = [];
    let lastId;

    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const batch = await channel.messages.fetch(options);
        if (!batch.size) break;

        allMessages.push(...batch.values());
        lastId = batch.last().id;

        if (batch.size < 100) break;
    }

    return allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function formatTranscript(messages, channel, closerTag) {
    const lines = [];
    const ownerId = getTicketOwnerIdFromChannel(channel) || 'unknown';

    lines.push(`Ticket Transcript`);
    lines.push(`Channel: #${channel.name}`);
    lines.push(`Ticket owner ID: ${ownerId}`);
    lines.push(`Closed by: ${closerTag}`);
    lines.push(`Closed at: ${new Date().toISOString()}`);
    lines.push('='.repeat(72));
    lines.push('');

    for (const message of messages) {
        const createdAt = new Date(message.createdTimestamp).toISOString();
        const attachmentInfo = [...message.attachments.values()]
            .map(att => `${att.name || 'attachment'}: ${att.url}`)
            .join(' | ');

        const embedsInfo = message.embeds.length
            ? ` [Embeds: ${message.embeds.map(embed => embed.title || embed.description || 'embed').join(' | ')}]`
            : '';

        const content = (message.content || '').trim();
        const safeContent = content || '[No text content]';

        lines.push(`[${createdAt}] ${message.author.tag} (${message.author.id})`);
        lines.push(`${safeContent}${embedsInfo}`);
        if (attachmentInfo) {
            lines.push(`Attachments: ${attachmentInfo}`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

async function sendTicketTranscript(channel, closedByUser) {
    try {
        const transcriptChannel = await channel.guild.channels.fetch(TICKET_TRANSCRIPT_CHANNEL_ID).catch(() => null);
        if (!transcriptChannel || transcriptChannel.type !== ChannelType.GuildText) {
            console.warn('[TicketTranscript] Transcript channel not found or invalid.');
            return;
        }

        const messages = await fetchAllMessages(channel);
        const transcriptText = formatTranscript(messages, channel, closedByUser.tag);
        const ownerId = getTicketOwnerIdFromChannel(channel);
        const ownerMention = ownerId ? `<@${ownerId}>` : 'Unknown user';
        const fileName = `${channel.name}-${Date.now()}.txt`;
        const attachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf8'), { name: fileName });

        const uploadMessage = await transcriptChannel.send({ files: [attachment] });
        const uploadedFile = uploadMessage.attachments.first();

        const embed = new EmbedBuilder()
            .setTitle('🧾 Ticket transcript saved')
            .setColor(0x5865F2)
            .setDescription(uploadedFile
                ? `**Ticket:** ${channel.name}\n**Owner:** ${ownerMention}\n**Closed by:** <@${closedByUser.id}>\n[Open transcript](${uploadedFile.url})`
                : `**Ticket:** ${channel.name}\n**Owner:** ${ownerMention}\n**Closed by:** <@${closedByUser.id}>`)
            .setFooter({ text: 'SIIIN Tickets • Transcript archive' })
            .setTimestamp();

        await transcriptChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[TicketTranscript] Error:', error.message);
    }
}

async function sendTicketEmbed(client) {
    try {
        const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID);
        if (!channel) {
            console.warn('❌ Support channel not found!');
            return;
        }

        const messages = await channel.messages.fetch({ limit: 10 });
        for (const [, msg] of messages.filter(m => m.author.id === client.user.id)) {
            await msg.delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 Support / Tickets')
            .setDescription(
`**Push the button to create a ticket**
Our staff will answer as soon as possible.
**Do not Tag us** or the ticket will be deleted!
**Youtube links and images/videos allowed, other links/files blocked**`
            )
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
        console.log('✅ Ticket creation message sent!');
    } catch (err) {
        console.error('[SendTicketEmbed] Error:', err.message);
    }
}

async function handleTicketInteraction(interaction, client) {
    if (!interaction.isButton()) return;

    const guild = interaction.guild;
    const user = interaction.user;
    const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

    if (interaction.customId === 'open_ticket') {
        const existing = guild.channels.cache.find(c =>
            c.parentId === TICKET_CATEGORY_ID && getTicketOwnerIdFromChannel(c) === user.id
        );

        if (existing) {
            return interaction.reply({
                content: `❌ You already have an open ticket: ${existing}`,
                ephemeral: true
            });
        }

        try {
            const ticketChannel = await guild.channels.create({
                name: getTicketChannelName(user),
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY_ID,
                topic: `ticket-owner:${user.id} | ticket-user:${user.tag}`,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AttachFiles
                        ]
                    },
                    ...STAFF_IDS.map(id => ({
                        id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageMessages
                        ]
                    })),
                    {
                        id: BOT_ID,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageMessages
                        ]
                    },
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`🎫 Ticket open for ${user.username}`)
                .setDescription(
`Choose a category:
**SUPPORT** > Need Help about a game
**REQUEST** > Seek to add another game
**OTHER** > None of the previous choices`
                )
                .setColor(0x00FF99)
                .setFooter({ text: 'Select an option below' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_support')
                        .setLabel('SUPPORT')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🎮'),
                    new ButtonBuilder()
                        .setCustomId('ticket_request')
                        .setLabel('REQUEST')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📦'),
                    new ButtonBuilder()
                        .setCustomId('ticket_other')
                        .setLabel('OTHER')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❓'),
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('CLOSE')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

            await ticketChannel.send({
                content: `<@${user.id}>`,
                embeds: [embed],
                components: [row]
            });

            await interaction.reply({
                content: `✅ Your ticket has been created: ${ticketChannel}`,
                ephemeral: true
            });

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📂 Ticket opened')
                    .setColor(0x00FF99)
                    .setDescription(`**User:** ${user.tag} (${user.id})\n**Channel:** ${ticketChannel.name}`)
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (err) {
            console.error('[OpenTicket] Error:', err.message);
            await interaction.reply({
                content: '❌ Error creating ticket',
                ephemeral: true
            });
        }
    }

    if (['ticket_support', 'ticket_request', 'ticket_other'].includes(interaction.customId)) {
        await interaction.deferReply({ ephemeral: true });

        let templateEmbed = new EmbedBuilder();

        if (interaction.customId === 'ticket_support') {
            templateEmbed
                .setTitle('🎮 Support Template')
                .setColor(0x00FF99)
                .setDescription(
`- Game = 
- OS = 
- GPU = 
- CPU = 
- RAM = 
- Drive =
- Describe what you need =`
                );
        } else if (interaction.customId === 'ticket_request') {
            templateEmbed
                .setTitle('📦 Request Template')
                .setColor(0x0099FF)
                .setDescription(
`- GAME NAME = 
- RELEASE YEAR = 
- O / R = # Original or Remastered, if the game hasn't Remaster, just type : "/"
- REASON = # Explain why you need it / If it can be helpful for other people`
                );
        } else if (interaction.customId === 'ticket_other') {
            templateEmbed
                .setTitle('❓ Other Template')
                .setColor(0xFFAA00)
                .setDescription('Describe why did you open the ticket, please.');
        }

        try {
            if (interaction.message.editable) {
                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('CLOSE')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒')
                    );
                await interaction.message.edit({ components: [newRow] });
            }
        } catch (err) {
            console.error('[TicketCategory] Error buttons:', err.message);
        }

        await interaction.followUp({
            embeds: [templateEmbed],
            ephemeral: false
        });

        try {
            await user.send(`Your template has been posted in the ticket, copy it, paste it, and complete it: <#${interaction.channel.id}>`);
        } catch (err) {}
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.channel;

        await sendTicketTranscript(channel, user);

        await interaction.editReply({
            content: '🕐 Ticket will be deleted in 1 minute.'
        });

        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('🗑️ Close ticket')
                .setColor(0xFF0000)
                .setDescription(`**User:** ${user.tag} (${user.id})\n**Channel:** ${channel.name}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }

        await channel.send({
            content: `🔒 Ticket closed by <@${user.id}>. Deletion in 60 seconds...`,
            allowedMentions: { users: [user.id] }
        });

        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (err) {
                console.error('[CloseTicket] Error deletion:', err.message);
            }
        }, 60000);
    }
}

async function handleTicketMessageFilter(message) {
    if (!message.channel.name.startsWith('ticket-') || STAFF_IDS.includes(message.author.id)) return;

    const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;
    const linkRegex = /(https?:\/\/[^\s]+)/i;

    if (linkRegex.test(message.content) && !youtubeRegex.test(message.content)) {
        await message.delete().catch(() => {});
        const warnMsg = await message.channel.send({
            content: `<@${message.author.id}> ❌ Only YouTube links are allowed.`,
            allowedMentions: { users: [message.author.id] }
        });
        setTimeout(() => warnMsg.delete().catch(() => {}), 7000);
        return;
    }

    for (const att of message.attachments.values()) {
        const ext = att.name?.substring(att.name.lastIndexOf('.')).toLowerCase();
        if (ext && !ALLOWED_FILE_EXTENSIONS.includes(ext)) {
            await message.delete().catch(() => {});
            const warnMsg = await message.channel.send({
                content: `<@${message.author.id}> ❌ File type not allowed: ${ext}`,
                allowedMentions: { users: [message.author.id] }
            });
            setTimeout(() => warnMsg.delete().catch(() => {}), 7000);
            break;
        }
    }
}

module.exports = {
    sendTicketEmbed,
    handleTicketInteraction,
    handleTicketMessageFilter
};
