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

// Salon pour les jeux +18
const ADULT_CHANNEL_ID = '1518289861847683264';

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
        steam:          { name: 'Steam',          icon: 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/steamworks_logo.png' },
        'cheapshark-steam': { name: 'Steam',      icon: 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/steamworks_logo.png' },
        'cs-gog':       { name: 'GOG',            icon: 'https://www.gog.com/favicon.ico' },
        'cs-ea':        { name: 'EA',             icon: 'https://www.ea.com/favicon.ico' },
        'cs-ubisoft':   { name: 'Ubisoft',        icon: 'https://store.ubisoft.com/favicon.ico' },
        epic:           { name: 'Epic Games',     icon: 'https://store.epicgames.com/favicon.ico' },
        'cs-epic':      { name: 'Epic Games',     icon: 'https://store.epicgames.com/favicon.ico' }
    };
    return map[store] || { name: store, icon: 'https://discord.com/assets/2c21aeda16de354ba5334551a883b481.png' };
}

// ==================== FREE GAMES ====================
async function postFreeGames(channel) {
    const games = await fetchAllFreeGames();
    let count = 0;

    for (const g of games) {
        if (postedGames.has(g.id)) continue;

        const brand = getBrand(g.store);
        const isAdult = g.isAdult || false; // On peut améliorer ça plus tard

        const targetChannel = isAdult 
            ? await channel.client.channels.fetch(ADULT_CHANNEL_ID).catch(() => channel)
            : channel;

        const showOriginal = g.originalPriceUSD && parseFloat(g.originalPriceUSD) > 0;

        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${g.title}`)
            .setURL(g.url)
            .setColor(isAdult ? 0xFF00FF : 0x00AAFF)
            .setAuthor({ name: brand.name, iconURL: brand.icon })
            .setThumbnail(brand.icon)
            .addFields({ name: 'Status', value: isAdult ? '**+18 FREE**' : '**FREE**', inline: true });

        if (showOriginal) {
            embed.addFields({ name: 'Was', value: `$${g.originalPriceUSD} / €${g.originalPriceEUR}`, inline: true });
        }

        if (g.endDate) {
            embed.addFields({ name: 'Ends', value: g.endDate, inline: false });
        }

        if (g.image) embed.setImage(g.image);
        embed.setFooter({ text: brand.name + (isAdult ? ' • +18' : '') });

        await targetChannel.send({ embeds: [embed] });
        postedGames.add(g.id);
        count++;
        saveState(postedGames, postedPromos, postedFreeToPlay, postedMobile);
        await delay(650);
    }

    if (count) console.log(`✅ ${count} temporary free games posted`);
}

// ==================== PROMOTIONS ====================
async function postPromos(channel) {
    const promos = await fetchAllPromos();
    let count = 0;

    for (const p of promos) {
        if (postedPromos.has(p.id)) continue;

        const brand = getBrand(p.store);
        const isAdult = p.isAdult || false;

        const targetChannel = isAdult 
            ? await channel.client.channels.fetch(ADULT_CHANNEL_ID).catch(() => channel)
            : channel;

        const embed = new EmbedBuilder()
            .setTitle(`🏷️ ${p.title}`)
            .setURL(p.url)
            .setColor(isAdult ? 0xFF00FF : (p.discountPercent >= 70 ? 0xFF0000 : 0xFF9900))
            .setAuthor({ name: brand.name, iconURL: brand.icon })
            .setThumbnail(brand.icon)
            .addFields(
                { name: 'Original Price', value: `$${p.originalPriceUSD} / €${p.originalPriceEUR}`, inline: true },
                { name: 'Sale Price',     value: `$${p.priceUSD} / €${p.priceEUR}`, inline: true },
                { name: 'Discount',       value: `**${p.discountPercent}% OFF**`, inline: true }
            )
            .setFooter({ text: brand.name + (isAdult ? ' • +18' : '') });

        if (p.image) embed.setImage(p.image);

        await targetChannel.send({ embeds: [embed] });
        postedPromos.add(p.id);
        count++;
        saveState(postedGames, postedPromos, postedFreeToPlay, postedMobile);
        await delay(650);
    }

    if (count) console.log(`✅ ${count} promotions posted`);
}

// ==================== FREE TO PLAY ====================
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
            )
            .setFooter({ text: 'Free to Play • Always available' });

        if (g.image) embed.setImage(g.image);

        await channel.send({ embeds: [embed] });
        postedFreeToPlay.add(g.id);
        count++;
        saveState(postedGames, postedPromos, postedFreeToPlay, postedMobile);
        await delay(650);
    }

    if (count) console.log(`✅ ${count} free-to-play games posted`);
}

// ==================== MOBILE ====================
async function postMobileApps(channel) {
    const apps = await fetchAllMobileTopApps();
    let count = 0;

    for (const app of apps) {
        if (postedMobile.has(app.id)) continue;

        const color = app.platform === 'Apple' ? '#f5f5f7' : '#66c2ff';
        const emoji = app.platform === 'Apple' ? '🍎' : '🤖';
        const brand = getBrand(app.sourceLabel || app.platform);

        const embed = new EmbedBuilder()
            .setTitle(`${emoji} ${app.title}`)
            .setURL(app.url)
            .setColor(color)
            .setAuthor({ name: brand.name, iconURL: brand.icon })
            .addFields(
                { name: 'Platform', value: app.sourceLabel || app.platform, inline: true },
                { name: 'Rank', value: `#${app.rank}`, inline: true },
                { name: 'Developer', value: app.developer || 'Unknown', inline: true }
            )
            .setFooter({ text: app.footerSource || 'Top Free' });

        if (app.image) embed.setThumbnail(app.image);

        await channel.send({ embeds: [embed] });
        postedMobile.add(app.id);
        count++;
        saveState(postedGames, postedPromos, postedFreeToPlay, postedMobile);
        await delay(650);
    }

    if (count) console.log(`✅ ${count} mobile apps posted`);
}

async function updateAll(client) {
    console.log('📡 Updating content...');

    const freeCh = await client.channels.fetch(CHANNEL_FREEGAMES).catch(() => null);
    const promoCh = await client.channels.fetch(CHANNEL_PROMOS).catch(() => null);
    const f2pCh = await client.channels.fetch(CHANNEL_FREETOPLAY).catch(() => null);
    const mobileCh = await client.channels.fetch(CHANNEL_MOBILE).catch(() => null);

    if (freeCh) await postFreeGames(freeCh);
    if (promoCh) await postPromos(promoCh);
    if (f2pCh) await postFreeToPlayGames(f2pCh);
    if (mobileCh) await postMobileApps(mobileCh);

    console.log('✅ Update completed.');
}

async function softRestart(client) {
    console.log('🔄 Soft restart...');
    await updateAll(client);
}

module.exports = {
    updateAll,
    softRestart,
    postedGames,
    postedPromos,
    postedFreeToPlay,
    postedMobile
};
