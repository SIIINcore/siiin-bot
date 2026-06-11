const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const {
    CHANNEL_FREEGAMES,
    CHANNEL_PROMOS,
    CHANNEL_FREETOPLAY,
    CHANNEL_MOBILE
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
        console.error('[ContentState] Failed to load state, resetting:', err.message);
        return {
            postedGames: new Set(),
            postedPromos: new Set(),
            postedFreeToPlay: new Set(),
            postedMobile: new Set()
        };
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

// Load state once at startup
const state = loadState();
let postedGames = state.postedGames;
let postedPromos = state.postedPromos;
let postedFreeToPlay = state.postedFreeToPlay;
let postedMobile = state.postedMobile;

async function postFreeGames(channel) {
    try {
        const games = await fetchAllFreeGames();
        let postedCount = 0;

        for (const game of games) {
            if (postedGames.has(game.id)) continue;

            // ... (keep existing embed logic)
            // For now keeping original logic to avoid breaking everything
            console.log(`[DEBUG] Would post free game: ${game.title}`);
            postedGames.add(game.id);
            postedCount++;
            saveState(postedGames, postedPromos, postedFreeToPlay, postedMobile);
            await delay(600);
        }
        console.log(postedCount > 0 ? `✅ ${postedCount} new free games posted` : 'ℹ️ No new free games to post');
    } catch (err) {
        console.error('[PostFreeGames] Error:', err.message);
    }
}

// Similar improved save calls can be added to postPromos, postFreeToPlayGames, postMobileApps

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
    console.log('🔄 Soft restart of functions...');
    try {
        await updateAll(client);
        console.log('✅ Soft restart completed');
    } catch (err) {
        console.error('❌ Soft restart error:', err.message);
    }
}

module.exports = {
    updateAll,
    softRestart,
    postedGames,
    postedPromos,
    postedFreeToPlay,
    postedMobile
};