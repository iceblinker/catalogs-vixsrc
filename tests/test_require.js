try {
    console.log('Requiring streamService...');
    const streamService = require('../services/streams/streamService');
    console.log('streamService loaded:', streamService);
    if (streamService && typeof streamService.getStreams === 'function') {
        console.log('getStreams is a function.');
    } else {
        console.error('getStreams is NOT a function.');
    }
} catch (e) {
    console.error('Error requiring streamService:', e);
}
