try {
    const extractor = require('../services/streams/utils/extractor');
    console.log('Extractor module loaded successfully.');
    console.log('Exports:', Object.keys(extractor));
} catch (e) {
    console.error('Error loading extractor module:', e);
    process.exit(1);
}
