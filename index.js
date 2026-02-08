// ================================
// SIIIN CORE | SIIIN 3.0.0.1
// ================================

// ================================
// IMPORTS | CONFIG
// ================================
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits,
    AuditLogEvent
} = require('discord.js');
const express = require('express');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

// ================================
// IMPORT DES CONSTANTES
// ================================
const { 
    CHANNEL_FREEGAMES,
    CHANNEL_PROMOS,
    CHANNEL_FREETOPLAY,
    CHANNEL_WELCOME,
    STATS_CHANNEL_ID,
    SUPPORT_CHANNEL_ID,
    TICKET_CATEGORY_ID,
    LOG_CHANNEL_ID,
    CHAT_CHANNEL_ID,
    DONATION_CHANNEL_ID,
    BAN_LOG_CHANNEL_ID,
    BOT_ID,
    STAFF_IDS,
    ALLOWED_FILE_EXTENSIONS,
    BOT_VERSION
} = require('./config/constants');

// ================================
// EXPRESS STARTUP
// ================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.get(process.env.RAILWAY_HEALTHCHECK_PATH || '/', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        bot: client?.user?.tag || 'offline',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Health check on port ${PORT}`);
});

// ================================
// AUTOMOD CONFIGURATION
// ================================
const AUTOMOD_CONFIG = {
    // Bad words in multiple languages
    BAD_WORDS: [
        // French
        'merde', 'putain', 'connard', 'enculé', 'salope', 'bite', 'couille', 'nique', 'foutre',
        'pd', 'tg', 'ntm', 'ftg', 'enfoiré',
        
        // English
        'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'dick', 'pussy', 'bastard', 'whore',
        'motherfucker', 'damn', 'hell',
        
        // Spanish
        'mierda', 'puta', 'cabrón', 'coño', 'joder', 'gilipollas', 'pendejo', 'chingar',
        
        // Russian/Cyrillic
        'сука', 'блять', 'пизда', 'хуй', 'ебать', 'говно',
        
        // Arabic (transliterated)
        'kuss', 'sharmouta', 'ibn el sharmouta',
        
        // Evasion patterns
        /f[-\s_]*u[-\s_]*c[-\s_]*k/i,
        /s[-\s_]*h[-\s_]*i[-\s_]*t/i,
        /b[-\s_]*i[-\s_]*t[-\s_]*c[-\s_]*h/i,
        /a[-\s_]*s[-\s_]*s[-\s_]*h[-\s_]*o[-\s_]*l[-\s_]*e/i,
        /n[-\s_]*i[-\s_]*g[-\s_]*g[-\s_]*e[-\s_]*r/i
    ],
    
    // Dangerous links patterns
    DANGEROUS_LINKS: [
        /discord\.gift/i,
        /nitro\.gift/i,
        /steamcommunity\.com\/gifts/i,
        /free\-nitro/i,
        /discord\-nitro/i,
        /steam\-gift/i,
        /hack\-tool/i,
        /cracked/i,
        /keygen/i,
        /pirate/i,
        /(?:bit\.ly|tinyurl|shorturl|goo\.gl)\/.*/i
    ],
    
    // Allowed domains (YouTube and trusted game stores)
    ALLOWED_DOMAINS: [
        'youtube.com',
        'youtu.be',
        'store.steampowered.com',
        'epicgames.com',
        'gog.com',
        'ubisoft.com',
        'ea.com',
        'discord.com',
        'discord.gg',
        'paypal.com',
        'github.com'
    ],
    
    // User warnings tracking
    userWarnings: new Map(),
    
    // Max warnings before ban
    MAX_WARNINGS: 3
};

// ================================
// DISCORD CLIENT | GATEWAY
// ================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageTyping
    ]
});

// ================================
// ANTI SPAM | GAME MANAGEMENT
// ================================
let postedGames = new Set();
let postedPromos = new Set();
let postedFreeToPlay = new Set();
let platformPromosCache = new Map();
let lastStatsMessageId = null;
let chatReminderMessageId = null;
let donationMessageId = null;
let lastVersionLogged = null;

// ================================
// APIS MANAGEMENT
// ================================
const API_CONFIG = {
    CHEAP_SHARK: {
        BASE_URL: 'https://www.cheapshark.com/api/1.0',
        STORES: {
            STEAM: 1,
            GOG: 7,
            EPIC: 25,
            UBISOFT: 12,
            EA: 13
        }
    },
    STEAM: {
        BASE_URL: 'https://store.steampowered.com/api',
        FEATURED: '/featuredcategories',
        FREE_GAMES: '/featured',
        APP_DETAILS: (appId) => `/appdetails?appids=${appId}&cc=us&l=en`
    },
    GAMER_POWER: {
        BASE_URL: 'https://www.gamerpower.com/api',
        EPIC_GAMES: '/giveaways?platform=epic-games-store',
        ALL_FREE: '/giveaways?type=game&platform=pc'
    },
    STEAMSPY: {
        BASE_URL: 'https://steamspy.com/api.php',
        ALL_GAMES: '?request=all'
    }
};

// ================================
// APIS HEADERS
// ================================
const API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0; +https://discord.gg)',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9'
};

// ================================
// UTILITIES
// ================================
function generateGameHash(title, price, store) {
    return `${title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${price}_${store}`;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

function containsBadWord(text) {
    const lowerText = text.toLowerCase();
    
    // Check direct bad words
    for (const word of AUTOMOD_CONFIG.BAD_WORDS) {
        if (typeof word === 'string') {
            if (lowerText.includes(word.toLowerCase())) {
                return { found: true, word: word, reason: 'Bad word detected' };
            }
        } else if (word instanceof RegExp) {
            if (word.test(lowerText)) {
                return { found: true, word: 'Pattern match', reason: 'Evaded bad word detected' };
            }
        }
    }
    
    return { found: false };
}

function isDangerousLink(text) {
    for (const pattern of AUTOMOD_CONFIG.DANGEROUS_LINKS) {
        if (pattern.test(text)) {
            return { dangerous: true, reason: 'Dangerous/scam link detected' };
        }
    }
    
    // Check for unauthorized links (except allowed domains)
    const urlRegex = /https?:\/\/([^\s/]+)/gi;
    const matches = text.match(urlRegex);
    
    if (matches) {
        for (const url of matches) {
            const domain = url.match(/https?:\/\/([^\s/]+)/i)[1];
            let isAllowed = false;
            
            for (const allowedDomain of AUTOMOD_CONFIG.ALLOWED_DOMAINS) {
                if (domain.includes(allowedDomain)) {
                    isAllowed = true;
                    break;
                }
            }
            
            if (!isAllowed) {
                return { dangerous: true, reason: 'Unauthorized link domain: ' + domain };
            }
        }
    }
    
    return { dangerous: false };
}

// ================================
// API | FREE GAMES [EPIC GAMES]
// ================================
async function fetchEpicFreeGames() {
    try {
        const res = await fetch(`${API_CONFIG.GAMER_POWER.BASE_URL}${API_CONFIG.GAMER_POWER.EPIC_GAMES}`, {
            headers: API_HEADERS,
            timeout: 10000
        });
        
        if (!res.ok) {
            console.error(`[EpicFree] HTTP Error: ${res.status}`);
            return [];
        }
        
        const data = await res.json();
        return data.map(game => ({
            id: `epic_${game.id}`,
            title: game.title,
            url: game.open_giveaway_url,
            image: game.image,
            description: truncateText(game.description || '', 500),
            platform: game.platforms,
            type: 'free',
            store: 'epic',
            worth: game.worth ? `Value: $${game.worth}` : '',
            endDate: game.end_date ? `Until: ${new Date(game.end_date).toLocaleDateString('en-US')}` : ''
        })).filter(game => game.title && game.url);
        
    } catch (err) {
        console.error('[EpicFree] API Error:', err.message);
        return [];
    }
}

// ================================
// API | FREE GAMES [STEAM]
// ================================
async function fetchSteamFreeGames() {
    try {
        const res = await fetch(`${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.FEATURED}`, {
            headers: API_HEADERS,
            timeout: 15000
        });
        
        if (!res.ok) {
            console.error(`[SteamFree] HTTP Error: ${res.status}`);
            return [];
        }
        
        const data = await res.json();
        const freeGames = [];
        
        const categories = [
            data?.specials,
            data?.coming_soon,
            data?.top_sellers,
            data?.new_releases
        ];
        
        for (const category of categories) {
            if (category?.items) {
                for (const game of category.items) {
                    if ((game.final_price === 0 && game.original_price > 0) || 
                        (game.final_price === 0 && game.original_price === 0)) {
                        
                        const isFreeWeekend = game.final_price === 0 && game.original_price > 0;
                        
                        freeGames.push({
                            id: `steam_free_${game.id}`,
                            title: game.name,
                            url: `https://store.steampowered.com/app/${game.id}`,
                            image: game.large_capsule_image || game.small_capsule_image,
                            description: truncateText(game.detailed_description || 'Free game on Steam', 400),
                            platform: 'Steam',
                            type: isFreeWeekend ? 'free_weekend' : 'free',
                            store: 'steam',
                            originalPrice: game.original_price > 0 ? `Normally: $${(game.original_price/100).toFixed(2)}` : 'Free-to-Play',
                            discountPercent: isFreeWeekend ? 100 : 0
                        });
                    }
                }
            }
        }
        
        return freeGames.slice(0, 10);
        
    } catch (err) {
        console.error('[SteamFree] API Error:', err.message);
        return [];
    }
}

// ================================
// API | FREE TO PLAY GAMES [STEAM]
// ================================
async function fetchFreeToPlayGames() {
    try {
        // Using SteamSpy API for popular free-to-play games
        const res = await fetch(`${API_CONFIG.STEAMSPY.BASE_URL}${API_CONFIG.STEAMSPY.ALL_GAMES}`, {
            headers: API_HEADERS,
            timeout: 15000
        });
        
        if (!res.ok) {
            console.error(`[FreeToPlay] HTTP Error: ${res.status}`);
            return [];
        }
        
        const data = await res.json();
        const freeToPlayGames = [];
        
        // Filter for free-to-play games and sort by players
        let count = 0;
        for (const appId in data) {
            const game = data[appId];
            if (game.price === "0" && game.name && count < 15) {
                try {
                    // Get detailed information
                    const detailsRes = await fetch(
                        `${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.APP_DETAILS(appId)}`,
                        { headers: API_HEADERS, timeout: 10000 }
                    );
                    
                    if (detailsRes.ok) {
                        const detailsData = await detailsRes.json();
                        const gameDetails = detailsData[appId]?.data;
                        
                        if (gameDetails && gameDetails.type === "game") {
                            freeToPlayGames.push({
                                id: `freetoplay_${appId}`,
                                title: game.name,
                                url: `https://store.steampowered.com/app/${appId}`,
                                image: gameDetails.header_image || gameDetails.capsule_image,
                                description: truncateText(gameDetails.short_description || gameDetails.detailed_description || '', 500),
                                platform: 'Steam',
                                type: 'freetoplay',
                                store: 'steam',
                                players: game.players_2weeks || 0,
                                trailer: gameDetails.movies ? `https://www.youtube.com/watch?v=${gameDetails.movies[0]?.id}` : null,
                                website: gameDetails.website || null
                            });
                            count++;
                        }
                    }
                    
                    await delay(500); // Rate limiting
                } catch (err) {
                    console.error(`[FreeToPlay] Error fetching details for ${appId}:`, err.message);
                }
            }
        }
        
        // Sort by player count
        freeToPlayGames.sort((a, b) => b.players - a.players);
        
        return freeToPlayGames.slice(0, 10);
        
    } catch (err) {
        console.error('[FreeToPlay] API Error:', err.message);
        return [];
    }
}

// ================================
// API | FREE GAMES [ALL PLATFORMS]
// ================================
async function fetchAllFreeGames() {
    console.log('🔄 Fetching free games...');
    
    const allGames = [];
    const seenHashes = new Set();
    
    try {
        // 1. Epic Games Store
        console.log('📥 Fetching Epic Games...');
        const epicGames = await fetchEpicFreeGames();
        
        for (const game of epicGames) {
            const hash = generateGameHash(game.title, '0', 'epic');
            if (!seenHashes.has(hash)) {
                seenHashes.add(hash);
                allGames.push(game);
            }
        }
        
        await delay(1000);
        
        // 2. Steam
        console.log('📥 Fetching Steam...');
        const steamGames = await fetchSteamFreeGames();
        
        for (const game of steamGames) {
            const hash = generateGameHash(game.title, '0', 'steam');
            if (!seenHashes.has(hash)) {
                seenHashes.add(hash);
                allGames.push(game);
            }
        }
        
    } catch (err) {
        console.error('[AllFreeGames] Global error:', err.message);
    }
    
    console.log(`✅ ${allGames.length} free games found`);
    return allGames;
}

// ================================
// API | PROMOS STEAM
// ================================
async function fetchSteamPromos() {
    try {
        const res = await fetch(`${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.FEATURED}`, {
            headers: API_HEADERS,
            timeout: 15000
        });
        
        if (!res.ok) {
            console.error(`[SteamPromos] HTTP Error: ${res.status}`);
            return [];
        }
        
        const data = await res.json();
        const specials = data?.specials?.items || [];
        
        return specials.map(game => {
            const discountPercent = Math.round(game.discount_percent || 0);
            const finalPrice = game.final_price / 100;
            const originalPrice = game.original_price / 100;
            
            return {
                id: `steam_${game.id}`,
                title: game.name,
                url: `https://store.steampowered.com/app/${game.id}`,
                image: game.large_capsule_image || game.small_capsule_image,
                price: finalPrice.toFixed(2),
                normalPrice: originalPrice.toFixed(2),
                discountPercent,
                type: 'promo',
                store: 'steam',
                description: truncateText(game.detailed_description || '', 300)
            };
        }).filter(game => game.discountPercent >= 40 && game.finalPrice > 0);
        
    } catch (err) {
        console.error('[SteamPromos] API Error:', err.message);
        return [];
    }
}

// ================================
// API | PROMOS CHEAPSHARK (BACKUP)
// ================================
async function fetchCheapSharkPromos() {
    try {
        const res = await fetch(`${API_CONFIG.CHEAP_SHARK.BASE_URL}/deals?storeID=1&upperPrice=15&pageSize=20`, {
            headers: API_HEADERS,
            timeout: 10000
        });
        
        if (!res.ok) {
            console.error(`[CheapShark] HTTP Error: ${res.status}`);
            return [];
        }
        
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('[CheapShark] Non-JSON response received');
            return [];
        }
        
        const data = await res.json();
        
        return data.filter(game => {
            const normalPrice = parseFloat(game.normalPrice);
            const salePrice = parseFloat(game.salePrice);
            const discount = ((normalPrice - salePrice) / normalPrice) * 100;
            return discount >= 40 && salePrice <= 15;
        }).map(game => {
            const normalPrice = parseFloat(game.normalPrice);
            const salePrice = parseFloat(game.salePrice);
            const discountPercent = Math.round(((normalPrice - salePrice) / normalPrice) * 100);
            
            return {
                id: `cheapshark_${game.dealID}`,
                title: game.title,
                url: `https://www.cheapshark.com/redirect?dealID=${game.dealID}`,
                image: game.thumb,
                price: salePrice.toFixed(2),
                normalPrice: normalPrice.toFixed(2),
                discountPercent,
                type: 'promo',
                store: 'cheapshark',
                steamRating: game.steamRatingText || 'N/A'
            };
        });
        
    } catch (err) {
        console.error('[CheapShark] API Error:', err.message);
        return [];
    }
}

// ================================
// UNIFIED FUNCTION FOR PROMOS
// ================================
async function fetchAllPromos() {
    console.log('🔄 Fetching promotions from all platforms...');
    
    const allPromos = [];
    const seenHashes = new Set();
    
    try {
        // 1. Steam (priority)
        console.log('📥 Fetching Steam...');
        const steamPromos = await fetchSteamPromos();
        
        for (const promo of steamPromos) {
            const hash = generateGameHash(promo.title, promo.price, 'steam');
            if (!seenHashes.has(hash)) {
                seenHashes.add(hash);
                allPromos.push(promo);
                platformPromosCache.set(hash, 'steam');
            }
        }
        
        await delay(1000);
        
        // 2. CheapShark (complement)
        console.log('📥 Fetching CheapShark...');
        const cheapSharkPromos = await fetchCheapSharkPromos();
        
        for (const promo of cheapSharkPromos) {
            const hash = generateGameHash(promo.title, promo.price, 'cheapshark');
            if (!seenHashes.has(hash.replace('_cheapshark', '_steam')) && !seenHashes.has(hash)) {
                seenHashes.add(hash);
                allPromos.push(promo);
                platformPromosCache.set(hash, 'cheapshark');
            }
        }
        
    } catch (err) {
        console.error('[AllPromos] Global error:', err.message);
    }
    
    console.log(`✅ ${allPromos.length} promotions found`);
    return allPromos;
}

// ================================
// POST API | FREE GAMES
// ================================
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

// ================================
// POST API | PROMOS
// ================================
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

// ================================
// POST FREE TO PLAY GAMES
// ================================
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

// ================================
// UPDATE ALL CONTENT
// ================================
async function updateAll() {
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

// ================================
// STATS | DISCORD SERVER
// ================================
async function updateStatsEmbed(guild) {
    try {
        const channel = await guild.channels.fetch(STATS_CHANNEL_ID);
        if (!channel) return;

        // Delete old stats message if exists
        if (lastStatsMessageId) {
            try {
                const oldMessage = await channel.messages.fetch(lastStatsMessageId);
                if (oldMessage) await oldMessage.delete();
            } catch (err) {
                // Message already deleted or not found
            }
        }

        await guild.members.fetch();
        const totalMembers = guild.memberCount;
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        const maxBlocks = 20;
        const progress = Math.min(totalMembers / 1000, 1);
        const filledBlocks = Math.round(progress * maxBlocks);
        const emptyBlocks = maxBlocks - filledBlocks;
        const bar = '🟥'.repeat(filledBlocks) + '⬛'.repeat(emptyBlocks);

        const embed = new EmbedBuilder()
            .setTitle('📊 **S E R V E R   S T A T S**')
            .setColor('#FF0000')
            .setDescription(`${bar}\n\n👥 **Total members:** ${totalMembers}\n🧑 **Peoples:** ${humanCount}\n🤖 **Apps:** ${botCount}`)
            .addFields(
                { name: '🎮 Free games', value: `${postedGames.size} posted`, inline: true },
                { name: '🏪 Promotions', value: `${postedPromos.size} posted`, inline: true },
                { name: '🆓 Free-to-play', value: `${postedFreeToPlay.size} posted`, inline: true }
            )
            .setFooter({ text: 'SIIIN Stats • Automatic update' })
            .setTimestamp();

        const message = await channel.send({ embeds: [embed] });
        lastStatsMessageId = message.id;
        
    } catch (err) {
        console.error('[Stats] Error:', err.message);
    }
}

// ================================
// SEND DONATION MESSAGE
// ================================
async function sendDonationMessage() {
    try {
        const channel = await client.channels.fetch(DONATION_CHANNEL_ID);
        if (!channel) {
            console.warn("❌ Donation channel not found!");
            return;
        }

        // Check if message already exists
        if (donationMessageId) {
            try {
                const existingMessage = await channel.messages.fetch(donationMessageId);
                if (existingMessage) {
                    console.log('ℹ️ Donation message already exists');
                    return;
                }
            } catch (err) {
                // Message not found, proceed to send new one
            }
        }

        // Delete any other bot messages in the channel
        const messages = await channel.messages.fetch({ limit: 20 });
        for (const [, msg] of messages.filter(m => m.author.id === client.user.id)) {
            await msg.delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setTitle("💝 Support the Developers")
            .setDescription(
`Thank you for considering to support our work!

Your donations help us maintain and improve the server, as well as cover hosting costs.

**For the price of a coffee:**`
            )
            .setColor(0xFFD700)
            .addFields(
                { name: 'PayPal', value: '[Donate here](https://www.paypal.com/paypalme/LunaSiiin)', inline: true }
            )
            .setFooter({ text: 'SIIIN Development Team • Thank you for your support!' })
            .setTimestamp();

        const message = await channel.send({ embeds: [embed] });
        donationMessageId = message.id;
        console.log("✅ Donation message sent!");
        
    } catch (err) {
        console.error('[DonationMessage] Error:', err.message);
    }
}

// ================================
// SEND INFORMATION MESSAGE
// ================================
async function sendInformationMessage() {
    try {
        const infoChannel = await client.channels.fetch('1033506664810287134').catch(() => null);
        if (!infoChannel) return;

        // Check if we already posted today
        const messages = await infoChannel.messages.fetch({ limit: 10 });
        const today = new Date().toDateString();
        const alreadyPosted = messages.some(msg => 
            msg.author.id === client.user.id && 
            new Date(msg.createdTimestamp).toDateString() === today
        );

        if (alreadyPosted) return;

        const embed = new EmbedBuilder()
            .setTitle("📋 SIIIN PATCHES & EXTRA - INFORMATION")
            .setDescription(
`Welcome to our community! Here you'll find patches, mods, and extras for various games.

**Important links:**

**Server Invitation Link:**
\`\`\`
https://discord.gg/eFBDgY2bup
\`\`\`

**Quick navigation:**
• [Rules](https://discord.com/channels/1033462383798140978/1177257234787471422/1468570201095274552)
• [Announcements](https://discord.com/channels/1033462383798140981/1237650687249092670)
• [Support/Tickets](https://discord.com/channels/1033462383798140981/1468090646442279206)
• [Free Games](https://discord.com/channels/1033462383798140981/1469855556356542649)
• [Promotions](https://discord.com/channels/1033462383798140981/1469855518695624725)

**[Click to read from the Beginning](https://discord.com/channels/1033462383798140978/1033506664810287134/1440058017545584871)**`
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'SIIIN Community • Updated daily' })
            .setTimestamp();

        await infoChannel.send({ embeds: [embed] });
        console.log("✅ Information message sent!");
        
    } catch (err) {
        console.error('[InformationMessage] Error:', err.message);
    }
}

// ================================
// CHAT REMINDER SYSTEM
// ================================
async function updateChatReminder(channel) {
    try {
        // Delete old reminder if exists
        if (chatReminderMessageId) {
            try {
                const oldMessage = await channel.messages.fetch(chatReminderMessageId);
                if (oldMessage) await oldMessage.delete();
            } catch (err) {
                // Message already deleted
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("# Welcome to SIIIN P&+ Discord")
            .setDescription(
`▪ You are in the dedicated chat channel, help is welcome here, but this is not the support channel.

# Rules reminder:
▪ No insults
▪ No links [Except YouTube]
▪ No spam
▪ This discord is not made for support.
▪ For any support request: create a ticket in <#1468090646442279206>

Please respect the rules for the happiness of Discord users.`
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'SIIIN Community • Be respectful' });

        const message = await channel.send({ embeds: [embed] });
        chatReminderMessageId = message.id;
        
    } catch (err) {
        console.error('[ChatReminder] Error:', err.message);
    }
}

// ================================
// AUTOMODERATION SYSTEM
// ================================
async function handleAutomod(message) {
    // Staff bypass
    if (STAFF_IDS.includes(message.author.id)) return false;
    
    const content = message.content;
    const authorId = message.author.id;
    
    // Check for bad words
    const badWordCheck = containsBadWord(content);
    if (badWordCheck.found) {
        await handleViolation(message, 'bad_word', badWordCheck.reason);
        return true;
    }
    
    // Check for dangerous links
    const linkCheck = isDangerousLink(content);
    if (linkCheck.dangerous) {
        // Immediate ban for dangerous links
        await handleDangerousLink(message, linkCheck.reason);
        return true;
    }
    
    return false;
}

async function handleViolation(message, type, reason) {
    const authorId = message.author.id;
    const warnings = AUTOMOD_CONFIG.userWarnings.get(authorId) || 0;
    const newWarnings = warnings + 1;
    
    // Delete the offending message
    await message.delete().catch(() => {});
    
        // Create censored message
    const censoredEmbed = new EmbedBuilder()
        .setTitle("🚫 Message Censored")
        .setDescription(`█████████████████████████████████████████████████`)
        .addFields(
            { name: 'Censorship Reason:', value: `**${reason}**`, inline: false },
            { name: 'User:', value: `<@${message.author.id}>`, inline: true },
            { name: 'Warnings:', value: `${newWarnings}/${AUTOMOD_CONFIG.MAX_WARNINGS}`, inline: true }
        )
        .setColor(0xFF0000)
        .setFooter({ text: 'Automod System • SIIIN Protection' })
        .setTimestamp();

    const warningMsg = await message.channel.send({ embeds: [censoredEmbed] });
    setTimeout(() => warningMsg.delete().catch(() => {}), 10000);
    
    AUTOMOD_CONFIG.userWarnings.set(authorId, newWarnings);
    
    // Check if user should be banned
    if (newWarnings >= AUTOMOD_CONFIG.MAX_WARNINGS) {
        await handleBan(message.author, `Reached ${AUTOMOD_CONFIG.MAX_WARNINGS} automod warnings`);
    }
    
    // Send warning DM to user
    try {
        await message.author.send({
            content: `⚠️ **You received a warning on ${message.guild.name}**\n` +
                    `**Reason:** ${reason}\n` +
                    `**Warnings:** ${newWarnings}/${AUTOMOD_CONFIG.MAX_WARNINGS}\n` +
                    `⚠️ **${AUTOMOD_CONFIG.MAX_WARNINGS - newWarnings} warning(s) remaining before ban**\n\n` +
                    `Please respect the server rules.`
        });
    } catch (err) {
        // User has DMs closed, ignore
    }
    
    return true;
}

async function handleDangerousLink(message, reason) {
    const authorId = message.author.id;
    
    // Delete all messages from this user in last 10 minutes
    try {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        const userMessages = messages.filter(m => m.author.id === authorId && Date.now() - m.createdTimestamp < 10 * 60 * 1000);
        
        for (const msg of userMessages.values()) {
            await msg.delete().catch(() => {});
        }
    } catch (err) {
        console.error('[Automod] Error deleting messages:', err.message);
    }
    
    // Immediate ban
    await handleBan(message.author, `Dangerous link posted: ${reason}`);
    
    // Log to channel
    const banEmbed = new EmbedBuilder()
        .setTitle("⛔ IMMEDIATE BAN")
        .setDescription(`**User posted dangerous content**`)
        .addFields(
            { name: 'User:', value: `${message.author.tag} (${authorId})`, inline: false },
            { name: 'Reason:', value: reason, inline: false },
            { name: 'Action:', value: 'Immediate ban + message purge', inline: false }
        )
        .setColor(0xFF0000)
        .setFooter({ text: 'Automod Security System' })
        .setTimestamp();
    
    await message.channel.send({ embeds: [banEmbed] });
    
    return true;
}

async function handleBan(user, reason) {
    try {
        // Get ban log channel
        const banLogChannel = await client.channels.fetch(BAN_LOG_CHANNEL_ID).catch(() => null);
        
        // Try to ban the user
        await user.ban({ reason: reason, deleteMessageSeconds: 60 * 10 }); // Delete 10 minutes of messages
        
        // Log to ban channel
        if (banLogChannel) {
            const embed = new EmbedBuilder()
                .setTitle("🔨 User Banned")
                .setColor(0xFF0000)
                .addFields(
                    { name: 'User Tag:', value: user.tag, inline: true },
                    { name: 'User ID:', value: user.id, inline: true },
                    { name: 'Reason:', value: reason, inline: false },
                    { name: 'Banned by:', value: 'Automod System', inline: true },
                    { name: 'Time:', value: new Date().toLocaleString('en-US'), inline: true }
                )
                .setFooter({ text: 'SIIIN Security • Ban Log' })
                .setTimestamp();
            
            await banLogChannel.send({ embeds: [embed] });
        }
        
        console.log(`✅ Banned ${user.tag} for: ${reason}`);
        
    } catch (err) {
        console.error(`❌ Failed to ban ${user.tag}:`, err.message);
    }
}

// ================================
// AUDIT LOG MONITORING
// ================================
client.on('guildAuditLogEntryCreate', async (auditLogEntry, guild) => {
    try {
        const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);
        if (!logChannel) return;
        
        const executor = auditLogEntry.executor;
        const target = auditLogEntry.target;
        
        // Skip bot actions
        if (executor?.bot) return;
        
        let embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTimestamp();
        
        switch (auditLogEntry.action) {
            case AuditLogEvent.MemberBanAdd:
                embed
                    .setTitle("🔨 Member Banned")
                    .addFields(
                        { name: 'User:', value: target?.tag || 'Unknown', inline: true },
                        { name: 'User ID:', value: target?.id || 'Unknown', inline: true },
                        { name: 'Moderator:', value: executor?.tag || 'Unknown', inline: true },
                        { name: 'Reason:', value: auditLogEntry.reason || 'No reason provided', inline: false }
                    );
                break;
                
            case AuditLogEvent.MemberBanRemove:
                embed
                    .setTitle("✅ Member Unbanned")
                    .addFields(
                        { name: 'User:', value: target?.tag || 'Unknown', inline: true },
                        { name: 'User ID:', value: target?.id || 'Unknown', inline: true },
                        { name: 'Moderator:', value: executor?.tag || 'Unknown', inline: true }
                    );
                break;
                
            case AuditLogEvent.MemberKick:
                embed
                    .setTitle("👢 Member Kicked")
                    .addFields(
                        { name: 'User:', value: target?.tag || 'Unknown', inline: true },
                        { name: 'Moderator:', value: executor?.tag || 'Unknown', inline: true },
                        { name: 'Reason:', value: auditLogEntry.reason || 'No reason provided', inline: false }
                    );
                break;
                
            case AuditLogEvent.MemberUpdate:
                // Check for role updates
                if (auditLogEntry.changes?.some(change => change.key === '$add' || change.key === '$remove')) {
                    const addedRoles = auditLogEntry.changes.find(c => c.key === '$add')?.new || [];
                    const removedRoles = auditLogEntry.changes.find(c => c.key === '$remove')?.new || [];
                    
                    if (addedRoles.length > 0 || removedRoles.length > 0) {
                        embed.setTitle("🎭 Role Update");
                        
                        const fields = [];
                        fields.push({ name: 'User:', value: target?.tag || 'Unknown', inline: true });
                        fields.push({ name: 'Moderator:', value: executor?.tag || 'Unknown', inline: true });
                        
                        if (addedRoles.length > 0) {
                            const roleNames = addedRoles.map(r => `<@&${r.id}>`).join(', ');
                            fields.push({ name: 'Roles Added:', value: roleNames, inline: false });
                        }
                        
                        if (removedRoles.length > 0) {
                            const roleNames = removedRoles.map(r => `<@&${r.id}>`).join(', ');
                            fields.push({ name: 'Roles Removed:', value: roleNames, inline: false });
                        }
                        
                        embed.addFields(fields);
                    }
                }
                break;
                
            case AuditLogEvent.ChannelUpdate:
                embed
                    .setTitle("📝 Channel Updated")
                    .addFields(
                        { name: 'Channel:', value: target?.name || 'Unknown', inline: true },
                        { name: 'Moderator:', value: executor?.tag || 'Unknown', inline: true }
                    );
                break;
                
            case AuditLogEvent.ChannelCreate:
                embed
                    .setTitle("➕ Channel Created")
                    .addFields(
                        { name: 'Channel:', value: target?.name || 'Unknown', inline: true },
                        { name: 'Moderator:', value: executor?.tag || 'Unknown', inline: true }
                    );
                break;
                
            case AuditLogEvent.ChannelDelete:
                embed
                    .setTitle("➖ Channel Deleted")
                    .addFields(
                        { name: 'Channel Name:', value: auditLogEntry.extra?.name || 'Unknown', inline: true },
                        { name: 'Moderator:', value: executor?.tag || 'Unknown', inline: true }
                    );
                break;
                
            default:
                return; // Don't log other events
        }
        
        // Send log if embed has fields
        if (embed.data.fields && embed.data.fields.length > 0) {
            await logChannel.send({ embeds: [embed] });
        }
        
    } catch (err) {
        console.error('[AuditLog] Error:', err.message);
    }
});

// ================================
// WELCOME | MESSAGE | ADD ROLE
// ================================
client.on('guildMemberAdd', async member => {
    try {
        // ================================
        // SAFEMODE | ADD ROLE
        // ================================
        const roleId = '1033463588934918164';
        try {
            const role = await member.guild.roles.fetch(roleId);
            if (role) {
                if (!member.roles.cache.has(roleId)) {
                    await member.roles.add(role);
                    console.log(`✅ Role "${role.name}" given to ${member.user.tag}`);
                    
                    // Update stats when member joins
                    setTimeout(() => updateStatsEmbed(member.guild), 5000);
                }
            } else {
                console.warn(`❌ Role not found: ${roleId}`);
            }
        } catch (err) {
            console.error(`❌ Could not add role to ${member.user.tag}:`, err.message);
        }

        // ================================
        // WELCOME | MESSAGE
        // ================================
        const welcomeChannel = await client.channels.fetch(CHANNEL_WELCOME);

        const welcomeText = `
# ─── ✦ W E L C O M E ✦ ───
**<:CVW:1371269829847289876> SIIIN PATCHES & EXTRA**

${member}, Welcome to our server! <:CVW:1371269829847289876>
Enjoy your stay and check out the links below!
▫▫▫▫ **C H E C K** ▫▫▫▫

# ─── ✦ INFORMATION ✦ ───
<:cryengine:1033530974107091035> [Information](https://discord.com/channels/1033462383798140981/1033506664810287134/1440058017545584871)
<:cryengine:1033530974107091035> [Rules](https://discord.com/channels/1033462383798140978/1177257234787471422/1468570201095274552)
<:cryengine:1033530974107091035> [Announcements](https://discord.com/channels/1033462383798140981/1237650687249092670)
<:cryengine:1033530974107091035> [Search](https://discord.com/channels/1033462383798140981/1376910830490095798/1376912016517763094)
<:cryengine:1033530974107091035> [Games List](https://discord.com/channels/1033462383798140981/1376904260842819685/1409551551818760204)
<:cryengine:1033530974107091035> [Crysis and Crysis Warhead](https://discord.com/channels/1033462383798140981/1371242516556415098/1371242762417995776)
<:cryengine:1033530974107091035> [Crysis Remastered](https://discord.com/channels/1033462383798140981/1372560937000763484/1372565847591092385)

# ─── ✦ PLATFORMS ✦ ───
**STEAM | GOG | EA | UBISOFT | CD-ROM**

# ─── ✦ SUPPORT ✦ ───
**Check 1st the [Support rules](https://discord.com/channels/1033462383798140978/1379581746466783385/1379582509062426754) ► Then use ► The <#1468090646442279206> system.

# ─── ✦ DONATIONS ✦ ───
To support us, please feel free to donate a bit. [Just Here](https://discord.com/channels/1033462383798140981/1178517213444046948/1351344918546874461)
[Paypal Direct link](https://www.paypal.com/paypalme/LunaSiiin?)
`;

        await welcomeChannel.send({ content: welcomeText });

    } catch (err) {
        console.error('[Welcome] Error:', err.message);
    }
});

// ================================
// MESSAGE FILTER FOR ALL CHANNELS
// ================================
client.on('messageCreate', async message => {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;
    
    // Check for automod violations
    const isViolation = await handleAutomod(message);
    if (isViolation) return;
    
    // Chat reminder system
    if (message.channel.id === CHAT_CHANNEL_ID && !STAFF_IDS.includes(message.author.id)) {
        // Update chat reminder after a short delay
        setTimeout(() => updateChatReminder(message.channel), 1000);
    }
    
    // Ticket channel filter (existing code)
    if (message.channel.name.startsWith('ticket-') && !STAFF_IDS.includes(message.author.id)) {
        const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;
        const linkRegex = /(https?:\/\/[^\s]+)/i;

        if (linkRegex.test(message.content) && !youtubeRegex.test(message.content)) {
            await message.delete().catch(() => {});
            const warnMsg = await message.channel.send({
                content: `<@${message.author.id}> ❌ Only YouTube links are allowed.`,
                allowedMentions: { users: [message.author.id] }
            });
            setTimeout(() => warnMsg.delete().catch(() => {}), 7000);
            return;
        }

        for (const att of message.attachments.values()) {
            const ext = att.name?.substring(att.name.lastIndexOf('.')).toLowerCase();
            if (ext && !ALLOWED_FILE_EXTENSIONS.includes(ext)) {
                await message.delete().catch(() => {});
                const warnMsg = await message.channel.send({
                    content: `<@${message.author.id}> ❌ File type not allowed: ${ext}`,
                    allowedMentions: { users: [message.author.id] }
                });
                setTimeout(() => warnMsg.delete().catch(() => {}), 7000);
                break;
            }
        }
    }
});

// ================================
// TICKETS | SUPPORT
// ================================
async function sendTicketEmbed() {
    try {
        const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID);
        if (!channel) {
            console.warn("❌ Support channel not found!");
            return;
        }

        // Delete previous bot messages
        const messages = await channel.messages.fetch({ limit: 10 });
        for (const [, msg] of messages.filter(m => m.author.id === client.user.id)) {
            await msg.delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setTitle("🎫 Support / Tickets")
            .setDescription(
`**Push the button to create a ticket**
Our staff will answer as soon as possible.
**Do not Tag us** or the ticket will be deleted!
**Youtube links and images/videos allowed, other links/files blocked**`
            )
            .setColor(0x00FF99)
            .setFooter({ text: 'SIIIN Support • Click below' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('Open a ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫')
            );

        await channel.send({ embeds: [embed], components: [row] });
        console.log("✅ Ticket creation message sent!");
        
    } catch (err) {
        console.error('[SendTicketEmbed] Error:', err.message);
    }
}

// ================================
// TICKETS | INTERACTIONS
// ================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const guild = interaction.guild;
    const user = interaction.user;
    const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

    // ----------------------------
    // OPEN TICKET
    // ----------------------------
    if (interaction.customId === 'open_ticket') {
        const existing = guild.channels.cache.find(c => c.name === `ticket-${user.id}`);
        if (existing) {
            return interaction.reply({ 
                content: "❌ You already have an open Ticket!", 
                ephemeral: true 
            });
        }

        try {
            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.id}`,
                type: 0,
                parent: TICKET_CATEGORY_ID,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AttachFiles
                        ]
                    },
                    ...STAFF_IDS.map(id => ({
                        id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageMessages
                        ]
                    })),
                    { 
                        id: BOT_ID, 
                        allow: [
                            PermissionFlagsBits.ViewChannel, 
                            PermissionFlagsBits.SendMessages, 
                            PermissionFlagsBits.ManageMessages
                        ] 
                    },
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`🎫 Ticket open for ${user.username}`)
                .setDescription(
`Choose a category:
**SUPPORT** > Need Help about a game
**REQUEST** > Seek to add another game
**OTHER** > None of the previous choices`
                )
                .setColor(0x00FF99)
                .setFooter({ text: 'Select an option below' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_support')
                        .setLabel('SUPPORT')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🎮'),
                    new ButtonBuilder()
                        .setCustomId('ticket_request')
                        .setLabel('REQUEST')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📦'),
                    new ButtonBuilder()
                        .setCustomId('ticket_other')
                        .setLabel('OTHER')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❓'),
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('CLOSE')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

            await ticketChannel.send({ 
                content: `<@${user.id}>`, 
                embeds: [embed], 
                components: [row] 
            });
            
            await interaction.reply({ 
                content: `✅ Your ticket has been created: ${ticketChannel}`, 
                ephemeral: true 
            });

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle("📂 Ticket opened")
                    .setColor(0x00FF99)
                    .setDescription(`**User:** ${user.tag} (${user.id})\n**Channel:** ${ticketChannel.name}`)
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
            
        } catch (err) {
            console.error('[OpenTicket] Error:', err.message);
            await interaction.reply({ 
                content: "❌ Error creating ticket", 
                ephemeral: true 
            });
        }
    }

    // ----------------------------
    // TICKET CATEGORY BUTTONS
    // ----------------------------
    if (['ticket_support','ticket_request','ticket_other'].includes(interaction.customId)) {
        await interaction.deferReply({ ephemeral: true });

        let templateEmbed = new EmbedBuilder();
        let categoryName = '';
        
        if (interaction.customId === 'ticket_support') {
            categoryName = 'Support';
            templateEmbed
                .setTitle("🎮 Support Template")
                .setColor(0x00FF99)
                .setDescription(
`- Game = 
- OS = 
- GPU = 
- CPU = 
- RAM = 
- Drive =
- Describe what you need =`
                );
        } else if (interaction.customId === 'ticket_request') {
            categoryName = 'Request';
            templateEmbed
                .setTitle("📦 Request Template")
                .setColor(0x0099FF)
                .setDescription(
`- GAME NAME = 
- RELEASE YEAR = 
- O / R = # Original or Remastered, if the game hasn't Remaster, just type : "/"
- REASON = # Explain why you need it / If it can be helpful for other people`
                );
        } else if (interaction.customId === 'ticket_other') {
            categoryName = 'Other';
            templateEmbed
                .setTitle("❓ Other Template")
                .setColor(0xFFAA00)
                .setDescription("Describe why did you open the ticket, please.");
        }

        // Update buttons (keep only "CLOSE")
        try {
            if (interaction.message.editable) {
                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('CLOSE')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒')
                    );
                await interaction.message.edit({ components: [newRow] });
            }
        } catch (err) {
            console.error('[TicketCategory] Error buttons:', err.message);
        }

        await interaction.followUp({ 
            embeds: [templateEmbed], 
            ephemeral: false 
        });
        
        try {
            await user.send(`Your template has been posted in the ticket, copy it, paste it, and complete it: <#${interaction.channel.id}>`);
        } catch (err) {
            // DMs closed, ignore
        }
    }

    // ----------------------------
    // CLOSE TICKET
    // ----------------------------
    if (interaction.customId === 'close_ticket') {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.channel;

        await interaction.editReply({ 
            content: "🕐 Ticket will be deleted in 1 minute." 
        });

        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle("🗑️ Close ticket")
                .setColor(0xFF0000)
                .setDescription(`**User:** ${user.tag} (${user.id})\n**Channel:** ${channel.name}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }

        // Confirmation message
        await channel.send({
            content: `🔒 Ticket closed by <@${user.id}>. Deletion in 60 seconds...`,
            allowedMentions: { users: [user.id] }
        });

        // Delete after delay
        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (err) {
                console.error('[CloseTicket] Error deletion:', err.message);
            }
        }, 60000);
    }
});

// ================================
// MEMBER LEAVE/UPDATE HANDLING
// ================================
client.on('guildMemberRemove', async member => {
    // Update stats when member leaves
    setTimeout(() => updateStatsEmbed(member.guild), 5000);
});

// ================================
// DISCORD | CLIENT READY
// ================================
client.on('ready', async () => {
    console.log(`🤖 Bot connected: ${client.user.tag} (${client.user.id})`);
    console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);

    // Send initial messages
    await sendTicketEmbed();
    await sendDonationMessage();
    await sendInformationMessage();
    
    // Initialize chat reminder
    const chatChannel = await client.channels.fetch(CHAT_CHANNEL_ID).catch(() => null);
    if (chatChannel) {
        await updateChatReminder(chatChannel);
    }

    try {
        const BOT_VERSION = "3.0.0.1";
        const CURRENT_CHANGELOG = `
# VERSION 3.0.0.1 - MAJOR UPDATE:
• Added Free-to-Play games channel with Steam API
• Complete automoderation system with multi-language detection
• Ban logging system with immediate actions for dangerous content
• Audit log monitoring for all moderation actions
• Enhanced chat reminder system
• Information and donation messages automation
• Stats update only on member join/leave
• Fixed duplicate posting prevention
• YouTube-only link filter for all channels
• Dangerous link detection (Nitro scams, hack tools, etc.)
• User warning system with progressive bans
• Staff bypass for all automod systems
• Railway health check improvements
• Performance optimizations and error handling

# SECURITY FEATURES:
• 3-strike warning system before ban
• Immediate ban for dangerous links
• Message purge for banned users
• Audit log tracking for transparency
• Multi-language profanity filter

# API INTEGRATIONS:
• Steam API for free games and promotions
• Epic Games Store free games
• CheapShark backup for promotions
• SteamSpy for free-to-play games data`;

        // Only log if version changed
        if (lastVersionLogged !== BOT_VERSION) {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle("🚀 Bot Online / Restarted")
                    .setColor("#00FF00")
                    .setDescription(`**Release:** ${BOT_VERSION}\n\n**Changelog:**\n${CURRENT_CHANGELOG}`)
                    .addFields(
                        { name: '👥 Servers', value: `${client.guilds.cache.size}`, inline: true },
                        { name: '📅 Date', value: new Date().toLocaleDateString('en-US'), inline: true },
                        { name: '⏰ Time', value: new Date().toLocaleTimeString('en-US'), inline: true },
                        { name: '🛡️ Security', value: 'Automod Active', inline: false },
                        { name: '🎮 APIs', value: 'Steam + Epic + CheapShark', inline: false }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }
            lastVersionLogged = BOT_VERSION;
        }
    } catch (err) {
        console.error("❌ Startup logs error:", err.message);
    }

    // Initial update
    await updateAll();
    
    // Heartbeat every minute
    setInterval(() => {
        console.log('🟢 Bot alive:', new Date().toLocaleTimeString('en-US'));
    }, 60000);
    
    // Auto update every 30 minutes
    setInterval(updateAll, 30 * 60 * 1000);
    
    // Update stats initially
    const guilds = client.guilds.cache;
    for (const guild of guilds.values()) {
        await updateStatsEmbed(guild);
    }
});

// ================================
// SOFT RESTART SYSTEM
// ================================
const hours = Number(process.env.AUTO_REBOOT_HOURS || 24);
const REBOOT_DELAY = hours * 60 * 60 * 1000;

console.log(`⏱️ Autorestart every ${hours}h`);

async function softRestart() {
    console.log('🔄 Soft restart of functions...');
    try {
        // Clear caches but keep user warnings
        postedGames.clear();
        postedPromos.clear();
        postedFreeToPlay.clear();
        platformPromosCache.clear();
        
        // Re-update content
        await updateAll();
        await sendTicketEmbed();
        
        console.log('✅ Soft restart completed');
    } catch (err) {
        console.error('❌ Soft restart error:', err.message);
    }
}

// Periodic soft restart
if (hours > 0) {
    setInterval(softRestart, REBOOT_DELAY);
}

// Railway SIGTERM handling
process.on("SIGTERM", async () => {
    console.log('🛑 SIGTERM signal received (Railway)...');
    try {
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle("⚠️ Railway Maintenance")
                .setColor(0xFF9900)
                .setDescription("The bot is restarting due to Railway maintenance.")
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        // Ignore if error
    }
    process.exit(0);
});

// ================================
// DISCORD | CLIENT LOGIN
// ================================
client.login(process.env.BOT_TOKEN).catch(err => {
    console.error('❌ Discord connection error:', err.message);
    process.exit(1);
});

// ================================
// END OF SIIIN CORE
// ================================
