function providerLabel(provider) {
    return provider ? `[${provider}]` : '';
}

function buildUnifiedStreamName({ baseTitle, isSub, sizeBytes, playerName, proxyOn, provider, isFhdOrDual }) {
    let parts = [];
    if (baseTitle) parts.push(baseTitle);
    if (isSub) parts.push('SUB');
    if (isFhdOrDual) parts.push('FHD');
    if (proxyOn) parts.push('Proxy');
    if (sizeBytes) {
        const gb = (sizeBytes / 1024 / 1024 / 1024).toFixed(2);
        parts.push(`${gb} GB`);
    }
    if (provider) parts.push(providerLabel(provider));

    return parts.join(' ');
}

module.exports = {
    buildUnifiedStreamName,
    providerLabel
};
