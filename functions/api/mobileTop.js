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

const API_CONFIG = require('../../config/apiConfig');
const { delay, truncateText } = require('../../utils/helpers');

const APPBRAIN_ANDROID_URL = 'https://www.appbrain.com/stats/google-play-rankings';
const APPLE_TOP_FREE_URL = 'https://rss.marketingtools.apple.com/api/v2/us/apps/top-free/10/apps.json';

async function safeFetchText(url, timeout = 15000) {
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
            console.error(`[MobileTop] HTTP ${res.status} for ${url}`);
            return null;
        }

        return await res.text();
    } catch (err) {
        console.error('[MobileTop] Fetch text error:', err.message);
        return null;
    }
}

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
            console.error(`[MobileTop] HTTP ${res.status} for ${url}`);
            return null;
        }

        return await res.json();
    } catch (err) {
        console.error('[MobileTop] Fetch json error:', err.message);
        return null;
    }
}

function parseTopAndroidFromAppBrain(html) {
    if (!html) return [];

    const apps = [];
    const rowRegex = /(\d+)\s+[=\dnew ]+\s+.*?\[(\d+)†([^\]]+)\][\s\S]*?by\s+\[(\d+)†([^\]]+)\]/g;
    let match;

    while ((match = rowRegex.exec(html)) !== null && apps.length < 10) {
        const rank = Number(match[1]);
        const title = (match[3] || '').trim();
        const developer = (match[5] || '').trim();
        if (!rank || !title) continue;

        apps.push({
            id: `android_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
            title,
            developer: developer || 'Unknown developer',
            rank,
            url: APPBRAIN_ANDROID_URL,
            description: 'Top free Android app tracked from the Google Play ranking page.',
            platform: 'Android',
            source: 'AppBrain',
            sourceLabel: 'Android',
            footerSource: 'Source: AppBrain'
        });
    }

    return apps;
}

async function fetchAndroidTopFreeApps() {
    const html = await safeFetchText(APPBRAIN_ANDROID_URL, 15000);
    return parseTopAndroidFromAppBrain(html);
}

async function fetchAppleTopFreeApps() {
    const data = await safeFetchJson(APPLE_TOP_FREE_URL, 15000);
    const results = data?.feed?.results;
    if (!Array.isArray(results)) return [];

    return results.slice(0, 10).map((app, index) => ({
        id: `apple_${app.id}`,
        title: app.name,
        developer: app.artistName || 'Unknown developer',
        rank: index + 1,
        url: app.url || 'https://apps.apple.com/us/charts/iphone/top-free-apps/36',
        image: app.artworkUrl100 || null,
        description: truncateText(app.kind ? `Top free ${app.kind} on the App Store.` : 'Top free app on the App Store.', 180),
        platform: 'Apple',
        source: 'Apple RSS',
        sourceLabel: 'Apple',
        footerSource: 'Source: Apple RSS'
    }));
}

async function fetchAllMobileTopApps() {
    try {
        const [androidApps, appleApps] = await Promise.all([
            fetchAndroidTopFreeApps(),
            fetchAppleTopFreeApps()
        ]);

        return [...androidApps, ...appleApps];
    } catch (err) {
        console.error('[MobileTop] Global error:', err.message);
        return [];
    }
}

module.exports = {
    fetchAndroidTopFreeApps,
    fetchAppleTopFreeApps,
    fetchAllMobileTopApps
};
