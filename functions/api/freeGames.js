let fetch;

(async () => {
    try {
        fetch = (await import('node-fetch')).default;
    } catch (err) {
        console.error('❌ Failed to load node-fetch:', err.message);
        if (typeof globalThis.fetch === 'function') {
            fetch = globalThis.fetch;
        }
    }
})();

const { delay, truncateText, generateGameHash } = require('../../utils/helpers');
const API_CONFIG = require('../../config/apiConfig');

function isAdultGame(details) {
    if (!details) return false;
    if (details.required_age && details.required_age >= 18) return true;
    const descriptors = details.content_descriptors?.ids || [];
    const adultIds = [1, 2, 3, 4, 5];
    return descriptors.some(id => adultIds.includes(id));
}

async function safeFetchJson(url, timeout = 15000) {
    if (!fetch) {
        await delay(800);
        if (!fetch) return null;
    }

    try {
        const res = await fetch(url, {
            headers: API_CONFIG.API_HEADERS,
            timeout
        });

        if (!res.ok) {
            console.error(`[HTTP] ${res.status} for ${url}`);
            return null;
        }

        return await res.json();
    } catch (err) {
        console.error('[FetchJson] Error:', err.message);
        return null;
    }
}

// ==================== EPIC GAMES ====================
async function fetchEpicFreeGames() {
    const data = await safeFetchJson(`${API_CONFIG.GAMER_POWER.BASE_URL}${API_CONFIG.GAMER_POWER.EPIC_GAMES}`, 10000);
    if (!Array.isArray(data)) return [];

    return data
        .filter(game => {
            const platforms = String(game.platforms || '').toLowerCase();
            return platforms.includes('epic') && game.open_giveaway_url;
        })
        .map(game => ({
            id: `epic_${game.id}`,
            title: game.title,
            url: game.open_giveaway_url,
            image: game.image,
            description: truncateText(game.description || '', 500),
            platform: 'Epic Games',
            type: 'free',
            store: 'epic',
            sourceLabel: 'Epic Games',
            worth: game.worth && game.worth !== 'N/A' ? `Value: ${game.worth}` : '',
            endDate: game.end_date && game.end_date !== 'N/A'
                ? `Until: ${new Date(game.end_date).toLocaleDateString('en-US')}`
                : '',
            isAdult: false
        }))
        .filter(game => game.title && game.url);
}

// ==================== STEAM FREE GAMES (avec vrais prix €) ====================
async function fetchSteamFreeGames() {
    const data = await safeFetchJson(`${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.FEATURED}`, 15000);
    if (!data) return [];

    const freeGames = [];
    const categories = [data?.specials, data?.coming_soon, data?.top_sellers, data?.new_releases];

    for (const category of categories) {
        if (!category?.items) continue;

        for (const game of category.items) {
            const finalPrice = Number(game.final_price ?? -1);
            const originalPrice = Number(game.original_price ?? -1);
            const isFreeWeekend = finalPrice === 0 && originalPrice > 0;
            const isPermanentFree = finalPrice === 0 && originalPrice === 0;

            if (!isFreeWeekend && !isPermanentFree) continue;

            let isAdult = false;
            let originalPriceUSD = originalPrice > 0 ? (originalPrice / 100).toFixed(2) : '0.00';
            let originalPriceEUR = 'N/A';

            try {
                // Vérification +18
                const detailsData = await safeFetchJson(
                    `${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.APP_DETAILS(game.id)}`,
                    8000
                );
                const details = detailsData?.[game.id]?.data;

                if (details) {
                    if (isAdultGame(details)) {
                        console.log(`🔞 +18 game excluded: ${game.name}`);
                        continue;
                    }

                    // Récupération du vrai prix d'origine en EUR
                    if (originalPrice > 0 && details.price_overview) {
                        // On refait un appel avec cc=eur pour avoir le vrai prix en euro
                        const eurData = await safeFetchJson(
                            `${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.APP_DETAILS(game.id)}&cc=eur`,
                            8000
                        );
                        const eurPrice = eurData?.[game.id]?.data?.price_overview;

                        if (eurPrice) {
                            originalPriceEUR = (eurPrice.initial / 100).toFixed(2);
                        }
                    }
                }
            } catch (e) {}

            freeGames.push({
                id: `steam_free_${game.id}`,
                title: game.name,
                url: `https://store.steampowered.com/app/${game.id}`,
                image: game.large_capsule_image || game.small_capsule_image,
                description: truncateText(game.detailed_description || 'Free game on Steam', 400),
                platform: 'Steam',
                type: isFreeWeekend ? 'free_weekend' : 'free',
                store: 'steam',
                sourceLabel: 'Steam',
                originalPriceUSD: originalPriceUSD,
                originalPriceEUR: originalPriceEUR,
                discountPercent: isFreeWeekend ? 100 : 0,
                isAdult: false
            });
        }
    }

    return freeGames.slice(0, 10);
}

// ==================== CHEAPSHARK FREE GAMES ====================
async function fetchCheapSharkFreeGames(storeId, storeKey) {
    const data = await safeFetchJson(
        `${API_CONFIG.CHEAP_SHARK.BASE_URL}/deals?storeID=${storeId}&upperPrice=0&pageSize=20`,
        10000
    );

    if (!Array.isArray(data)) return [];

    return data
        .filter(game => {
            const normalPrice = parseFloat(game.normalPrice || '0');
            const salePrice = parseFloat(game.salePrice || '0');
            return Number.isFinite(normalPrice) && Number.isFinite(salePrice) && normalPrice > 0 && salePrice === 0;
        })
        .map(game => {
            const title = game.title || 'Unknown title';
            const url = storeKey === 'cs-gog'
                ? `https://www.gog.com/en/games?query=${encodeURIComponent(title)}`
                : `https://www.cheapshark.com/redirect?dealID=${game.dealID}`;

            return {
                id: `${storeKey}_${game.dealID}`,
                title,
                url,
                image: game.thumb,
                description: 'Temporarily free game detected by CheapShark.',
                platform: storeKey === 'cs-ea' ? 'EA' : storeKey === 'cs-ubisoft' ? 'Ubisoft' : storeKey === 'cs-gog' ? 'GOG' : 'Store',
                type: 'free',
                store: storeKey,
                sourceLabel: {
                    'cs-gog': 'CS GOG',
                    'cs-ea': 'CS EA',
                    'cs-ubisoft': 'CS Ubisoft',
                    'cs-steam': 'CS Steam',
                    'cs-epic': 'CS EpicGames'
                }[storeKey] || 'CheapShark',
                originalPriceUSD: parseFloat(game.normalPrice || '0').toFixed(2),
                originalPriceEUR: 'N/A',
                isAdult: false
            };
        });
}

// ==================== FREE TO PLAY ====================
async function fetchFreeToPlayGames() {
    console.log('🔄 Fetching Free-to-Play games...');

    const data = await safeFetchJson(`${API_CONFIG.STEAMSPY.BASE_URL}?request=top100in2weeks`, 15000);
    if (!data || typeof data !== 'object') {
        console.log('❌ SteamSpy data invalid or empty');
        return [];
    }

    const entries = Object.entries(data)
        .map(([appId, game]) => ({ appId, ...game }))
        .sort((a, b) => Number(b.players_2weeks || 0) - Number(a.players_2weeks || 0));

    const freeToPlayGames = [];
    let checked = 0;

    for (const entry of entries) {
        if (freeToPlayGames.length >= 15) break;
        checked++;

        try {
            const detailsData = await safeFetchJson(
                `${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.APP_DETAILS(entry.appId)}`,
                10000
            );

            const details = detailsData?.[entry.appId]?.data;
            if (!details) continue;

            if (isAdultGame(details)) {
                console.log(`🔞 +18 Free-to-Play game excluded: ${details.name}`);
                continue;
            }

            const isGame = details.type === 'game';
            const isFree = details.is_free === true;
            const hasRealStorePage = Boolean(details.steam_appid && details.name && details.header_image);

            if (!isGame || !isFree || !hasRealStorePage) continue;

            freeToPlayGames.push({
                id: `freetoplay_${entry.appId}`,
                title: details.name,
                url: `https://store.steampowered.com/app/${entry.appId}`,
                image: details.header_image || details.capsule_image,
                description: truncateText(details.short_description || details.detailed_description || 'Free-to-play game on Steam', 500),
                platform: 'Steam',
                type: 'freetoplay',
                store: 'steam',
                players: Number(entry.players_2weeks || 0),
                trailer: Array.isArray(details.movies) && details.movies[0]?.mp4?.max ? details.movies[0].mp4.max : null,
                website: details.website || null,
                isAdult: false
            });

            await delay(300);
        } catch (err) {
            console.error(`[FreeToPlay] Error checking app ${entry.appId}:`, err.message);
        }
    }

    console.log(`✅ ${freeToPlayGames.length} Free-to-Play games found (checked ${checked} games)`);
    return freeToPlayGames;
}

// ==================== ALL FREE GAMES ====================
async function fetchAllFreeGames() {
    console.log('🔄 Fetching free games...');

    if (!fetch) {
        console.error('❌ fetch not initialized yet, waiting...');
        await delay(1000);
        if (!fetch) return [];
    }

    const allGames = [];
    const seenHashes = new Set();

    try {
        const batches = await Promise.all([
            fetchEpicFreeGames(),
            fetchSteamFreeGames(),
            fetchCheapSharkFreeGames(API_CONFIG.CHEAP_SHARK.STORES.GOG, 'cs-gog'),
            fetchCheapSharkFreeGames(API_CONFIG.CHEAP_SHARK.STORES.EA, 'cs-ea'),
            fetchCheapSharkFreeGames(API_CONFIG.CHEAP_SHARK.STORES.UBISOFT, 'cs-ubisoft')
        ]);

        for (const games of batches) {
            for (const game of games) {
                const hash = generateGameHash(game.title, '0', game.store);
                if (seenHashes.has(hash)) continue;
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

module.exports = {
    fetchEpicFreeGames,
    fetchSteamFreeGames,
    fetchCheapSharkFreeGames,
    fetchFreeToPlayGames,
    fetchAllFreeGames
};
