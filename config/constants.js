module.exports = {
    // ========================
    // CHANNELS ID
    // ========================
    CHANNEL_FREEGAMES: '1469855556356542649',
    CHANNEL_PROMOS: '1469855518695624725',
    CHANNEL_FREETOPLAY: '1468126872297672928',
    CHANNEL_MOBILE: '1487769618733858956',
    SEARCH_CHANNEL_ID: '1376910830490095798',
    CHANNEL_WELCOME: '1033462383798140981',
    STATS_CHANNEL_ID: '1465938751208558643',
    SUPPORT_CHANNEL_ID: '1468090646442279206',
    TICKET_CATEGORY_ID: '1237716160842305566',
    LOG_CHANNEL_ID: '1354801906161025236',
    CHAT_CHANNEL_ID: '1189391329097166989',
    DONATION_CHANNEL_ID: '1178517213444046948',
    BAN_LOG_CHANNEL_ID: '1417568141428396063',
    TICKET_TRANSCRIPT_CHANNEL_ID: '1487595893803978772',

    // ========================
    // APP ID | SIIIN CORE
    // ========================
    BOT_ID: '1465878128219128005',

    // ========================
    // STAFF ID
    // ========================
    STAFF_IDS: ['847798063821225985', '400331452245344268'],

    // ========================
    // AUTOMOD
    // ========================
    AUTOMOD: {
        BAD_WORDS: [
            /\bn+i+g+g+[ae3r]*\b/i,
            /\bf+a+g+(?:g+o+t+)?\b/i,
            /\bk+y+s+\b/i,
            /\bretard(?:ed)?\b/i,
            /\bslut\b/i,
            /\bwhore\b/i
        ],
        DANGEROUS_LINKS: [
            /discord\.(?:gift|gg)\/[^\s]+/i,
            /steamcommunity\.[^\s]*\/tradeoffer/i,
            /free[-_ ]?nitro/i,
            /grabify/i,
            /iplogger/i,
            /bit\.ly\//i,
            /tinyurl\.com\//i,
            /t\.me\//i
        ],
        ALLOWED_DOMAINS: [
            'youtube.com',
            'youtu.be',
            'discord.com',
            'discord.gg',
            'store.steampowered.com',
            'steamcommunity.com',
            'gog.com',
            'epicgames.com',
            'cheapshark.com',
            'appbrain.com',
            'apps.apple.com',
            'rss.marketingtools.apple.com'
        ]
    },



    // ========================
    // TRANSLATION
    // ========================
    TRANSLATION_CHANNEL_IDS: [
        '1237650687249092670',
        '1177257234787471422',
        '1178517213444046948',
        '1189391329097166989'
    ],
    TRANSLATION_DAILY_LIMIT: Number(process.env.TRANSLATION_DAILY_LIMIT || 3),

    // ========================
    // TICKETS RULES
    // ========================
    ALLOWED_FILE_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mov'],

    // ========================
    // BOT VERSION
    // ========================
    BOT_VERSION: process.env.RAILWAY_GIT_COMMIT_SHA
        ? `git-${process.env.RAILWAY_GIT_COMMIT_SHA.slice(0, 7)}`
        : require('../package.json').version
};
