const { EmbedBuilder } = require('discord.js');
const { 
    CHANNEL_FREEGAMES, 
    CHANNEL_PROMOS, 
    CHANNEL_FREETOPLAY,
    BOT_VERSION 
} = require('../config/constants');
const { fetchAllFreeGames, fetchFreeToPlayGames } = require('./api/freeGames');
const { fetchAllPromos } = require('./api/promos');
const { delay, truncateText } = require('../utils/helpers');

let postedGames = new Set();
let postedPromos = new Set();
let postedFreeToPlay = new Set();
let platformPromosCache = new Map();

async function postFreeGames(channel) {
    try {
        const games = await fetchAllFreeGames();
        let postedCount = 0;
        
        for (const game of games) {
            if (postedGames.has(game.id)) continue;
            
            const platformConfig = {
                'epic': { color: '#00AAFF', emoji: '🎮', name: 'Epic Games' },
                'steam': { color: '#1B2838', emoji: '<:steam:1033530974107091035>', name: 'Steam' },
                'other': { color: '#7289DA', emoji: '🆓', name: game.platform || 'PC' }
            };
            
            const config = platformConfig[game.store] || platformConfig.other;
            const isFreeWeekend = game.type === 'free_weekend';
            
            const embed = new EmbedBuilder()
                .setTitle(`${config.emoji} **${game.title}**`)
                .setURL(game.url)
                .setDescription(truncateText(game.description, 300))
                .setImage(game.image || null)
                .setColor(config.color);
            
            if (isFreeWeekend) {
                embed.addFields(
                    { name: '🎪 Type', value: 'FREE WEEKEND', inline: true },
                    { name: '🏪 Platform', value: config.name, inline: true },
                    { name: '💰 Original Price', value: game.originalPrice, inline: true }
                );
                embed.setFooter({ text: 'Free Weekend • Enjoy it quickly!' });
            } else {
                const fields = [
                    { name: '🏪 Platform', value: config.name, inline: true },
                    { name: '🎯 Status', value: game.type === 'free' ? '🆓 FREE' : '🎁 SPECIAL OFFER', inline: true }
                ];
                
                if (game.worth) {
                    fields.push({ name: '💰 Value', value: game.worth, inline: true });
                }
                if (game.endDate) {
                    fields.push({ name: '⏰ End', value: game.endDate, inline: false });
                }
                if (game.discountPercent === 100) {
                    fields.push({ name: '🎉 Discount', value: '100% OFF', inline: true });
                }
                
                embed.addFields(fields);
                embed.setFooter({ text: `${config.name} • Free game` });
            }
            
            embed.setTimestamp();
            
            await channel.send({ embeds: [embed] });
            postedGames.add(game.id);
            postedCount++;
            
            await delay(800);
        }
        
        if (postedCount > 0) {
            console.log(`✅ ${postedCount} new free games posted`);
        } else {
            console.log('ℹ️ No new free games to post');
        }
        
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
                'steam': '<:steam:1033530974107091035>',
                'cheapshark': '🦈',
                'epic': '🎮'
            }[promo.store] || '🏪';
            
            const embed = new EmbedBuilder()
                .setTitle(`${storeEmoji} **${promo.title}**`)
                .setURL(promo.url)
                .setDescription(promo.description ? truncateText(promo.description, 200) : '**Limited time promotion!**')
                .setImage(promo.image || null)
                .setColor(promo.discountPercent >= 70 ? '#FF0000' : promo.discountPercent >= 50 ? '#FF9900' : '#00FF00')
                .setFooter({ text: `${promo.store.toUpperCase()} • Limited promotion` })
                .setTimestamp();
            
            const fields = [
                { name: '💰 Original Price', value: `$${promo.normalPrice}`, inline: true },
                { name: '🎯 Sale Price', value: `$${promo.price}`, inline: true },
                { name: '🎉 Discount', value: `${promo.discountPercent}% OFF`, inline: true },
                { name: '🏪 Platform', value: promo.store.toUpperCase(), inline: true }
            ];
            
            if (promo.steamRating && promo.steamRating !== 'N/A') {
                fields.push({ name: '⭐ Rating', value: promo.steamRating, inline: true });
            }
            
            embed.addFields(fields);
            
            await channel.send({ embeds: [embed] });
            postedPromos.add(promo.id);
            postedCount++;
            
            await delay(800);
        }
        
        if (postedCount > 0) {
            console.log(`✅ ${postedCount} new promotions posted`);
        } else {
            console.log('ℹ️ No new promotions to post');
        }
        
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
                .setTitle(`🎮 **${game.title}**`)
                .setURL(game.url)
                .setDescription(truncateText(game.description, 400))
                .setImage(game.image || null)
                .setColor('#7289DA')
                .setFooter({ text: 'Free-to-Play • Always available' })
                .setTimestamp();
            
            const fields = [
                { name: '🏪 Platform', value: game.platform, inline: true },
                { name: '👥 Players (2 weeks)', value: game.players.toLocaleString(), inline: true },
                { name: '🎯 Status', value: '🆓 FREE-TO-PLAY', inline: true }
            ];
            
            if (game.trailer) {
                fields.push({ name: '📺 Trailer', value: `[Watch on YouTube](${game.trailer})`, inline: false });
            }
            
            if (game.website) {
                fields.push({ name: '🌐 Official Website', value: `[Official Website](${game.website})`, inline: false });
            } else {
                fields.push({ name: '🌐 Store Page', value: `[Store Page](${game.url})`, inline: false });
            }
            
            embed.addFields(fields);
            
            await channel.send({ embeds: [embed] });
            postedFreeToPlay.add(game.id);
            postedCount++;
            
            await delay(1000);
        }
        
        if (postedCount > 0) {
            console.log(`✅ ${postedCount} new free-to-play games posted`);
        } else {
            console.log('ℹ️ No new free-to-play games to post');
        }
        
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
        
        const promises = [];
        
        if (freeChannel) promises.push(postFreeGames(freeChannel));
        if (promoChannel) promises.push(postPromos(promoChannel));
        if (freeToPlayChannel) promises.push(postFreeToPlayGames(freeToPlayChannel));
        
        await Promise.all(promises);
        
        console.log('✅ Update completed.');
        
    } catch (err) {
        console.error('[UpdateAll] Error:', err.message);
    }
}

async function softRestart(client) {
    console.log('🔄 Soft restart of functions...');
    try {
        postedGames.clear();
        postedPromos.clear();
        postedFreeToPlay.clear();
        platformPromosCache.clear();
        
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
