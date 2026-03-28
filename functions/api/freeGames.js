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

        return await res.json();
    } catch (err) {
        console.error('[FetchJson] Error:', err.message);
        return null;
    }
}

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
            platform: game.platforms,
            type: 'free',
            store: 'epic',
            worth: game.worth && game.worth !== 'N/A' ? `Value: ${game.worth}` : '',
            endDate: game.end_date && game.end_date !== 'N/A'
                ? `Until: ${new Date(game.end_date).toLocaleDateString('en-US')}`
                : ''
        }))
        .filter(game => game.title && game.url);
}

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

            freeGames.push({
                id: `steam_free_${game.id}`,
                title: game.name,
                url: `https://store.steampowered.com/app/${game.id}`,
                image: game.large_capsule_image || game.small_capsule_image,
                description: truncateText(game.detailed_description || 'Free game on Steam', 400),
                platform: 'Steam',
                type: isFreeWeekend ? 'free_weekend' : 'free',
                store: 'steam',
                originalPrice: originalPrice > 0 ? `$${(originalPrice / 100).toFixed(2)}` : 'Free-to-Play',
                discountPercent: isFreeWeekend ? 100 : 0
            });
        }
    }

    return freeGames.slice(0, 10);
}

async function fetchFreeToPlayGames() {
    const data = await safeFetchJson(`${API_CONFIG.STEAMSPY.BASE_URL}?request=top100in2weeks`, 15000);
    if (!data || typeof data !== 'object') return [];

    const freeToPlayGames = [];
    const entries = Object.entries(data)
        .map(([appId, game]) => ({ appId, ...game }))
        .sort((a, b) => Number(b.players_2weeks || 0) - Number(a.players_2weeks || 0));

    for (const entry of entries) {
        if (freeToPlayGames.length >= 10) break;

        try {
            const detailsData = await safeFetchJson(
                `${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.APP_DETAILS(entry.appId)}`,
                10000
            );

            const details = detailsData?.[entry.appId]?.data;
            if (!details) continue;

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
                website: details.website || null
            });

            await delay(250);
        } catch (err) {
            console.error(`[FreeToPlay] Error fetching details for ${entry.appId}:`, err.message);
        }
    }

    return freeToPlayGames;
}

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
        console.log('📥 Fetching Epic Games...');
        const epicGames = await fetchEpicFreeGames();
        for (const game of epicGames) {
            const hash = generateGameHash(game.title, '0', 'epic');
            if (seenHashes.has(hash)) continue;
            seenHashes.add(hash);
            allGames.push(game);
        }

        await delay(1000);

        console.log('📥 Fetching Steam...');
        const steamGames = await fetchSteamFreeGames();
        for (const game of steamGames) {
            const hash = generateGameHash(game.title, '0', 'steam');
            if (seenHashes.has(hash)) continue;
            seenHashes.add(hash);
            allGames.push(game);
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
    fetchFreeToPlayGames,
    fetchAllFreeGames
};
