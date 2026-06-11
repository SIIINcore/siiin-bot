const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { CHANNEL_FREEGAMES, CHANNEL_PROMOS, CHANNEL_FREETOPLAY, CHANNEL_MOBILE, STATS_CHANNEL_ID } = require('../config/constants');
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
    } catch (e) { console.error('[SaveState] Error', e.message); }
}

const state = loadState();
let postedGames = state.postedGames;
let postedPromos = state.postedPromos;
let postedFreeToPlay = state.postedFreeToPlay;
let postedMobile = state.postedMobile;

// Brand helper
function getBrand(store) {
    const brands = {
        steam: { name: 'Steam', icon: 'https://store.steampowered.com/favicon.ico' },
        'cheapshark-steam': { name: 'Steam (CheapShark)', icon: 'https://store.steampowered.com/favicon.ico' },
        'cs-gog': { name: 'GOG', icon: 'https://www.gog.com/favicon.ico' },
        'cs-ea': { name: 'EA', icon: 'https://www.ea.com/favicon.ico' },
        'cs-ubisoft': { name: 'Ubisoft', icon: 'https://store.ubisoft.com/favicon.ico' },
        epic: { name: 'Epic Games', icon: 'https://store.epicgames.com/favicon.ico' },
    };
    return brands[store] || { name: store, icon: 'https://discord.com/assets/2c21aeda16de354ba5334551a883b481.png' };
}

// ==================== POST PROMOS ====================
async function postPromos(channel) {
    const promos = await fetchAllPromos();
    let count = 0;

    for (const p of promos) {
        if (postedPromos.has(p.id)) continue;

        const brand = getBrand(p.store);
        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${p.title}`)
            .setURL(p.url)
            .setColor(p.discountPercent >= 70 ? 0xFF0000 : p.discountPercent >= 50 ? 0xFF9900 : 0x00FF99)
            .setAuthor({ name: brand.name, iconURL: brand.icon })
            .setThumbnail(brand.icon)
            .addFields(
                { name: 'Original Price', value: `$${p.originalPriceUSD} / €${p.originalPriceEUR}`, inline: true },
                { name: 'Sale Price', value: `$${p.priceUSD} / €${p.priceEUR}`, inline: true },
                { name: 'Discount', value: `**${p.discountPercent}% OFF**`, inline: true }
            )
            .setFooter({ text: `${brand.name} • Limited time offer` })
            .setTimestamp();

        if (p.image) embed.setImage(p.image);

        await channel.send({ embeds: [embed] });
        postedPromos.add(p.id);
        count++;
        saveState(postedGames, postedPromos, postedFreeToPlay, postedMobile);
        await delay(700);
    }
    console.log(count > 0 ? `✅ ${count} new promotions posted` : 'ℹ️ No new promotions');
}

// ==================== POST FREE GAMES ====================
async function postFreeGames(channel) {
    const games = await fetchAllFreeGames();
    let count = 0;

    for (const g of games) {
        if (postedGames.has(g.id)) continue;

        const brand = getBrand(g.store);
        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${g.title}`)
            .setURL(g.url)
            .setColor(0x00AAFF)
            .setAuthor({ name: brand.name, iconURL: brand.icon })
            .setThumbnail(brand.icon)
            .addFields(
                { name: 'Status', value: '**FREE**', inline: true },
                { name: 'Original Price', value: `$${g.originalPriceUSD || 'N/A'} / €${g.originalPriceEUR || 'N/A'}`, inline: true }
            )
            .setFooter({ text: `${brand.name} • Free offer` })
            .setTimestamp();

        if (g.image) embed.setImage(g.image);
        if (g.endDate) embed.addFields({ name: 'Ends', value: g.endDate, inline: false });

        await channel.send({ embeds: [embed] });
        postedGames.add(g.id);
        count++;
        saveState(postedGames, postedPromos, postedFreeToPlay, postedMobile);
        await delay(700);
    }
    console.log(count > 0 ? `✅ ${count} new free games posted` : 'ℹ️ No new free games');
}

async function updateAll(client) {
    console.log('📡 Updating content...');
    const [freeCh, promoCh] = await Promise.all([
        client.channels.fetch(CHANNEL_FREEGAMES).catch(() => null),
        client.channels.fetch(CHANNEL_PROMOS).catch(() => null)
    ]);

    if (freeCh) await postFreeGames(freeCh);
    if (promoCh) await postPromos(promoCh);

    console.log('✅ Update done.');
}

module.exports = {
    updateAll,
    postedGames,
    postedPromos,
    postedFreeToPlay,
    postedMobile
};