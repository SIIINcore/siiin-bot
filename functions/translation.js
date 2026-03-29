const fs = require('fs');
const path = require('path');
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder
} = require('discord.js');

const {
    STAFF_IDS,
    TRANSLATION_CHANNEL_IDS,
    TRANSLATION_DAILY_LIMIT,
    BOT_ID
} = require('../config/constants');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USAGE_FILE = path.join(DATA_DIR, 'translation-usage.json');
const HELPER_EMOJI = '🌐';
const HELPER_MARKER = 'SIIIN Translation Helper';
const LANGUAGE_OPTIONS = [
    { label: 'Français', value: 'French', description: 'Translate to French', emoji: '🇫🇷' },
    { label: 'English', value: 'English', description: 'Translate to English', emoji: '🇬🇧' },
    { label: 'Español', value: 'Spanish', description: 'Translate to Spanish', emoji: '🇪🇸' },
    { label: 'Italiano', value: 'Italian', description: 'Translate to Italian', emoji: '🇮🇹' },
    { label: 'Deutsch', value: 'German', description: 'Translate to German', emoji: '🇩🇪' },
    { label: 'Українська', value: 'Ukrainian', description: 'Translate to Ukrainian', emoji: '🇺🇦' },
    { label: '中文（简体）', value: 'Simplified Chinese', description: 'Translate to Simplified Chinese', emoji: '🇨🇳' },
    { label: '日本語', value: 'Japanese', description: 'Translate to Japanese', emoji: '🇯🇵' },
    { label: 'Русский', value: 'Russian', description: 'Translate to Russian', emoji: '🇷🇺' }
];

function ensureUsageFile() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USAGE_FILE)) {
        fs.writeFileSync(USAGE_FILE, JSON.stringify({}, null, 2), 'utf8');
    }
}

function loadUsage() {
    try {
        ensureUsageFile();
        return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    } catch (err) {
        console.error('[Translation] Failed to load usage:', err.message);
        return {};
    }
}

function saveUsage(payload) {
    try {
        ensureUsageFile();
        fs.writeFileSync(USAGE_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
        console.error('[Translation] Failed to save usage:', err.message);
    }
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function pruneUsage(payload) {
    const keys = Object.keys(payload).sort();
    while (keys.length > 7) {
        const oldest = keys.shift();
        delete payload[oldest];
    }
    return payload;
}

function consumeTranslationQuota(userId) {
    const payload = pruneUsage(loadUsage());
    const day = todayKey();
    payload[day] = payload[day] || {};
    const current = Number(payload[day][userId] || 0);

    if (current >= TRANSLATION_DAILY_LIMIT) {
        return { allowed: false, remaining: 0, used: current };
    }

    payload[day][userId] = current + 1;
    saveUsage(payload);
    return {
        allowed: true,
        remaining: Math.max(0, TRANSLATION_DAILY_LIMIT - (current + 1)),
        used: current + 1
    };
}

function isTranslationChannel(channelId) {
    return TRANSLATION_CHANNEL_IDS.includes(channelId);
}

function isEligibleSourceMessage(message, client) {
    if (!message || !message.guild) return false;
    if (!isTranslationChannel(message.channelId)) return false;
    if (message.author.id === client.user.id) {
        if (message.components?.length) return false;
        if (message.embeds?.some(embed => embed.footer?.text === HELPER_MARKER)) return false;
        return true;
    }
    return STAFF_IDS.includes(message.author.id);
}

function buildTranslateComponents(targetMessageId) {
    const button = new ButtonBuilder()
        .setCustomId(`translate_open:${targetMessageId}`)
        .setLabel('Translate this message')
        .setEmoji(HELPER_EMOJI)
        .setStyle(ButtonStyle.Secondary);

    return [new ActionRowBuilder().addComponents(button)];
}

async function sendTranslationHelper(message) {
    const embed = new EmbedBuilder()
        .setColor(0x66C2FF)
        .setDescription(`${HELPER_EMOJI} **Need a translation?** Use the button below to open a private language menu for this message.`)
        .setFooter({ text: HELPER_MARKER });

    await message.channel.send({
        embeds: [embed],
        components: buildTranslateComponents(message.id),
        reply: { messageReference: message.id, failIfNotExists: false },
        allowedMentions: { repliedUser: false }
    });
}

async function ensureTranslationHelperForMessage(message, client) {
    try {
        if (!isEligibleSourceMessage(message, client)) return;

        const recent = await message.channel.messages.fetch({ limit: 25 }).catch(() => null);
        if (recent) {
            const hasHelper = recent.some(msg =>
                msg.author.id === client.user.id &&
                msg.reference?.messageId === message.id &&
                msg.components?.some(row => row.components?.some(component => component.customId === `translate_open:${message.id}`))
            );
            if (hasHelper) return;
        }

        await sendTranslationHelper(message);
    } catch (err) {
        console.error('[Translation] Failed to ensure helper:', err.message);
    }
}

async function ensureHelpersForChannel(channel, client, limit = 12) {
    try {
        if (!channel || !isTranslationChannel(channel.id)) return;
        const messages = await channel.messages.fetch({ limit }).catch(() => null);
        if (!messages) return;

        const sorted = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        for (const message of sorted) {
            if (isEligibleSourceMessage(message, client)) {
                await ensureTranslationHelperForMessage(message, client);
            }
        }
    } catch (err) {
        console.error('[Translation] Failed to scan channel:', err.message);
    }
}

function extractEmbedText(embed) {
    const parts = [];
    if (embed.title) parts.push(`Title: ${embed.title}`);
    if (embed.description) parts.push(embed.description);
    if (Array.isArray(embed.fields)) {
        for (const field of embed.fields) {
            parts.push(`${field.name}: ${field.value}`);
        }
    }
    if (embed.footer?.text) parts.push(`Footer: ${embed.footer.text}`);
    return parts.join('\n');
}

function extractMessageText(message) {
    const parts = [];
    if (message.content?.trim()) parts.push(message.content.trim());
    for (const embed of message.embeds || []) {
        const text = extractEmbedText(embed);
        if (text.trim()) parts.push(text.trim());
    }
    return parts.join('\n\n').trim();
}

function truncateForApi(text, maxLength = 3500) {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 24)}\n\n[Content truncated for translation]`;
}

async function fetchTargetMessage(interaction, messageId) {
    try {
        return await interaction.channel.messages.fetch(messageId);
    } catch {
        return null;
    }
}

function buildLanguageMenu(targetMessageId) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`translate_lang:${targetMessageId}`)
        .setPlaceholder('Choose a language')
        .addOptions(LANGUAGE_OPTIONS);

    return [new ActionRowBuilder().addComponents(menu)];
}

async function handleTranslateOpen(interaction, targetMessageId) {
    const targetMessage = await fetchTargetMessage(interaction, targetMessageId);
    if (!targetMessage) {
        return interaction.reply({ content: '❌ I could not find the original message anymore.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setColor(0x66C2FF)
        .setTitle('🌐 Translation menu')
        .setDescription('Choose a language below. The translation will only be visible to you.')
        .addFields({ name: 'Message', value: `[Open original message](${targetMessage.url})` });

    if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [embed], components: buildLanguageMenu(targetMessageId), ephemeral: true });
    }

    return interaction.reply({ embeds: [embed], components: buildLanguageMenu(targetMessageId), ephemeral: true });
}

async function requestOpenAITranslation(text, language) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is missing.');
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: process.env.OPENAI_TRANSLATE_MODEL || 'gpt-4o-mini',
            input: [
                {
                    role: 'system',
                    content: [
                        {
                            type: 'input_text',
                            text: 'You translate Discord messages accurately. Keep mentions, channel links, URLs, emojis, markdown, line breaks, and formatting intact whenever possible. Do not add explanations. Return only the translation in the target language.'
                        }
                    ]
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: `Target language: ${language}\n\nTranslate this message:\n\n${truncateForApi(text)}`
                        }
                    ]
                }
            ],
            max_output_tokens: 1200
        })
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown API error');
        throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const textOutput = data.output_text || '';
    if (!textOutput.trim()) {
        throw new Error('Empty translation response.');
    }
    return textOutput.trim();
}

async function handleTranslateLanguage(interaction, targetMessageId) {
    const language = interaction.values?.[0];
    const targetMessage = await fetchTargetMessage(interaction, targetMessageId);

    if (!language) {
        return interaction.update({ content: '❌ No language selected.', embeds: [], components: [] });
    }

    if (!targetMessage) {
        return interaction.update({ content: '❌ I could not find the original message anymore.', embeds: [], components: [] });
    }

    const originalText = extractMessageText(targetMessage);
    if (!originalText) {
        return interaction.update({ content: '❌ This message has no translatable text.', embeds: [], components: [] });
    }

    const quota = consumeTranslationQuota(interaction.user.id);
    if (!quota.allowed) {
        return interaction.update({
            content: `❌ You have reached your daily translation limit (${TRANSLATION_DAILY_LIMIT}/${TRANSLATION_DAILY_LIMIT}). Please try again tomorrow.`,
            embeds: [],
            components: []
        });
    }

    await interaction.update({ content: '⏳ Translating your message...', embeds: [], components: [] });

    try {
        const translatedText = await requestOpenAITranslation(originalText, language);
        const resultEmbed = new EmbedBuilder()
            .setColor(0x66C2FF)
            .setTitle(`🌐 Translation • ${language}`)
            .setDescription(translatedText.slice(0, 4096))
            .addFields(
                { name: 'Original message', value: `[Open original message](${targetMessage.url})`, inline: false },
                { name: 'Daily usage', value: `${quota.used}/${TRANSLATION_DAILY_LIMIT} used`, inline: true },
                { name: 'Remaining today', value: `${quota.remaining}`, inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.username}` })
            .setTimestamp();

        await interaction.followUp({ embeds: [resultEmbed], ephemeral: true });
    } catch (err) {
        console.error('[Translation] API error:', err.message);
        await interaction.followUp({
            content: '❌ Translation failed. Please try again later.',
            ephemeral: true
        });
    }
}

async function handleTranslationInteraction(interaction, client) {
    if (interaction.isButton() && interaction.customId.startsWith('translate_open:')) {
        const [, messageId] = interaction.customId.split(':');
        await handleTranslateOpen(interaction, messageId);
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('translate_lang:')) {
        const [, messageId] = interaction.customId.split(':');
        await handleTranslateLanguage(interaction, messageId);
        return true;
    }

    return false;
}

module.exports = {
    ensureTranslationHelperForMessage,
    ensureHelpersForChannel,
    handleTranslationInteraction,
    isTranslationChannel
};
