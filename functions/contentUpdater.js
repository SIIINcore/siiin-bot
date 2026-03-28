const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const {
    CHANNEL_FREEGAMES,
    CHANNEL_PROMOS,
    CHANNEL_FREETOPLAY
} = require('../config/constants');
const { fetchAllFreeGames, fetchFreeToPlayGames } = require('./api/freeGames');
const { fetchAllPromos } = require('./api/promos');
const { delay, truncateText } = require('../utils/helpers');

const STATE_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(STATE_DIR, 'posted-content.json');
const MAX_SAVED_IDS = 2000;

function ensureStateFile() {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    if (!fs.existsSync(STATE_FILE)) {
        fs.writeFileSync(STATE_FILE, JSON.stringify({
            postedGames: [],
            postedPromos: [],
            postedFreeToPlay: []
        }, null, 2), 'utf8');
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
            postedFreeToPlay: new Set(parsed.postedFreeToPlay || [])
        };
    } catch (err) {
        console.error('[ContentState] Failed to load state:', err.message);
        return {
            postedGames: new Set(),
            postedPromos: new Set(),
            postedFreeToPlay: new Set()
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
            postedFreeToPlay: trimSet(postedFreeToPlay)
        };
        fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
        console.error('[ContentState] Failed to save state:', err.message);
    }
}

const initialState = loadState();
let postedGames = initialState.postedGames;
let postedPromos = initialState.postedPromos;
let postedFreeToPlay = initialState.postedFreeToPlay;

async function postFreeGames(channel) {
    try {
        const games = await fetchAllFreeGames();
        let postedCount = 0;

        for (const game of games) {
            if (postedGames.has(game.id)) continue;

            const platformConfig = {
                epic: { color: '#00AAFF', emoji: '🎮', name: 'Epic Games' },
                steam: { color: '#1B2838', emoji: '🎮', name: 'Steam' },
                other: { color: '#7289DA', emoji: '🆓', name: game.platform || 'PC' }
            };

            const config = platformConfig[game.store] || platformConfig.other;
            const isFreeWeekend = game.type === 'free_weekend';

            const embed = new EmbedBuilder()
                .setTitle(`${config.emoji} ${game.title}`)
                .setURL(game.url)
                .setDescription(truncateText(game.description, 300) || 'Free game available now.')
                .setColor(config.color)
                .setTimestamp();

            if (game.image) embed.setImage(game.image);

            if (isFreeWeekend) {
                embed
                    .addFields(
                        { name: 'Type', value: 'FREE WEEKEND', inline: true },
                        { name: 'Platform', value: config.name, inline: true },
                        { name: 'Original Price', value: game.originalPrice || 'Unknown', inline: true }
                    )
                    .setFooter({ text: 'Limited-time free access' });
            } else {
                const fields = [
                    { name: 'Platform', value: config.name, inline: true },
                    { name: 'Status', value: 'FREE', inline: true }
                ];

                if (game.worth) fields.push({ name: 'Value', value: game.worth, inline: true });
                if (game.endDate) fields.push({ name: 'Ends', value: game.endDate, inline: false });

                embed.addFields(fields).setFooter({ text: `${config.name} • Free game` });
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
                gog: '🟣',
                epic: '🟦'
            }[promo.store] || '🏪';

            const storeName = {
                steam: 'Steam',
                'cheapshark-steam': 'CheapShark / Steam',
                gog: 'GOG',
                epic: 'Epic Games'
            }[promo.store] || promo.store.toUpperCase();

            const embed = new EmbedBuilder()
                .setTitle(`${storeEmoji} ${promo.title}`)
                .setURL(promo.url)
                .setDescription(truncateText(promo.description || 'Limited-time promotion.', 200))
                .setColor(
                    promo.discountPercent >= 70 ? '#FF0000' :
                    promo.discountPercent >= 50 ? '#FF9900' : '#00FF00'
                )
                .setFooter({ text: `${storeName} • Limited promotion` })
                .setTimestamp();

            if (promo.image) embed.setImage(promo.image);

            const fields = [
                { name: 'Original Price', value: `$${promo.normalPrice}`, inline: true },
                { name: 'Sale Price', value: `$${promo.price}`, inline: true },
                { name: 'Discount', value: `${promo.discountPercent}% OFF`, inline: true },
                { name: 'Platform', value: storeName, inline: true }
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

            const embed = new EmbedBuilder()
                .setTitle(`🎮 ${game.title}`)
                .setURL(game.url)
                .setDescription(truncateText(game.description, 400) || 'Free-to-play game available now.')
                .setColor('#7289DA')
                .setFooter({ text: 'Free-to-Play • Always available' })
                .setTimestamp();

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

async function updateAll(client) {
    console.log('📡 Updating free games and promotions...');

    try {
        const freeChannel = await client.channels.fetch(CHANNEL_FREEGAMES).catch(() => null);
        const promoChannel = await client.channels.fetch(CHANNEL_PROMOS).catch(() => null);
        const freeToPlayChannel = await client.channels.fetch(CHANNEL_FREETOPLAY).catch(() => null);

        if (!freeChannel) console.error('❌ Free games channel not found');
        if (!promoChannel) console.error('❌ Promotions channel not found');
        if (!freeToPlayChannel) console.error('❌ Free-to-play channel not found');

        if (freeChannel) await postFreeGames(freeChannel);
        if (promoChannel) await postPromos(promoChannel);
        if (freeToPlayChannel) await postFreeToPlayGames(freeToPlayChannel);

        console.log('✅ Update completed.');
    } catch (err) {
        console.error('[UpdateAll] Error:', err.message);
    }
}

async function softRestart(client) {
    console.log('🔄 Soft restart of functions...');
    try {
        // Keep persisted IDs so the bot does not repost old content after a soft restart.
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
    postedFreeToPlay
};
