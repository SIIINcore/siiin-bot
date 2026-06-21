module.exports = {
    API_HEADERS: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0; +https://discord.gg)',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
    },

    STEAM: {
        BASE_URL: 'https://store.steampowered.com/api',
        FEATURED: '/featured',
        APP_DETAILS: (appId) => `/appdetails?appids=${appId}`
    },

    STEAMSPY: {
        BASE_URL: 'https://steamspy.com/api.php'
    },

    CHEAP_SHARK: {
        BASE_URL: 'https://www.cheapshark.com/api/1.0',
        STORES: {
            STEAM: 1,
            GOG: 7,
            EPIC: 25,
            UBISOFT: 31,   // Ubisoft
            EA: 30         // EA / Origin
        }
    },

    GAMER_POWER: {
        BASE_URL: 'https://www.gamerpower.com/api',
        FREE_GAMES: '/giveaways?platform=pc',                    // ← Ajouté pour tous les jeux PC gratuits
        EPIC_GAMES: '/giveaways?platform=epic-games-store'
    }
};
