const fetch = require('node-fetch');
const { delay, truncateText, generateGameHash } = require('../../utils/helpers');
const API_CONFIG = require('../../config/apiConfig');

async function fetchSteamPromos() {
    try {
        const res = await fetch(`${API_CONFIG.STEAM.BASE_URL}${API_CONFIG.STEAM.FEATURED}`, {
            headers: API_CONFIG.API_HEADERS,
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
        }).filter(game => game.discountPercent >= 40 && game.price > 0);
        
    } catch (err) {
        console.error('[SteamPromos] API Error:', err.message);
        return [];
    }
}

async function fetchCheapSharkPromos() {
    try {
        const res = await fetch(`${API_CONFIG.CHEAP_SHARK.BASE_URL}/deals?storeID=1&upperPrice=15&pageSize=20`, {
            headers: API_CONFIG.API_HEADERS,
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

async function fetchAllPromos() {
    console.log('🔄 Fetching promotions from all platforms...');
    
    const allPromos = [];
    const seenHashes = new Set();
    
    try {
        console.log('📥 Fetching Steam...');
        const steamPromos = await fetchSteamPromos();
        
        for (const promo of steamPromos) {
            const hash = generateGameHash(promo.title, promo.price, 'steam');
            if (!seenHashes.has(hash)) {
                seenHashes.add(hash);
                allPromos.push(promo);
            }
        }
        
        await delay(1000);
        
        console.log('📥 Fetching CheapShark...');
        const cheapSharkPromos = await fetchCheapSharkPromos();
        
        for (const promo of cheapSharkPromos) {
            const hash = generateGameHash(promo.title, promo.price, 'cheapshark');
            if (!seenHashes.has(hash.replace('_cheapshark', '_steam')) && !seenHashes.has(hash)) {
                seenHashes.add(hash);
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
    fetchCheapSharkPromos,
    fetchAllPromos
};
