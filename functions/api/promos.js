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

// Simple approximate conversion USD -> EUR
const usdToEur = (usd) => Math.round((usd * 0.92) * 100) / 100;

async function safeFetchJson(url, timeout = 15000) {
    if (!fetch) return null;
    try {
        const res = await fetch(url, { headers: API_CONFIG.API_HEADERS, timeout });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

async function fetchSteamPromos() {
    const data = await safeFetchJson(`${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.FEATURED}`, 15000);
    const specials = data?.specials?.items || [];

    return specials
        .map(game => {
            const discountPercent = Math.round(Number(game.discount_percent || 0));
            const finalPriceUSD = Number(game.final_price || 0) / 100;
            const originalPriceUSD = Number(game.original_price || 0) / 100;

            return {
                id: `steam_${game.id}_${discountPercent}_${finalPriceUSD.toFixed(2)}`,
                title: game.name,
                url: `https://store.steampowered.com/app/${game.id}`,
                image: game.large_capsule_image || game.small_capsule_image,
                priceUSD: finalPriceUSD.toFixed(2),
                originalPriceUSD: originalPriceUSD.toFixed(2),
                priceEUR: usdToEur(finalPriceUSD).toFixed(2),
                originalPriceEUR: usdToEur(originalPriceUSD).toFixed(2),
                discountPercent,
                type: 'promo',
                store: 'steam',
                sourceLabel: 'Steam',
                description: truncateText(game.detailed_description || '', 300)
            };
        })
        .filter(game => game.discountPercent >= 40 && Number(game.priceUSD) > 0);
}

async function fetchCheapSharkStorePromos(storeId, storeName) {
    const data = await safeFetchJson(
        `${API_CONFIG.CHEAP_SHARK.BASE_URL}/deals?storeID=${storeId}&upperPrice=20&pageSize=20`,
        10000
    );
    if (!Array.isArray(data)) return [];

    return data
        .filter(game => {
            const normal = parseFloat(game.normalPrice || '0');
            const sale = parseFloat(game.salePrice || '0');
            return normal > 0 && sale > 0;
        })
        .map(game => {
            const normalUSD = parseFloat(game.normalPrice);
            const saleUSD = parseFloat(game.salePrice);
            const discount = Math.round(((normalUSD - saleUSD) / normalUSD) * 100);

            return {
                id: `${storeName}_${game.dealID}`,
                title: game.title || 'Unknown title',
                url: `https://www.cheapshark.com/redirect?dealID=${game.dealID}`,
                image: game.thumb,
                priceUSD: saleUSD.toFixed(2),
                originalPriceUSD: normalUSD.toFixed(2),
                priceEUR: usdToEur(saleUSD).toFixed(2),
                originalPriceEUR: usdToEur(normalUSD).toFixed(2),
                discountPercent: discount,
                type: 'promo',
                store: storeName,
                sourceLabel: storeName,
            };
        });
}

async function fetchAllPromos() {
    console.log('🔄 Fetching promotions...');
    if (!fetch) { await delay(800); if (!fetch) return []; }

    const batches = await Promise.all([
        fetchSteamPromos(),
        fetchCheapSharkStorePromos(API_CONFIG.CHEAP_SHARK.STORES.STEAM, 'cheapshark-steam'),
        fetchCheapSharkStorePromos(API_CONFIG.CHEAP_SHARK.STORES.GOG, 'cs-gog'),
        fetchCheapSharkStorePromos(API_CONFIG.CHEAP_SHARK.STORES.EA, 'cs-ea'),
        fetchCheapSharkStorePromos(API_CONFIG.CHEAP_SHARK.STORES.UBISOFT, 'cs-ubisoft')
    ]);

    const allPromos = [];
    const seen = new Set();
    for (const promos of batches) {
        for (const p of promos) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                allPromos.push(p);
            }
        }
    }
    console.log(`✅ ${allPromos.length} promotions found`);
    return allPromos;
}

module.exports = {
    fetchSteamPromos,
    fetchCheapSharkStorePromos,
    fetchAllPromos
};