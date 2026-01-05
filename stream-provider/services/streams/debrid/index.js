const RealDebrid = require('./realdebrid');
const Torbox = require('./torbox');
const AllDebrid = require('./alldebrid');
const settings = require('../../../config/settings');

function createDebridServices() {
    const services = {
        realdebrid: null,
        torbox: null,
        useRealDebrid: false,
        useTorbox: false
    };

    if (settings.REALDEBRID_API_KEY) {
        services.realdebrid = new RealDebrid(settings.REALDEBRID_API_KEY);
        services.useRealDebrid = true;
    }

    if (settings.TORBOX_API_KEY) {
        services.torbox = new Torbox(settings.TORBOX_API_KEY);
        services.useTorbox = true;
    }

    return services;
}

async function checkAllDebridCaches(hashes) {
    const services = createDebridServices();
    const cacheResults = {
        realdebrid: {},
        torbox: {},
        alldebrid: {}
    };

    const checks = [];

    if (services.useRealDebrid) {
        checks.push(
            services.realdebrid.checkCache(hashes)
                .then(result => { cacheResults.realdebrid = result; })
                .catch(err => console.error('[Factory] RD check failed:', err.message))
        );
    }

    if (services.useTorbox) {
        checks.push(
            services.torbox.checkCache(hashes)
                .then(result => { cacheResults.torbox = result; })
                .catch(err => console.error('[Factory] Torbox check failed:', err.message))
        );
    }

    await Promise.all(checks);
    return { results: cacheResults, services };
}

module.exports = {
    createDebridServices,
    checkAllDebridCaches
};
