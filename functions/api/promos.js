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

// ==================== SAFE FETCH ====================
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

// ==================== STEAM PROMOS (avec vrais prix €) ====================
async function fetchSteamPromos() {
    const data = await safeFetchJson(`${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.FEATURED}`, 15000);
    const specials = data?.specials?.items || [];

    const promos = [];

    for (const game of specials) {
        if (!game.discount_percent || game.discount_percent < 40) continue;

        const appId = game.id;
        let priceUSD = null;
        let priceEUR = null;
        let originalUSD = null;
        let originalEUR = null;

        try {
            // Prix en USD
            const usdData = await safeFetchJson(
                `${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.APP_DETAILS(appId)}&cc=us`,
                8000
            );
            const usdDetails = usdData?.[appId]?.data?.price_overview;

            if (usdDetails) {
                originalUSD = (usdDetails.initial / 100).toFixed(2);
                priceUSD = (usdDetails.final / 100).toFixed(2);
            }

            // Prix en EUR (vrai prix, pas conversion)
            const eurData = await safeFetchJson(
                `${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.APP_DETAILS(appId)}&cc=eur`,
                8000
            );
            const eurDetails = eurData?.[appId]?.data?.price_overview;

            if (eurDetails) {
                originalEUR = (eurDetails.initial / 100).toFixed(2);
                priceEUR = (eurDetails.final / 100).toFixed(2);
            }
        } catch (err) {
            console.error(`[SteamPromo] Error fetching prices for ${appId}:`, err.message);
        }

        // Si on n'a pas les prix EUR, on garde quand même le jeu
        promos.push({
            id: `steam_${appId}_${game.discount_percent}_${priceUSD}`,
            title: game.name,
            url: `https://store.steampowered.com/app/${appId}`,
            image: game.large_capsule_image || game.small_capsule_image,
            priceUSD: priceUSD || 'N/A',
            originalPriceUSD: originalUSD || 'N/A',
            priceEUR: priceEUR || 'N/A',
            originalPriceEUR: originalEUR || 'N/A',
            discountPercent: Math.round(Number(game.discount_percent || 0)),
            type: 'promo',
            store: 'steam',
            sourceLabel: 'Steam'
        });
    }

    return promos;
}

// ==================== CHEAPSHARK ====================
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
                priceEUR: 'N/A',           // CheapShark ne donne pas les prix EUR facilement
                originalPriceEUR: 'N/A',
                discountPercent: discount,
                type: 'promo',
                store: storeName,
                sourceLabel: storeName
            };
        });
}

// ==================== ALL PROMOS ====================
async function fetchAllPromos() {
    console.log('🔄 Fetching promotions with real EUR prices...');

    if (!fetch) {
        await delay(800);
        if (!fetch) return [];
    }

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
