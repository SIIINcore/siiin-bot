const { AUTOMOD } = require('../config/constants');

function containsBadWord(text) {
    const lowerText = text.toLowerCase();
    
    for (const word of AUTOMOD.BAD_WORDS) {
        if (typeof word === 'string') {
            if (lowerText.includes(word.toLowerCase())) {
                return { found: true, word: word, reason: 'Bad word detected' };
            }
        } else if (word instanceof RegExp) {
            if (word.test(lowerText)) {
                return { found: true, word: 'Pattern match', reason: 'Evaded bad word detected' };
            }
        }
    }
    
    return { found: false };
}

function isDangerousLink(text) {
    for (const pattern of AUTOMOD.DANGEROUS_LINKS) {
        if (pattern.test(text)) {
            return { dangerous: true, reason: 'Dangerous/scam link detected' };
        }
    }
    
    const urlRegex = /https?:\/\/([^\s/]+)/gi;
    const matches = text.match(urlRegex);
    
    if (matches) {
        for (const url of matches) {
            const domain = url.match(/https?:\/\/([^\s/]+)/i)[1];
            let isAllowed = false;
            
            for (const allowedDomain of AUTOMOD.ALLOWED_DOMAINS) {
                if (domain.includes(allowedDomain)) {
                    isAllowed = true;
                    break;
                }
            }
            
            if (!isAllowed) {
                return { dangerous: true, reason: 'Unauthorized link domain: ' + domain };
            }
        }
    }
    
    return { dangerous: false };
}

module.exports = {
    containsBadWord,
    isDangerousLink
};
