// functions/api/freeGames.js
const fetch = require('node-fetch');
const { delay, truncateText, generateGameHash } = require('../../utils/helpers');

async function fetchAllFreeGames() {
    console.log('🔄 Fetching free games...');
    return []; // Retourne vide pour l'instant
}

async function fetchFreeToPlayGames() {
    console.log('🔄 Fetching free-to-play games...');
    return []; // Retourne vide pour l'instant
}

module.exports = {
    fetchAllFreeGames,
    fetchFreeToPlayGames
};
