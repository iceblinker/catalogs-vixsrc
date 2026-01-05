function extractQuality(title) {
    if (!title) return '';
    const qualityPatterns = [
        /\b(2160p|4k|uhd)\b/i,
        /\b(1080p)\b/i,
        /\b(720p)\b/i,
        /\b(480p|sd)\b/i,
        /\b(webrip|web-rip)\b/i,
        /\b(bluray|blu-ray|bdremux|bd)\b/i,
        /\b(remux)\b/i,
        /\b(hdrip|hdr)\b/i,
        /\b(cam|ts|tc)\b/i
    ];
    for (const pattern of qualityPatterns) {
        const match = title.match(pattern);
        if (match) return match[1].toLowerCase();
    }
    return '';
}

function extractInfoHash(magnet) {
    if (!magnet) return null;
    const match = magnet.match(/btih:([A-Fa-f0-9]{40}|[A-Za-z2-7]{32})/i);
    if (!match) return null;
    if (match[1].length === 32) {
        // Base32 to Hex conversion would go here if needed, but usually 40 char hex is standard
        return match[1].toUpperCase();
    }
    return match[1].toUpperCase();
}

function parseSize(sizeStr) {
    if (!sizeStr || sizeStr === '-' || sizeStr.toLowerCase() === 'unknown') return 0;
    const match = sizeStr.match(/([\d.,]+)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)/i);
    if (!match) return 0;
    const [, value, unit] = match;
    const cleanValue = parseFloat(value.replace(',', '.'));
    const multipliers = {
        'B': 1,
        'KB': 1024, 'KIB': 1024,
        'MB': 1024 ** 2, 'MIB': 1024 ** 2,
        'GB': 1024 ** 3, 'GIB': 1024 ** 3,
        'TB': 1024 ** 4, 'TIB': 1024 ** 4
    };
    return Math.round(cleanValue * (multipliers[unit.toUpperCase()] || 1));
}

function isItalian(title) {
    if (!title) return false;
    return /\b(ita|italian|sub[.\s]?ita|nuita)\b/i.test(title);
}

function cleanSearchQuery(query) {
    if (!query) return '';
    return query
        .replace(/\s*\(\d{4}\)\s*$/, '')
        .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

module.exports = {
    extractQuality,
    extractInfoHash,
    parseSize,
    isItalian,
    cleanSearchQuery
};
