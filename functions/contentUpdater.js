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

function defaultStatePayload() {
    return {
        postedGames: [],
        postedPromos: [],
        postedFreeToPlay: [],
        postedMobile: []
    };
}

function ensureStateFile() {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    if (!fs.existsSync(STATE_FILE)) {
        fs.writeFileSync(STATE_FILE, JSON.stringify(defaultStatePayload(), null, 2), 'utf8');
    }
}

function loadState() {
    try {
        ensureStateFile();
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            postedGames: new Set(parsed.postedGames || parsed.freeGames || []),
            postedPromos: new Set(parsed.postedPromos || parsed.promos || []),
            postedFreeToPlay: new Set(parsed.postedFreeToPlay || []),
            postedMobile: new Set(parsed.postedMobile || parsed.mobile || [])
        };
    } catch (err) {
        console.error('[ContentState] Failed to load state:', err.message);
        return {
            postedGames: new Set(),
            postedPromos: new Set(),
            postedFreeToPlay: new Set(),
            postedMobile: new Set()
        };
    }
}

function trimSet(setObject, maxSize = MAX_SAVED_IDS) {
    const values = Array.from(setObject);
    if (values.length <= maxSize) return values;
    return values.slice(values.length - maxSize);
}

function saveState() {
    try {
        ensureStateFile();
        const payload = {
            postedGames: trimSet(postedGames),
            postedPromos: trimSet(postedPromos),
            postedFreeToPlay: trimSet(postedFreeToPlay),
            postedMobile: trimSet(postedMobile)
        };
        fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
        console.error('[ContentState] Failed to save state:', err.message);
    }
}


function faviconForDomain(domain) {
    return `https://www.google.com/s2/favicons?sz=256&domain_url=${encodeURIComponent(`https://${domain}`)}`;
}

function getBrandMeta(label = '', platform = '') {
    const key = String(label || platform || '').toLowerCase();

    const brands = [
        { match: ['steam', 'cs steam'], name: 'Steam', icon: faviconForDomain('store.steampowered.com') },
        { match: ['epic games', 'cs epicgames', 'cs epic'], name: 'Epic Games', icon: faviconForDomain('store.epicgames.com') },
        { match: ['gog', 'cs gog'], name: 'GOG', icon: faviconForDomain('www.gog.com') },
        { match: ['ea', 'cs ea'], name: 'EA', icon: faviconForDomain('www.ea.com') },
        { match: ['ubisoft', 'cs ubisoft'], name: 'Ubisoft', icon: faviconForDomain('store.ubisoft.com') },
        { match: ['apple', 'apple rss'], name: 'Apple', icon: faviconForDomain('www.apple.com') },
        { match: ['android'], name: 'Android', icon: faviconForDomain('play.google.com') }
    ];

    const found = brands.find(brand => brand.match.some(value => key.includes(value)));
    return found || { name: label || platform || 'Store', icon: faviconForDomain('discord.com') };
}

const initialState = loadState();
let postedGames = initialState.postedGames;
let postedPromos = initialState.postedPromos;
let postedFreeToPlay = initialState.postedFreeToPlay;
let postedMobile = initialState.postedMobile;

async function postFreeGames(channel) {
    try {
        const games = await fetchAllFreeGames();
        let postedCount = 0;

        for (const game of games) {
            if (postedGames.has(game.id)) continue;

            const platformConfig = {
                epic: { color: '#00AAFF', emoji: '🎮' },
                steam: { color: '#1B2838', emoji: '🎮' },
                'cs-gog': { color: '#8636ff', emoji: '🟣' },
                'cs-ea': { color: '#ff5c7a', emoji: '🧩' },
                'cs-ubisoft': { color: '#4cc9f0', emoji: '🌀' },
                other: { color: '#7289DA', emoji: '🆓' }
            };

            const config = platformConfig[game.store] || platformConfig.other;
            const isFreeWeekend = game.type === 'free_weekend';

            const brand = getBrandMeta(game.sourceLabel, game.platform);

            const embed = new EmbedBuilder()
                .setTitle(`${config.emoji} ${game.title}`)
                .setURL(game.url)
                .setDescription(truncateText(game.description, 300) || 'Free content available now.')
                .setColor(config.color)
                .setAuthor({ name: brand.name, iconURL: brand.icon, url: game.url })
                .setTimestamp();

            embed.setThumbnail(brand.icon);
            if (game.image) embed.setImage(game.image);

            if (isFreeWeekend) {
                embed
                    .addFields(
                        { name: 'Type', value: 'FREE WEEKEND', inline: true },
                        { name: 'Store', value: game.sourceLabel || game.platform || 'Store', inline: true },
                        { name: 'Original Price', value: game.originalPrice || 'Unknown', inline: true }
                    )
                    .setFooter({ text: `${game.sourceLabel || 'Store'} • Limited-time free access` });
            } else {
                const fields = [
                    { name: 'Store', value: game.sourceLabel || game.platform || 'Store', inline: true },
                    { name: 'Status', value: 'FREE', inline: true }
                ];

                if (game.originalPrice) fields.push({ name: 'Original Price', value: game.originalPrice, inline: true });
                if (game.worth) fields.push({ name: 'Extra', value: game.worth, inline: false });
                if (game.endDate) fields.push({ name: 'Ends', value: game.endDate, inline: false });

                embed.addFields(fields).setFooter({ text: `${game.sourceLabel || game.platform || 'Store'} • Free content` });
            }

            await channel.send({ embeds: [embed] });
            postedGames.add(game.id);
            postedCount += 1;
            saveState();
            await delay(800);
        }

        console.log(postedCount > 0 ? `✅ ${postedCount} new free games posted` : 'ℹ️ No new free games to post');
    } catch (err) {
        console.error('[PostFreeGames] Error:', err.message);
    }
}

async function postPromos(channel) {
    try {
        const promos = await fetchAllPromos();
        let postedCount = 0;

        for (const promo of promos) {
            if (postedPromos.has(promo.id)) continue;

            const storeEmoji = {
                steam: '🎮',
                'cheapshark-steam': '🦈',
                'cs-gog': '🟣',
                'cs-epic': '🟦',
                'cs-ea': '🧩',
                'cs-ubisoft': '🌀'
            }[promo.store] || '🏪';

            const brand = getBrandMeta(promo.sourceLabel, promo.store);

            const embed = new EmbedBuilder()
                .setTitle(`${storeEmoji} ${promo.title}`)
                .setURL(promo.url)
                .setDescription(truncateText(promo.description || 'Limited-time promotion.', 200))
                .setAuthor({ name: brand.name, iconURL: brand.icon, url: promo.url })
                .setColor(
                    promo.discountPercent >= 70 ? '#FF0000' :
                    promo.discountPercent >= 50 ? '#FF9900' : '#00FF99'
                )
                .setFooter({ text: `${promo.sourceLabel || 'Store'} • Limited promotion` })
                .setTimestamp();

            if (promo.image) embed.setImage(promo.image);
            embed.setThumbnail(brand.icon);

            const fields = [
                { name: 'Original Price', value: `$${promo.normalPrice}`, inline: true },
                { name: 'Sale Price', value: `$${promo.price}`, inline: true },
                { name: 'Discount', value: `${promo.discountPercent}% OFF`, inline: true },
                { name: 'Store', value: promo.sourceLabel || promo.store.toUpperCase(), inline: true }
            ];

            if (promo.steamRating && promo.steamRating !== 'N/A') {
                fields.push({ name: 'Rating', value: promo.steamRating, inline: true });
            }

            embed.addFields(fields);

            await channel.send({ embeds: [embed] });
            postedPromos.add(promo.id);
            postedCount += 1;
            saveState();
            await delay(800);
        }

        console.log(postedCount > 0 ? `✅ ${postedCount} new promotions posted` : 'ℹ️ No new promotions to post');
    } catch (err) {
        console.error('[PostPromos] Error:', err.message);
    }
}

async function postFreeToPlayGames(channel) {
    try {
        const games = await fetchFreeToPlayGames();
        let postedCount = 0;

        for (const game of games) {
            if (postedFreeToPlay.has(game.id)) continue;

            const brand = getBrandMeta(game.platform, game.platform);

            const embed = new EmbedBuilder()
                .setTitle(`🎮 ${game.title}`)
                .setURL(game.url)
                .setDescription(truncateText(game.description, 400) || 'Free-to-play game available now.')
                .setColor('#7289DA')
                .setAuthor({ name: brand.name, iconURL: brand.icon, url: game.url })
                .setFooter({ text: 'Free-to-Play • Always available' })
                .setTimestamp();

            embed.setThumbnail(brand.icon);
            if (game.image) embed.setImage(game.image);

            const fields = [
                { name: 'Platform', value: game.platform, inline: true },
                { name: 'Players (2 weeks)', value: Number(game.players || 0).toLocaleString('en-US'), inline: true },
                { name: 'Status', value: 'FREE-TO-PLAY', inline: true }
            ];

            if (game.website) {
                fields.push({ name: 'Official Website', value: `[Open website](${game.website})`, inline: false });
            } else {
                fields.push({ name: 'Store Page', value: `[Open page](${game.url})`, inline: false });
            }

            embed.addFields(fields);

            await channel.send({ embeds: [embed] });
            postedFreeToPlay.add(game.id);
            postedCount += 1;
            saveState();
            await delay(1000);
        }

        console.log(postedCount > 0 ? `✅ ${postedCount} new free-to-play games posted` : 'ℹ️ No new free-to-play games to post');
    } catch (err) {
        console.error('[PostFreeToPlay] Error:', err.message);
    }
}

async function postMobileApps(channel) {
    try {
        const apps = await fetchAllMobileTopApps();
        let postedCount = 0;

        for (const app of apps) {
            if (postedMobile.has(app.id)) continue;

            const color = app.platform === 'Apple' ? '#f5f5f7' : '#66c2ff';
            const emoji = app.platform === 'Apple' ? '🍎' : '🤖';

            const brand = getBrandMeta(app.sourceLabel, app.platform);

            const embed = new EmbedBuilder()
                .setTitle(`${emoji} ${app.title}`)
                .setURL(app.url)
                .setDescription(truncateText(app.description || 'Top free mobile app.', 240))
                .setColor(color)
                .setAuthor({ name: brand.name, iconURL: brand.icon, url: app.sourceUrl || app.url })
                .addFields(
                    { name: 'Platform', value: app.sourceLabel || app.platform, inline: true },
                    { name: 'Rank', value: `#${app.rank}`, inline: true },
                    { name: 'Developer', value: truncateText(app.developer || 'Unknown developer', 100), inline: true },
                    { name: app.genericLink ? 'Open ranking' : 'Source', value: app.sourceUrl ? `[Open source](${app.sourceUrl})` : (app.footerSource || 'Source'), inline: false }
                )
                .setFooter({ text: `${app.footerSource || 'Source'} • Top Free` })
                .setTimestamp();

            embed.setThumbnail(app.image || brand.icon);

            await channel.send({ embeds: [embed] });
            postedMobile.add(app.id);
            postedCount += 1;
            saveState();
            await delay(700);
        }

        console.log(postedCount > 0 ? `✅ ${postedCount} new mobile apps posted` : 'ℹ️ No new mobile apps to post');
    } catch (err) {
        console.error('[PostMobileApps] Error:', err.message);
    }
}

async function updateAll(client) {
    console.log('📡 Updating free games and promotions...');

    try {
        const freeChannel = await client.channels.fetch(CHANNEL_FREEGAMES).catch(() => null);
        const promoChannel = await client.channels.fetch(CHANNEL_PROMOS).catch(() => null);
        const freeToPlayChannel = await client.channels.fetch(CHANNEL_FREETOPLAY).catch(() => null);
        const mobileChannel = await client.channels.fetch(CHANNEL_MOBILE).catch(() => null);

        if (!freeChannel) console.error('❌ Free games channel not found');
        if (!promoChannel) console.error('❌ Promotions channel not found');
        if (!freeToPlayChannel) console.error('❌ Free-to-play channel not found');
        if (!mobileChannel) console.error('❌ Mobile channel not found');

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
