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
const { delay } = require('../utils/helpers');

const STATE_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(STATE_DIR, 'posted-content.json');
const MAX_SAVED_IDS = 2000;

function ensureStateFile() {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    if (!fs.existsSync(STATE_FILE)) {
        fs.writeFileSync(STATE_FILE, JSON.stringify({ postedGames: [], postedPromos: [], postedFreeToPlay: [], postedMobile: [] }, null, 2));
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
    } catch {
        return { postedGames: new Set(), postedPromos: new Set(), postedFreeToPlay: new Set(), postedMobile: new Set() };
    }
}

function saveState(games, promos, f2p, mobile) {
    try {
        ensureStateFile();
        fs.writeFileSync(STATE_FILE, JSON.stringify({
            postedGames: Array.from(games).slice(-MAX_SAVED_IDS),
            postedPromos: Array.from(promos).slice(-MAX_SAVED_IDS),
            postedFreeToPlay: Array.from(f2p).slice(-MAX_SAVED_IDS),
            postedMobile: Array.from(mobile).slice(-MAX_SAVED_IDS)
        }, null, 2));
    } catch (e) {}
}

const state = loadState();
let postedGames = state.postedGames;
let postedPromos = state.postedPromos;
let postedFreeToPlay = state.postedFreeToPlay;
let postedMobile = state.postedMobile;

function getBrand(store) {
    const map = {
        steam: { name: 'Steam', icon: 'https://store.steampowered.com/favicon.ico' },
        'cheapshark-steam': { name: 'Steam', icon: 'https://store.steampowered.com/favicon.ico' },
        'cs-gog': { name: 'GOG', icon: 'https://www.gog.com/favicon.ico' },
        'cs-ea': { name: 'EA', icon: 'https://www.ea.com/favicon.ico' },
        'cs-ubisoft': { name: 'Ubisoft', icon: 'https://store.ubisoft.com/favicon.ico' },
        epic: { name: 'Epic Games', icon: 'https://store.epicgames.com/favicon.ico' }
    };
    return map[store] || { name: store, icon: 'https://discord.com/assets/2c21aeda16de354ba5334551a883b481.png' };
}

// ==================== FREE GAMES (TEMPORARY) ====================
async function postFreeGames(channel) {
    const games = await fetchAllFreeGames();
    let count = 0;

    for (const g of games) {
        if (postedGames.has(g.id)) continue;

        // Only show original price if it was actually paid before
        const showOriginalPrice = g.originalPriceUSD && parseFloat(g.originalPriceUSD) > 0;

        const brand = getBrand(g.store);
        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${g.title}`)
            .setURL(g.url)
            .setColor(0x00AAFF)
            .setAuthor({ name: brand.name, iconURL: brand.icon });

        if (g.image) embed.setImage(g.image);

        embed.addFields({ name: 'Status', value: '**FREE**', inline: true });

        if (showOriginalPrice) {
            embed.addFields({ name: 'Was', value: `$${g.originalPriceUSD} / €${g.originalPriceEUR}`, inline: true });
        }

        if (g.endDate) {
            embed.addFields({ name: 'Ends', value: g.endDate, inline: false });
        }

        embed.setFooter({ text: brand.name });

        await channel.send({ embeds: [embed] });
        postedGames.add(g.id);
        count++;
        saveState(postedGames, postedPromos, postedFreeToPlay, postedMobile);
        await delay(650);
    }

    if (count) console.log(`✅ ${count} temporary free games posted`);
}

// ==================== FREE TO PLAY (PERMANENT) ====================
async function postFreeToPlayGames(channel) {
    const games = await fetchFreeToPlayGames();
    let count = 0;

    for (const g of games) {
        if (postedFreeToPlay.has(g.id)) continue;

        const brand = getBrand(g.store || 'steam');
        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${g.title}`)
            .setURL(g.url)
            .setColor(0x7289DA)
            .setAuthor({ name: brand.name, iconURL: brand.icon })
            .addFields(
                { name: 'Status', value: '**FREE TO PLAY**', inline: true },
                { name: 'Platform', value: g.platform || 'Steam', inline: true }
            );

        if (g.image) embed.setImage(g.image);

        embed.setFooter({ text: 'Free to Play • Always available' });

        await channel.send({ embeds: [embed] });
        postedFreeToPlay.add(g.id);
        count++;
        saveState(postedGames, postedPromos, postedFreeToPlay, postedMobile);
        await delay(650);
    }

    if (count) console.log(`✅ ${count} free-to-play games posted`);
}

async function updateAll(client) {
    const freeCh = await client.channels.fetch(CHANNEL_FREEGAMES).catch(() => null);
    const promoCh = await client.channels.fetch(CHANNEL_PROMOS).catch(() => null);
    const f2pCh = await client.channels.fetch(CHANNEL_FREETOPLAY).catch(() => null);

    if (freeCh) await postFreeGames(freeCh);
    if (promoCh) await postPromos(promoCh);
    if (f2pCh) await postFreeToPlayGames(f2pCh);
}

module.exports = {
    updateAll,
    postedGames,
    postedPromos,
    postedFreeToPlay,
    postedMobile
};