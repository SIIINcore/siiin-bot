let fetch;

(async () => {
    try {
        fetch = (await import('node-fetch')).default;
    } catch (err) {
        if (typeof globalThis.fetch === 'function') fetch = globalThis.fetch;
    }
})();

const { delay, truncateText } = require('../../utils/helpers');
const API_CONFIG = require('../../config/apiConfig');

const usdToEur = (usd) => Math.round((usd * 0.92) * 100) / 100;

async function safeFetchJson(url, timeout = 15000) {
    if (!fetch) return null;
    try {
        const res = await fetch(url, { headers: API_CONFIG.API_HEADERS, timeout });
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; }
}

async function fetchEpicFreeGames() {
    const data = await safeFetchJson(`${API_CONFIG.GAMER_POWER.BASE_URL}${API_CONFIG.GAMER_POWER.EPIC_GAMES}`, 10000);
    if (!Array.isArray(data)) return [];

    return data
        .filter(g => String(g.platforms || '').toLowerCase().includes('epic') && g.open_giveaway_url)
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
            endDate: game.end_date || null
        }));
}

async function fetchSteamFreeGames() {
    const data = await safeFetchJson(`${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.FEATURED}`, 15000);
    if (!data) return [];

    const freeGames = [];
    const categories = [data?.specials, data?.coming_soon, data?.top_sellers, data?.new_releases];

    for (const category of categories) {
        if (!category?.items) continue;
        for (const game of category.items) {
            const final = Number(game.final_price ?? -1);
            const original = Number(game.original_price ?? -1);
            if (final !== 0) continue;

            freeGames.push({
                id: `steam_free_${game.id}`,
                title: game.name,
                url: `https://store.steampowered.com/app/${game.id}`,
                image: game.large_capsule_image || game.small_capsule_image,
                description: truncateText(game.detailed_description || 'Free game on Steam', 400),
                platform: 'Steam',
                type: final === 0 && original > 0 ? 'free_weekend' : 'free',
                store: 'steam',
                sourceLabel: 'Steam',
                originalPriceUSD: original > 0 ? (original / 100).toFixed(2) : '0.00',
                originalPriceEUR: original > 0 ? usdToEur(original / 100).toFixed(2) : '0.00'
            });
        }
    }
    return freeGames.slice(0, 10);
}

async function fetchCheapSharkFreeGames(storeId, storeKey) {
    const data = await safeFetchJson(`${API_CONFIG.CHEAP_SHARK.BASE_URL}/deals?storeID=${storeId}&upperPrice=0&pageSize=20`, 10000);
    if (!Array.isArray(data)) return [];

    return data
        .filter(g => parseFloat(g.normalPrice) > 0 && parseFloat(g.salePrice) === 0)
        .map(game => {
            const originalUSD = parseFloat(game.normalPrice);
            return {
                id: `${storeKey}_${game.dealID}`,
                title: game.title,
                url: storeKey === 'cs-gog' 
                    ? `https://www.gog.com/en/games?query=${encodeURIComponent(game.title)}` 
                    : `https://www.cheapshark.com/redirect?dealID=${game.dealID}`,
                image: game.thumb,
                description: 'Temporarily free game',
                platform: storeKey.replace('cs-', '').toUpperCase(),
                type: 'free',
                store: storeKey,
                sourceLabel: storeKey,
                originalPriceUSD: originalUSD.toFixed(2),
                originalPriceEUR: usdToEur(originalUSD).toFixed(2)
            };
        });
}

async function fetchAllFreeGames() {
    console.log('🔄 Fetching free games...');
    if (!fetch) { await delay(1000); if (!fetch) return []; }

    const batches = await Promise.all([
        fetchEpicFreeGames(),
        fetchSteamFreeGames(),
        fetchCheapSharkFreeGames(API_CONFIG.CHEAP_SHARK.STORES.GOG, 'cs-gog'),
        fetchCheapSharkFreeGames(API_CONFIG.CHEAP_SHARK.STORES.EA, 'cs-ea'),
        fetchCheapSharkFreeGames(API_CONFIG.CHEAP_SHARK.STORES.UBISOFT, 'cs-ubisoft')
    ]);

    const all = [];
    const seen = new Set();
    for (const batch of batches) {
        for (const g of batch) {
            if (!seen.has(g.id)) {
                seen.add(g.id);
                all.push(g);
            }
        }
    }
    console.log(`✅ ${all.length} free games found`);
    return all;
}

module.exports = {
    fetchEpicFreeGames,
    fetchSteamFreeGames,
    fetchCheapSharkFreeGames,
    fetchAllFreeGames
};