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

const { delay, truncateText } = require('../../utils/helpers');
const API_CONFIG = require('../../config/apiConfig');

async function safeFetchJson(url, timeout = 15000) {
    if (!fetch) {
        console.error('❌ fetch not initialized');
        return null;
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

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            console.error(`[FetchJson] Non-JSON response for ${url}`);
            return null;
        }

        return await res.json();
    } catch (err) {
        console.error('[FetchJson] Error:', err.message);
        return null;
    }
}

async function fetchSteamPromos() {
    const data = await safeFetchJson(`${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.FEATURED}`, 15000);
    const specials = data?.specials?.items || [];

    return specials
        .map(game => {
            const discountPercent = Math.round(Number(game.discount_percent || 0));
            const finalPrice = Number(game.final_price || 0) / 100;
            const originalPrice = Number(game.original_price || 0) / 100;

            return {
                id: `steam_${game.id}_${discountPercent}_${finalPrice.toFixed(2)}`,
                title: game.name,
                url: `https://store.steampowered.com/app/${game.id}`,
                image: game.large_capsule_image || game.small_capsule_image,
                price: finalPrice.toFixed(2),
                normalPrice: originalPrice.toFixed(2),
                discountPercent,
                type: 'promo',
                store: 'steam',
                sourceLabel: 'Steam',
                description: truncateText(game.detailed_description || '', 300)
            };
        })
        .filter(game => game.discountPercent >= 40 && Number(game.price) > 0);
}

async function fetchCheapSharkStorePromos(storeId, storeName) {
    const data = await safeFetchJson(
        `${API_CONFIG.CHEAP_SHARK.BASE_URL}/deals?storeID=${storeId}&upperPrice=20&pageSize=20`,
        10000
    );

    if (!Array.isArray(data)) return [];

    return data
        .filter(game => {
            const normalPrice = parseFloat(game.normalPrice || '0');
            const salePrice = parseFloat(game.salePrice || '0');
            if (!normalPrice || !Number.isFinite(normalPrice) || !Number.isFinite(salePrice)) return false;
            const discount = ((normalPrice - salePrice) / normalPrice) * 100;
            return discount >= 40 && salePrice > 0 && salePrice <= 20;
        })
        .map(game => {
            const normalPrice = parseFloat(game.normalPrice);
            const salePrice = parseFloat(game.salePrice);
            const discountPercent = Math.round(((normalPrice - salePrice) / normalPrice) * 100);
            const title = game.title || 'Unknown title';
            const storeLabels = {
                'cheapshark-steam': 'CS Steam',
                'cs-gog': 'CS GOG',
                'cs-epic': 'CS EpicGames',
                'cs-ea': 'CS EA',
                'cs-ubisoft': 'CS Ubisoft'
            };

            const url = storeName === 'cs-gog'
                ? `https://www.gog.com/en/games?query=${encodeURIComponent(title)}`
                : `https://www.cheapshark.com/redirect?dealID=${game.dealID}`;

            return {
                id: `${storeName}_${game.dealID}`,
                title,
                url,
                image: game.thumb,
                price: salePrice.toFixed(2),
                normalPrice: normalPrice.toFixed(2),
                discountPercent,
                type: 'promo',
                store: storeName,
                sourceLabel: storeLabels[storeName] || 'CheapShark',
                steamRating: game.steamRatingText || 'N/A',
                description: 'Limited time promotion.'
            };
        });
}

async function fetchAllPromos() {
    console.log('🔄 Fetching promotions from all platforms...');

    if (!fetch) {
        console.error('❌ fetch not initialized yet, waiting...');
        await delay(1000);
        if (!fetch) return [];
    }

    const allPromos = [];
    const seenKeys = new Set();

    try {
        const batches = await Promise.all([
            fetchSteamPromos(),
            fetchCheapSharkStorePromos(API_CONFIG.CHEAP_SHARK.STORES.STEAM, 'cheapshark-steam'),
            fetchCheapSharkStorePromos(API_CONFIG.CHEAP_SHARK.STORES.GOG, 'cs-gog'),
            fetchCheapSharkStorePromos(API_CONFIG.CHEAP_SHARK.STORES.EPIC, 'cs-epic'),
            fetchCheapSharkStorePromos(API_CONFIG.CHEAP_SHARK.STORES.EA, 'cs-ea'),
            fetchCheapSharkStorePromos(API_CONFIG.CHEAP_SHARK.STORES.UBISOFT, 'cs-ubisoft')
        ]);

        for (const promos of batches) {
            for (const promo of promos) {
                const dedupeKey = `${promo.title.toLowerCase()}_${promo.store}_${promo.price}_${promo.discountPercent}`;
                if (seenKeys.has(dedupeKey)) continue;
                seenKeys.add(dedupeKey);
                allPromos.push(promo);
            }
        }
    } catch (err) {
        console.error('[AllPromos] Global error:', err.message);
    }

    console.log(`✅ ${allPromos.length} promotions found`);
    return allPromos;
}

module.exports = {
    fetchSteamPromos,
    fetchCheapSharkStorePromos,
    fetchAllPromos
};
