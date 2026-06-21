const { EmbedBuilder } = require('discord.js');
const { GAME_TRACKER_CHANNEL_ID } = require('../config/constants');
const { delay } = require('../utils/helpers');

const BIG_PUBLISHERS = [
    'rockstar', 'ubisoft', 'ea', 'bethesda', 'capcom',
    'square enix', 'valve', 'funcom'
];

let postedTrailers = new Set();

async function fetchSteamNewReleases() {
    try {
        const res = await fetch('https://store.steampowered.com/api/featuredcategories');
        const data = await res.json();
        return data?.new_releases?.items || [];
    } catch (err) {
        console.error('[GameTracker] Error fetching new releases:', err.message);
        return [];
    }
}

async function getGameDetails(appId) {
    try {
        const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
        const data = await res.json();
        return data?.[appId]?.data || null;
    } catch (err) {
        return null;
    }
}

function hasOfficialTrailer(details) {
    if (!details?.movies || !Array.isArray(details.movies)) return null;

    for (const movie of details.movies) {
        if (movie.mp4?.max) {
            return movie.mp4.max; // Lien direct du trailer
        }
    }
    return null;
}

function isBigPublisher(details) {
    if (!details?.publishers) return false;
    const publishers = details.publishers.map(p => p.toLowerCase());
    return BIG_PUBLISHERS.some(pub => publishers.some(p => p.includes(pub)));
}

async function checkNewGames(client) {
    console.log('🎮 [GameTracker] Vérification des nouveaux jeux...');

    const newReleases = await fetchSteamNewReleases();
    const channel = await client.channels.fetch(GAME_TRACKER_CHANNEL_ID).catch(() => null);

    if (!channel) {
        console.error('[GameTracker] Salon introuvable');
        return;
    }

    for (const game of newReleases) {
        const appId = game.id;

        if (postedTrailers.has(appId)) continue;

        const details = await getGameDetails(appId);
        if (!details) continue;

        // Vérifie si c'est un gros éditeur
        if (!isBigPublisher(details)) continue;

        // Vérifie s'il y a un trailer officiel
        const trailerUrl = hasOfficialTrailer(details);
        if (!trailerUrl) continue;

        // Poste le trailer
        try {
            const embed = new EmbedBuilder()
                .setTitle(`🎥 ${details.name}`)
                .setURL(`https://store.steampowered.com/app/${appId}`)
                .setDescription(`**Trailer officiel** • ${details.publishers?.join(', ') || 'Unknown Publisher'}`)
                .setColor(0x00AAFF)
                .setTimestamp();

            await channel.send({
                content: trailerUrl,
                embeds: [embed]
            });

            postedTrailers.add(appId);
            console.log(`✅ Trailer posté : ${details.name}`);
        } catch (err) {
            console.error('[GameTracker] Erreur envoi trailer:', err.message);
        }

        await delay(2000); // Anti-spam
    }
}

function startGameTracker(client) {
    // Vérifie toutes les 3 heures
    setInterval(() => checkNewGames(client), 3 * 60 * 60 * 1000);

    // Première vérification au démarrage
    setTimeout(() => checkNewGames(client), 30000);

    console.log('🎮 Game Tracker lancé (toutes les 3h)');
}

module.exports = { startGameTracker };
