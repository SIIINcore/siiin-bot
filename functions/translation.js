const fs = require('fs');
const path = require('path');
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    EmbedBuilder
} = require('discord.js');
const {
    TRANSLATION_CHANNEL_IDS,
    TRANSLATION_DAILY_LIMIT,
    TRANSLATION_MIN_LENGTH,
    OPENAI_TRANSLATE_MODEL
} = require('../config/constants');

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../data');
const USAGE_FILE = path.join(DATA_DIR, 'translation-usage.json');

const LANGUAGE_OPTIONS = [
    { label: 'Français', value: 'French', emoji: '🇫🇷' },
    { label: 'English', value: 'English', emoji: '🇬🇧' },
    { label: 'Español', value: 'Spanish', emoji: '🇪🇸' },
    { label: 'Italiano', value: 'Italian', emoji: '🇮🇹' },
    { label: 'Deutsch', value: 'German', emoji: '🇩🇪' },
    { label: 'Українська', value: 'Ukrainian', emoji: '🇺🇦' },
    { label: '中文（简体）', value: 'Simplified Chinese', emoji: '🇨🇳' },
    { label: '日本語', value: 'Japanese', emoji: '🇯🇵' },
    { label: 'Русский', value: 'Russian', emoji: '🇷🇺' }
];

function ensureUsageFile() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USAGE_FILE)) {
        fs.writeFileSync(USAGE_FILE, '{}', 'utf8');
    }
}

function readUsage() {
    ensureUsageFile();
    try {
        return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8')) || {};
    } catch {
        return {};
    }
}

function writeUsage(data) {
    ensureUsageFile();
    fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
}

function getUserUsage(userId) {
    const data = readUsage();
    const todayKey = getTodayKey();
    return Number(data[todayKey]?.[userId] || 0);
}

function incrementUserUsage(userId) {
    const data = readUsage();
    const todayKey = getTodayKey();
    if (!data[todayKey]) data[todayKey] = {};
    data[todayKey][userId] = Number(data[todayKey][userId] || 0) + 1;
    writeUsage(data);
    return data[todayKey][userId];
}

function isEligibleChannel(channelId) {
    return TRANSLATION_CHANNEL_IDS.includes(channelId);
}

function isEligibleAuthor(message, client) {
    return !!message.author && !message.author.system;
}

function extractTranslatableText(message) {
    const parts = [];
    if (message.content?.trim()) parts.push(message.content.trim());

    for (const embed of message.embeds || []) {
        if (embed.title) parts.push(embed.title.trim());
        if (embed.description) parts.push(embed.description.trim());
        if (Array.isArray(embed.fields)) {
            for (const field of embed.fields) {
                if (field.name) parts.push(String(field.name).trim());
                if (field.value) parts.push(String(field.value).trim());
            }
        }
        if (embed.footer?.text) parts.push(String(embed.footer.text).trim());
        if (embed.author?.name) parts.push(String(embed.author.name).trim());
    }

    return parts.filter(Boolean).join('\n\n').trim();
}

function isImageOnlyMessage(message) {
    const hasTextContent = Boolean(message.content?.trim());
    const hasEmbeds = Array.isArray(message.embeds) && message.embeds.length > 0;
    const attachments = Array.from(message.attachments?.values?.() || []);
    const hasAttachments = attachments.length > 0;

    if (hasTextContent) return false;
    if (hasEmbeds) return true;
    if (!hasAttachments) return false;

    return attachments.every(att => {
        const contentType = String(att.contentType || '').toLowerCase();
        return contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(att.name || '');
    });
}

function hasOnlyLinks(text) {
    if (!text) return false;
    const normalized = text.trim();
    if (!normalized) return false;
    const parts = normalized.split(/\s+/).filter(Boolean);
    if (!parts.length) return false;
    return parts.every(part => /^(https?:\/\/|www\.)\S+$/i.test(part));
}

function shouldOfferTranslation(message, client) {
    if (!message.guild || !isEligibleChannel(message.channel.id)) return false;
    if (!isEligibleAuthor(message, client)) return false;
    if (message.reference?.messageId) return false;
    if (message.type !== 0) return false;
    if (isImageOnlyMessage(message)) return false;

    const text = extractTranslatableText(message);
    if (!text || hasOnlyLinks(text)) return false;

    return text.length > TRANSLATION_MIN_LENGTH;
}

function buildHelperRow(message) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`translate_open:${message.channel.id}:${message.id}`)
            .setLabel('Translate')
            .setEmoji('🌐')
            .setStyle(ButtonStyle.Secondary)
    );
}

async function attachTranslationHelper(message) {
    try {
        await message.reply({
            content: 'Need a translation? Click below.',
            components: [buildHelperRow(message)],
            allowedMentions: { repliedUser: false }
        });
    } catch (error) {
        console.error('[Translation] Helper attach error:', error.message);
    }
}

function buildLanguageMenu(channelId, messageId) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`translate_select:${channelId}:${messageId}`)
            .setPlaceholder('Choose a language')
            .addOptions(LANGUAGE_OPTIONS.map(option => ({
                label: option.label,
                value: option.value,
                emoji: option.emoji
            })))
    );
}

async function handleTranslateOpen(interaction) {
    const [, channelId, messageId] = interaction.customId.split(':');

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle('🌐 Message translation')
                .setColor(0x66C2FF)
                .setDescription('Choose a language below. The translated message will only be visible to you.')
                .setFooter({ text: `Daily limit: ${TRANSLATION_DAILY_LIMIT} translations` })
        ],
        components: [buildLanguageMenu(channelId, messageId)],
        ephemeral: true
    });
}

async function requestTranslation(text, targetLanguage) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is missing.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: OPENAI_TRANSLATE_MODEL,
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content: 'You are a translation assistant for a Discord bot. Translate the provided message accurately into the target language. Keep formatting, line breaks, links, emoji, and tone. Do not add notes or commentary. Output only the translation.'
                },
                {
                    role: 'user',
                    content: `Target language: ${targetLanguage}\n\nMessage to translate:\n${text}`
                }
            ]
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || `OpenAI request failed with status ${response.status}`);
    }

    return data?.choices?.[0]?.message?.content?.trim() || null;
}

async function handleTranslateSelect(interaction) {
    const [, channelId, messageId] = interaction.customId.split(':');
    const targetLanguage = interaction.values?.[0];

    if (!targetLanguage) {
        return interaction.update({
            content: '❌ No language selected.',
            components: [],
            embeds: [],
            ephemeral: true
        });
    }

    const usedToday = getUserUsage(interaction.user.id);
    if (usedToday >= TRANSLATION_DAILY_LIMIT) {
        return interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🌐 Daily limit reached')
                    .setColor(0xFFAA00)
                    .setDescription('You have reached your daily translation limit. Please try again tomorrow.')
                    .setFooter({ text: `Limit: ${TRANSLATION_DAILY_LIMIT} per day` })
            ],
            components: [],
            ephemeral: true
        });
    }

    await interaction.update({
        embeds: [
            new EmbedBuilder()
                .setTitle('🌐 Translating...')
                .setColor(0x66C2FF)
                .setDescription(`Please wait while I translate this message to ${targetLanguage}.`)
        ],
        components: [],
        ephemeral: true
    });

    try {
        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased()) throw new Error('Source channel not found.');

        const sourceMessage = await channel.messages.fetch(messageId).catch(() => null);
        if (!sourceMessage) throw new Error('Source message not found.');

        const sourceText = extractTranslatableText(sourceMessage);
        if (!sourceText || sourceText.length <= TRANSLATION_MIN_LENGTH) {
            throw new Error('This message is too short to translate.');
        }

        const translatedText = await requestTranslation(sourceText, targetLanguage);
        if (!translatedText) throw new Error('Empty translation received.');

        incrementUserUsage(interaction.user.id);

        const originalUrl = sourceMessage.url;
        const authorName = sourceMessage.member?.displayName || sourceMessage.author.globalName || sourceMessage.author.username;

        return interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`🌐 Translation • ${targetLanguage}`)
                    .setColor(0x66C2FF)
                    .setDescription(translatedText.slice(0, 4096))
                    .addFields(
                        { name: 'Original author', value: authorName || sourceMessage.author.tag, inline: true },
                        { name: 'Used today', value: `${getUserUsage(interaction.user.id)}/${TRANSLATION_DAILY_LIMIT}`, inline: true },
                        { name: 'Source message', value: `[Jump to message](${originalUrl})`, inline: false }
                    )
                    .setFooter({ text: `Model: ${OPENAI_TRANSLATE_MODEL}` })
                    .setTimestamp()
            ],
            ephemeral: true
        });
    } catch (error) {
        console.error('[Translation] Translate error:', error.message);
        return interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle('❌ Translation error')
                    .setColor(0xFF4D4D)
                    .setDescription(error.message || 'An unexpected error occurred while translating this message.')
            ],
            ephemeral: true
        });
    }
}

async function handleTranslationInteraction(interaction) {
    if (interaction.isButton() && interaction.customId.startsWith('translate_open:')) {
        await handleTranslateOpen(interaction);
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('translate_select:')) {
        await handleTranslateSelect(interaction);
        return true;
    }

    return false;
}

module.exports = {
    shouldOfferTranslation,
    attachTranslationHelper,
    handleTranslationInteraction,
    extractTranslatableText
};
