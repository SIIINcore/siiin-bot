function generateGameHash(title, price, store) {
    return `${title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${price}_${store}`;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

module.exports = {
    generateGameHash,
    delay,
    truncateText
};
