module.exports = {
    // Channels
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
    GAME_TRACKER_CHANNEL_ID: '1508589900067377243',   // ← Nouveau

    // Rôles & Staff
    MEMBER_ROLE_ID: '1033463588934918164',
    STAFF_IDS: ['847798063821225985', '400331452245344268'],

    // Bot
    BOT_ID: '1465878128219128005',
    BOT_VERSION: require('../package.json').version,

    // Automod
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
            'youtube.com', 'youtu.be', 'discord.com', 'discord.gg',
            'store.steampowered.com', 'steamcommunity.com', 'gog.com',
            'epicgames.com', 'cheapshark.com', 'appbrain.com',
            'apps.apple.com', 'rss.marketingtools.apple.com'
        ]
    },

    ALLOWED_FILE_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mov']
};
