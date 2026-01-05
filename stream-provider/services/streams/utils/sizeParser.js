const parseSize = (sizeStr) => {
    if (!sizeStr) return 0;
    if (typeof sizeStr === 'number') return sizeStr;

    const regex = /(\d+(\.\d+)?)\s*(GiB|GB|MiB|MB|KiB|KB|B)/i;
    const match = sizeStr.match(regex);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[3].toUpperCase();

    switch (unit) {
        case 'GIB':
        case 'GB':
            return Math.floor(value * 1024 * 1024 * 1024);
        case 'MIB':
        case 'MB':
            return Math.floor(value * 1024 * 1024);
        case 'KIB':
        case 'KB':
            return Math.floor(value * 1024);
        default:
            return Math.floor(value);
    }
};

module.exports = { parseSize };
