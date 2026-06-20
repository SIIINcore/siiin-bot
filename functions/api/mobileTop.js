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

const APPBRAIN_ANDROID_URL = 'https://www.appbrain.com/stats/google-play-rankings/top_free/all/us';
const APPBRAIN_ANDROID_GAMES_URL = 'https://www.appbrain.com/stats/google-play-rankings/top_free/game/us';
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

function decodeHtmlEntities(value = '') {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ');
}

function normalizeLine(value = '') {
    return decodeHtmlEntities(value)
        .replace(/Image:\s*.*? icon\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildAndroidFallbackUrl(title = '') {
    return `https://www.appbrain.com/search?q=${encodeURIComponent(title)}`;
}

function extractAppBrainAnchorMaps(html) {
    const titleToHref = new Map();
    const titleToImage = new Map();

    const itemRegex = /<img[^>]+src="([^"]+)"[^>]+alt="([^"]+?)\s+icon"[\s\S]*?<a[^>]+href="(\/app\/[^"#?]+(?:\/[^"#?]+)?)"[^>]*>(.*?)<\/a>/gi;
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
        const image = match[1]?.startsWith('http') ? match[1] : `https://www.appbrain.com${match[1]}`;
        const altTitle = normalizeLine(match[2] || '');
        const href = `https://www.appbrain.com${match[3]}`;
        const anchorTitle = normalizeLine(match[4] || '');
        const title = anchorTitle || altTitle;

        if (!title || titleToHref.has(title)) continue;
        titleToHref.set(title, href);
        if (image) titleToImage.set(title, image);
    }

    return { titleToHref, titleToImage };
}

function parseTopAndroidFromAppBrain(html) {
    if (!html) return [];

    const { titleToHref, titleToImage } = extractAppBrainAnchorMaps(html);

    const cleaned = decodeHtmlEntities(
        html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<\/(p|div|li|tr|td|th|h1|h2|h3|h4|h5|h6)>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
    );

    const normalizedLines = cleaned
        .split(/\r?\n/)
        .map(normalizeLine)
        .filter(Boolean);

    const startIndex = normalizedLines.findIndex(line => /Rank\s+App\s+Category\s+Rating\s+Installs\s+Recent/i.test(line));
    if (startIndex === -1) {
        console.warn('[MobileTop] AppBrain ranking table not found. Using fallback.');
        return [];
    }

    const apps = [];
    for (let i = startIndex + 1; i < normalizedLines.length && apps.length < 10; i += 1) {
        const line = normalizedLines[i];
        if (/^(Buy|Next|Download Top Free|Get a report on|AppBrain is a directory)/i.test(line)) break;

        const rankMatch = line.match(/^(\d{1,3})\s+(?:=|\d+)?\s+(.+)$/);
        if (!rankMatch) continue;

        const rank = Number(rankMatch[1]);
        let title = normalizeLine(rankMatch[2]);
        if (!rank || !title) continue;

        title = title.replace(/^(?:Image:\s*)?/i, '').trim();

        const devLine = normalizeLine(normalizedLines[i + 1] || '');
        const categoryLine = normalizeLine(normalizedLines[i + 2] || '');
        const statsLine = normalizeLine(normalizedLines[i + 3] || '');
        const developer = devLine.replace(/^by\s+/i, '').trim();

        if (!developer || /^\d/.test(developer)) continue;

        apps.push({
            id: `android_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
            title,
            developer,
            rank,
            url: titleToHref.get(title) || buildAndroidFallbackUrl(title),
            image: titleToImage.get(title) || null,
            description: truncateText(
                categoryLine && !/^\d/.test(categoryLine)
                    ? `Top free Android app in ${categoryLine}.`
                    : 'Top free Android app tracked from the Google Play ranking page.',
                180
            ),
            extra: statsLine || null,
            platform: 'Android',
            source: 'AppBrain',
            sourceLabel: 'Android',
            footerSource: 'Source: AppBrain',
            sourceUrl: APPBRAIN_ANDROID_URL
        });

        i += 3;
    }

    return apps;
}

function buildAndroidGenericEntries() {
    return [
        {
            id: 'android_topfree_apps_link',
            title: 'Android Top Free Apps',
            developer: 'Google Play rankings via AppBrain',
            rank: 1,
            url: APPBRAIN_ANDROID_URL,
            image: 'https://www.google.com/s2/favicons?sz=256&domain_url=https://play.google.com',
            description: 'Open the latest Android Top Free Apps list. The page updates when the source updates.',
            platform: 'Android',
            source: 'AppBrain',
            sourceLabel: 'Android',
            footerSource: 'Source: AppBrain',
            sourceUrl: APPBRAIN_ANDROID_URL,
            genericLink: true
        },
        {
            id: 'android_topfree_games_link',
            title: 'Android Top Free Games',
            developer: 'Google Play rankings via AppBrain',
            rank: 2,
            url: APPBRAIN_ANDROID_GAMES_URL,
            image: 'https://www.google.com/s2/favicons?sz=256&domain_url=https://play.google.com',
            description: 'Open the latest Android Top Free Games list. The page updates when the source updates.',
            platform: 'Android',
            source: 'AppBrain',
            sourceLabel: 'Android',
            footerSource: 'Source: AppBrain',
            sourceUrl: APPBRAIN_ANDROID_GAMES_URL,
            genericLink: true
        }
    ];
}

async function fetchAndroidTopFreeApps() {
    console.log('📱 Fetching Android Top Free apps (via AppBrain scraping)...');

    const html = await safeFetchText(APPBRAIN_ANDROID_URL, 15000);
    const apps = parseTopAndroidFromAppBrain(html);

    if (apps.length > 0) {
        console.log(`✅ ${apps.length} Android apps parsed successfully`);
        return apps;
    }

    console.warn('⚠️ AppBrain scraping failed or returned no results. Using fallback links.');
    return buildAndroidGenericEntries();
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
        footerSource: 'Source: Apple RSS',
        sourceUrl: 'https://rss.marketingtools.apple.com/'
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
