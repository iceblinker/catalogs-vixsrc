module.exports = {
    testEnvironment: 'node',
    verbose: true,
    collectCoverage: false,
    coverageDirectory: 'coverage',
    testMatch: ['**/tests/**/*.test.js', '**/?(*.)+(spec|test).js'],
    // Ignore the cache files and node_modules
    testPathIgnorePatterns: ['/node_modules/', '/cache-.*\\.json'],
};
