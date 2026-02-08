// Utilisation de dynamic import pour node-fetch v3
let fetch;

// Dynamic import au démarrage
(async () => {
    try {
        fetch = (await import('node-fetch')).default;
    } catch (err) {
        console.error('❌ Failed to load node-fetch:', err.message);
        // Fallback à fetch global si disponible
        if (typeof globalThis.fetch === 'function') {
            fetch = globalThis.fetch;
        }
    }
})();

const { delay, truncateText, generateGameHash } = require('../../utils/helpers');
const API_CONFIG = require('../../config/apiConfig');

async function fetchEpicFreeGames() {
    if (!fetch) {
        console.error('❌ fetch not initialized');
        return [];
    }
    
    try {
        const res = await fetch(`${API_CONFIG.GAMER_POWER.BASE_URL}${API_CONFIG.GAMER_POWER.EPIC_GAMES}`, {
            headers: API_CONFIG.API_HEADERS,
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

async function fetchSteamFreeGames() {
    if (!fetch) {
        console.error('❌ fetch not initialized');
        return [];
    }
    
    try {
        const res = await fetch(`${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.FEATURED}`, {
            headers: API_CONFIG.API_HEADERS,
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

async function fetchFreeToPlayGames() {
    if (!fetch) {
        console.error('❌ fetch not initialized');
        return [];
    }
    
    try {
        const res = await fetch(`${API_CONFIG.STEAMSPY.BASE_URL}${API_CONFIG.STEAMSPY.ALL_GAMES}`, {
            headers: API_CONFIG.API_HEADERS,
            timeout: 15000
        });
        
        if (!res.ok) {
            console.error(`[FreeToPlay] HTTP Error: ${res.status}`);
            return [];
        }
        
        const data = await res.json();
        const freeToPlayGames = [];
        
        let count = 0;
        for (const appId in data) {
            const game = data[appId];
            if (game.price === "0" && game.name && count < 15) {
                try {
                    const detailsRes = await fetch(
                        `${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.APP_DETAILS(appId)}`,
                        { headers: API_CONFIG.API_HEADERS, timeout: 10000 }
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
                    
                    await delay(500);
                } catch (err) {
                    console.error(`[FreeToPlay] Error fetching details for ${appId}:`, err.message);
                }
            }
        }
        
        freeToPlayGames.sort((a, b) => b.players - a.players);
        return freeToPlayGames.slice(0, 10);
        
    } catch (err) {
        console.error('[FreeToPlay] API Error:', err.message);
        return [];
    }
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
            if (!seenHashes.has(hash)) {
                seenHashes.add(hash);
                allGames.push(game);
            }
        }
        
        await delay(1000);
        
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

module.exports = {
    fetchEpicFreeGames,
    fetchSteamFreeGames,
    fetchFreeToPlayGames,
    fetchAllFreeGames
};
