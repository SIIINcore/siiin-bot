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

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildTicketSlug(name, userId) {
    const cleaned = (name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();

    const shortName = cleaned.slice(0, 6);
    return shortName.length >= 1 ? shortName : userId;
}

function getTicketChannelName(user, member) {
    const sourceName = member?.displayName || user.globalName || user.username;
    return `ticket-${buildTicketSlug(sourceName, user.id)}`;
}

function getTicketOwnerIdFromChannel(channel) {
    if (!channel?.topic) return null;
    const match = channel.topic.match(/ticket-owner:(\d{17,20})/);
    return match ? match[1] : null;
}

async function resolveTicketOwner(channel, messages = null) {
    let ownerId = getTicketOwnerIdFromChannel(channel);

    if (!ownerId) {
        const memberOverwrite = channel.permissionOverwrites.cache.find(overwrite =>
            overwrite.type === 1 &&
            overwrite.id !== channel.guild.members.me?.id &&
            !STAFF_IDS.includes(overwrite.id)
        );
        ownerId = memberOverwrite?.id || null;
    }

    if (!ownerId) {
        const history = messages || await fetchAllMessages(channel);
        const firstBotMessage = history.find(msg => msg.author.id === channel.client.user.id);
        const mention = firstBotMessage?.content?.match(/<@(\d{17,20})>/);
        ownerId = mention ? mention[1] : null;
    }

    if (!ownerId) {
        return {
            id: null,
            mention: 'Unknown user',
            label: 'Unknown user'
        };
    }

    const ownerUser = await channel.client.users.fetch(ownerId).catch(() => null);
    const ownerMember = await channel.guild.members.fetch(ownerId).catch(() => null);
    const displayName = ownerMember?.displayName || ownerUser?.globalName || ownerUser?.username || ownerId;

    return {
        id: ownerId,
        mention: `<@${ownerId}>`,
        label: displayName
    };
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

function buildTranscriptHtml(messages, channel, owner, closedByUser) {
    const closedAt = new Date().toISOString();
    const rows = messages.map(message => {
        const createdAt = new Date(message.createdTimestamp).toISOString();
        const authorName = escapeHtml(message.member?.displayName || message.author.globalName || message.author.username || message.author.tag);
        const authorTag = escapeHtml(message.author.tag || message.author.username || message.author.id);
        const content = escapeHtml((message.content || '').trim() || '[No text content]');
        const attachments = [...message.attachments.values()]
            .map(att => `<li><a href="${escapeHtml(att.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(att.name || 'attachment')}</a></li>`)
            .join('');
        const embeds = message.embeds.map(embed => {
            const title = escapeHtml(embed.title || 'Embed');
            const description = escapeHtml(embed.description || '');
            return `<div class="embed"><strong>${title}</strong>${description ? `<div class="embed-desc">${description}</div>` : ''}</div>`;
        }).join('');

        return `
        <article class="message">
            <header>
                <div class="author">${authorName}</div>
                <div class="meta">${authorTag} • ${createdAt}</div>
            </header>
            <div class="content">${content.replace(/\n/g, '<br>')}</div>
            ${embeds}
            ${attachments ? `<ul class="attachments">${attachments}</ul>` : ''}
        </article>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket Transcript - ${escapeHtml(channel.name)}</title>
    <style>
        :root {
            color-scheme: dark;
            --bg: #0f1117;
            --panel: #171a22;
            --line: #2a2f3a;
            --text: #f2f3f5;
            --muted: #aeb4bf;
            --accent: #5865f2;
            --accent-soft: rgba(88,101,242,0.14);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: linear-gradient(180deg, #0b0d12 0%, var(--bg) 100%);
            color: var(--text);
            padding: 32px 18px;
        }
        .container {
            max-width: 980px;
            margin: 0 auto;
        }
        .hero, .message {
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 18px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }
        .hero {
            padding: 24px;
            margin-bottom: 20px;
        }
        .badge {
            display: inline-block;
            background: var(--accent-soft);
            color: #c7ceff;
            border: 1px solid rgba(88,101,242,0.28);
            border-radius: 999px;
            padding: 6px 10px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: .02em;
            margin-bottom: 12px;
        }
        h1 {
            margin: 0 0 8px;
            font-size: 30px;
        }
        .subtitle {
            margin: 0 0 18px;
            color: var(--muted);
            font-size: 15px;
        }
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
        }
        .meta-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--line);
            border-radius: 14px;
            padding: 14px;
        }
        .meta-label {
            color: var(--muted);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: .06em;
            margin-bottom: 6px;
        }
        .meta-value {
            font-size: 15px;
            word-break: break-word;
        }
        .messages {
            display: grid;
            gap: 14px;
        }
        .message {
            padding: 18px;
        }
        .message header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 10px;
        }
        .author {
            font-weight: 700;
        }
        .meta {
            color: var(--muted);
            font-size: 13px;
        }
        .content {
            line-height: 1.65;
            white-space: normal;
            overflow-wrap: anywhere;
        }
        .attachments {
            margin: 12px 0 0;
            padding-left: 18px;
        }
        .attachments a {
            color: #9ab1ff;
        }
        .embed {
            margin-top: 12px;
            padding: 12px;
            border-left: 4px solid var(--accent);
            background: rgba(255,255,255,0.03);
            border-radius: 10px;
        }
        .embed-desc {
            margin-top: 6px;
            color: var(--muted);
            line-height: 1.5;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <div class="container">
        <section class="hero">
            <div class="badge">SIIIN Ticket Transcript</div>
            <h1>#${escapeHtml(channel.name)}</h1>
            <p class="subtitle">This archive was generated when the ticket was closed.</p>
            <div class="meta-grid">
                <div class="meta-card">
                    <div class="meta-label">Ticket owner</div>
                    <div class="meta-value">${escapeHtml(owner.label)}${owner.id ? ` (${escapeHtml(owner.id)})` : ''}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">Closed by</div>
                    <div class="meta-value">${escapeHtml(closedByUser.tag)} (${escapeHtml(closedByUser.id)})</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">Closed at</div>
                    <div class="meta-value">${escapeHtml(closedAt)}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">Messages</div>
                    <div class="meta-value">${messages.length}</div>
                </div>
            </div>
        </section>

        <section class="messages">
            ${rows || '<div class="message"><div class="content">No messages found in this ticket.</div></div>'}
        </section>
    </div>
</body>
</html>`;
}

async function sendTicketTranscript(channel, closedByUser) {
    try {
        const transcriptChannel = await channel.guild.channels.fetch(TICKET_TRANSCRIPT_CHANNEL_ID).catch(() => null);
        if (!transcriptChannel || transcriptChannel.type !== ChannelType.GuildText) {
            console.warn('[TicketTranscript] Transcript channel not found or invalid.');
            return;
        }

        const messages = await fetchAllMessages(channel);
        const owner = await resolveTicketOwner(channel, messages);
        const transcriptHtml = buildTranscriptHtml(messages, channel, owner, closedByUser);
        const safeChannelName = channel.name.replace(/[^a-zA-Z0-9-_]/g, '');
        const fileName = `${safeChannelName || 'ticket'}-${Date.now()}.html`;
        const attachment = new AttachmentBuilder(Buffer.from(transcriptHtml, 'utf8'), { name: fileName });

        const uploadMessage = await transcriptChannel.send({ files: [attachment] });
        const uploadedFile = uploadMessage.attachments.first();

        const embed = new EmbedBuilder()
            .setTitle('🧾 Ticket transcript saved')
            .setColor(0x5865F2)
            .setDescription(
                `**Ticket:** ${channel.name}\n` +
                `**Owner:** ${owner.mention}\n` +
                `**Closed by:** <@${closedByUser.id}>` +
                (uploadedFile ? `\n[Open transcript](${uploadedFile.url})` : '')
            )
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
            .setTitle('🎫 Support Center')
            .setDescription(
`Need help, want to request a game, or have something else to ask?
Press the button below to open a private ticket with the staff team.

**Important**
• Please do not ping the staff team
• YouTube links and media files are allowed
• Other links or unsupported files will be removed`
            )
            .setColor(0x00FF99)
            .setFooter({ text: 'SIIIN Support • Open a ticket below' });

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
    const member = interaction.member;
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
                name: getTicketChannelName(user, member),
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
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    ...STAFF_IDS.map(id => ({
                        id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    })),
                    {
                        id: BOT_ID,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles
                        ]
                    },
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`🎫 Welcome, ${member?.displayName || user.globalName || user.username}`)
                .setDescription(
`Your private ticket has been created successfully.
Please choose the option that matches your request below.

**SUPPORT** → Need help with a game
**REQUEST** → Want to suggest another game
**OTHER** → Anything else`
                )
                .setColor(0x00FF99)
                .addFields(
                    {
                        name: 'Before you continue',
                        value: 'Be as clear as possible and include any useful details, screenshots, or videos.'
                    }
                )
                .setFooter({ text: 'Select a category to continue' });

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
                components: [row],
                allowedMentions: { users: [user.id] }
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
                .setTitle('🎮 Support Form')
                .setColor(0x00FF99)
                .setDescription(
`Please copy the format below and fill it in:

**Game:** 
**OS:** 
**GPU:** 
**CPU:** 
**RAM:** 
**Drive:** 
**Issue details:**`
                );
        } else if (interaction.customId === 'ticket_request') {
            templateEmbed
                .setTitle('📦 Game Request Form')
                .setColor(0x0099FF)
                .setDescription(
`Please copy the format below and fill it in:

**Game name:** 
**Release year:** 
**Original / Remaster:** 
**Reason:**`
                );
        } else if (interaction.customId === 'ticket_other') {
            templateEmbed
                .setTitle('❓ Other Request')
                .setColor(0xFFAA00)
                .setDescription(
`Please explain your request as clearly as possible so the staff team can help you quickly.`
                );
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

        await interaction.channel.send({
            content: `Here is the template for <@${user.id}>:`,
            embeds: [templateEmbed],
            allowedMentions: { users: [user.id] }
        });

        await interaction.editReply({
            content: '✅ Template sent in this ticket.'
        });
    }

    if (interaction.customId === 'close_ticket') {
        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_close_ticket')
                    .setLabel('Yes, close ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId('cancel_close_ticket')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('↩️')
            );

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Confirm ticket closure')
            .setColor(0xFFAA00)
            .setDescription('Are you sure you want to close this ticket? A transcript will be saved before deletion.');

        return interaction.reply({
            embeds: [confirmEmbed],
            components: [confirmRow],
            ephemeral: true
        });
    }

    if (interaction.customId === 'cancel_close_ticket') {
        return interaction.update({
            content: 'Ticket closure cancelled.',
            embeds: [],
            components: []
        });
    }

    if (interaction.customId === 'confirm_close_ticket') {
        await interaction.update({
            content: '🕐 Ticket will be deleted in 15 seconds. Saving transcript now...',
            embeds: [],
            components: []
        });

        const channel = interaction.channel;
        await sendTicketTranscript(channel, user);

        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('🗑️ Ticket closed')
                .setColor(0xFF0000)
                .setDescription(`**User:** ${user.tag} (${user.id})\n**Channel:** ${channel.name}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }

        await channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🔒 Ticket closed')
                    .setColor(0xFF0000)
                    .setDescription(`This ticket was closed by <@${user.id}>. It will be deleted in **15 seconds**.`)
                    .setFooter({ text: 'A transcript has been saved.' })
            ],
            allowedMentions: { users: [user.id] }
        });

        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (err) {
                console.error('[CloseTicket] Error deletion:', err.message);
            }
        }, 15000);
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
