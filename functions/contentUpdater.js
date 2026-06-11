const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const {
    CHANNEL_FREEGAMES,
    CHANNEL_PROMOS,
    CHANNEL_FREETOPLAY,
    CHANNEL_MOBILE,
    STATS_CHANNEL_ID
} = require('../config/constants');
const { fetchAllFreeGames, fetchFreeToPlayGames } = require('./api/freeGames');
const { fetchAllPromos } = require('./api/promos');
const { fetchAllMobileTopApps } = require('./api/mobileTop');
const { delay, truncateText } = require('../utils/helpers');

const STATE_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(STATE_DIR, 'posted-content.json');
const MAX_SAVED_IDS = 2000;

function ensureStateFile() {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    if (!fs.existsSync(STATE_FILE)) {
        fs.writeFileSync(STATE_FILE, JSON.stringify({ postedGames: [], postedPromos: [], postedFreeToPlay: [], postedMobile: [] }, null, 2), 'utf8');
    }
}

function loadState() {
    try {
        ensureStateFile();
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            postedGames: new Set(parsed.postedGames || []),
            postedPromos: new Set(parsed.postedPromos || []),
            postedFreeToPlay: new Set(parsed.postedFreeToPlay || []),
            postedMobile: new Set(parsed.postedMobile || [])
        };
    } catch (err) {
        console.error('[ContentState] Failed to load state:', err.message);
        return { postedGames: new Set(), postedPromos: new Set(), postedFreeToPlay: new Set(), postedMobile: new Set() };
    }
}

function saveState(postedGames, postedPromos, postedFreeToPlay, postedMobile) {
    try {
        ensureStateFile();
        const payload = {
            postedGames: Array.from(postedGames).slice(-MAX_SAVED_IDS),
            postedPromos: Array.from(postedPromos).slice(-MAX_SAVED_IDS),
            postedFreeToPlay: Array.from(postedFreeToPlay).slice(-MAX_SAVED_IDS),
            postedMobile: Array.from(postedMobile).slice(-MAX_SAVED_IDS)
        };
        fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
        console.error('[ContentState] Failed to save state:', err.message);
    }
}

const state = loadState();
let postedGames = state.postedGames;
let postedPromos = state.postedPromos;
let postedFreeToPlay = state.postedFreeToPlay;
let postedMobile = state.postedMobile;

// ==================== STATS EMBED ====================
function buildMonoBar(percent = 0.8, total = 20) {
    const filled = Math.max(0, Math.min(total, Math.round(total * percent)));
    const empty = Math.max(0, total - filled);
    return `▬`.repeat(filled) + `▭`.repeat(empty);
}

function buildClassProgress(count) {
    if (count <= 0) return '▭';
    return '▬'.repeat(Math.min(10, Math.ceil(count / 10)));
}

async function updateStatsEmbed(guild, client, freeGamesSet, promosSet, freeToPlaySet, mobileSet) {
    try {
        const channel = await guild.channels.fetch(STATS_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        await guild.members.fetch();
        const totalMembers = guild.memberCount;
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        const embed = new EmbedBuilder()
            .setTitle('📊 **S E R V E R      S T A T S**')
            .setColor('#66C2FF')
            .setDescription(
                `${buildMonoBar(0.8)}\n\n` +
                `👥 **Total members:** ${totalMembers}\n` +
                `🧑 **People:** ${humanCount}\n` +
                `🤖 **Apps:** ${botCount}`
            )
            .addFields({
                name: 'Content tracking',
                value:
                    `🎮 **Free games** — ${freeGamesSet.size} posted\n${buildClassProgress(freeGamesSet.size)}\n` +
                    `🏪 **Promotions** — ${promosSet.size} posted\n${buildClassProgress(promosSet.size)}\n` +
                    `🆓 **Free-to-play** — ${freeToPlaySet.size} posted\n${buildClassProgress(freeToPlaySet.size)}\n` +
                    `📱 **Mobile** — ${mobileSet.size} posted\n${buildClassProgress(mobileSet.size)}`,
                inline: false
            })
            .setFooter({ text: 'SIIIN Stats • Automatic update' })
            .setTimestamp();

        const messages = await channel.messages.fetch({ limit: 5 });
        const botMessages = messages.filter(m => m.author.id === client.user.id);

        if (botMessages.size > 0) {
            await botMessages.first().edit({ embeds: [embed] });
        } else {
            await channel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('[Stats] Error:', err.message);
    }
}

// ==================== CHAT REMINDER ====================
async function updateChatReminder(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 10 });
        const botMessages = messages.filter(m => m.author.id === channel.client.user.id);

        if (botMessages.size > 0) {
            await botMessages.first().delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setTitle('# Welcome to SIIIN P&+ Discord')
            .setDescription(
`▪ You are in the dedicated chat channel, help is welcome here, but this is not the support channel.\n\n# Rules reminder:\n▪ No insults\n▪ No links [Except YouTube]\n▪ No spam\n▪ This discord is not made for support.\n▪ For any support request: create a ticket in <#1468090646442279206>\n\nPlease respect the rules for the happiness of Discord users.`
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'SIIIN Community • Be respectful' });

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[ChatReminder] Error:', err.message);
    }
}

// ==================== POSTING FUNCTIONS ====================
async function postFreeGames(channel) { /* ... keep original or improved logic ... */ }
async function postPromos(channel) { /* ... */ }
async function postFreeToPlayGames(channel) { /* ... */ }
async function postMobileApps(channel) { /* ... */ }

async function updateAll(client) {
    console.log('📡 Updating free games and promotions...');
    try {
        const freeChannel = await client.channels.fetch(CHANNEL_FREEGAMES).catch(() => null);
        const promoChannel = await client.channels.fetch(CHANNEL_PROMOS).catch(() => null);
        const freeToPlayChannel = await client.channels.fetch(CHANNEL_FREETOPLAY).catch(() => null);
        const mobileChannel = await client.channels.fetch(CHANNEL_MOBILE).catch(() => null);

        if (freeChannel) await postFreeGames(freeChannel);
        if (promoChannel) await postPromos(promoChannel);
        if (freeToPlayChannel) await postFreeToPlayGames(freeToPlayChannel);
        if (mobileChannel) await postMobileApps(mobileChannel);

        console.log('✅ Update completed.');
    } catch (err) {
        console.error('[UpdateAll] Error:', err.message);
    }
}

async function softRestart(client) {
    console.log('🔄 Soft restart...');
    await updateAll(client);
}

module.exports = {
    updateAll,
    softRestart,
    updateStatsEmbed,
    updateChatReminder,
    postedGames,
    postedPromos,
    postedFreeToPlay,
    postedMobile
};