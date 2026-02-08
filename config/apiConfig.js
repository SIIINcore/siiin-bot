module.exports = {
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
        APP_DETAILS: (appId) => `/appdetails?appids=${appId}&cc=us&l=en`
    },
    GAMER_POWER: {
        BASE_URL: 'https://www.gamerpower.com/api',
        EPIC_GAMES: '/giveaways?platform=epic-games-store'
    },
    STEAMSPY: {
        BASE_URL: 'https://steamspy.com/api.php',
        ALL_GAMES: '?request=all'
    },
    
    API_HEADERS: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0; +https://discord.gg)',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
    }
};
