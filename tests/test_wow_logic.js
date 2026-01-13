const { normalizeProviders } = require('../services/ingestion/tmdbClient');

function testLogic() {
    console.log('Testing normalizeProviders logic...');

    // Case 1: RuPaul's Drag Race (Name)
    const details1 = { name: "RuPaul's Drag Race" };
    const res1 = normalizeProviders({}, details1);
    if (res1.providers.includes('WOW Presents Plus')) {
        console.log('PASS: "RuPaul\'s Drag Race" (Name)');
    } else {
        console.error('FAIL: "RuPaul\'s Drag Race" (Name)');
        process.exit(1);
    }

    // Case 2: RuPaul (Title)
    const details2 = { title: "RuPaul" };
    const res2 = normalizeProviders({}, details2);
    if (res2.providers.includes('WOW Presents Plus')) {
        console.log('PASS: "RuPaul" (Title)');
    } else {
        console.error('FAIL: "RuPaul" (Title)');
        process.exit(1);
    }

    // Case 3: Drag Race Italia
    const details3 = { name: "Drag Race Italia" };
    const res3 = normalizeProviders({ IT: { flatrate: [] } }, details3);
    if (res3.providers.includes('WOW Presents Plus')) {
        console.log('PASS: "Drag Race Italia"');
    } else {
        console.error('FAIL: "Drag Race Italia"');
        process.exit(1);
    }

    // Case 4: Random Show (Negative Test)
    const details4 = { name: "Breaking Bad" };
    const res4 = normalizeProviders({ IT: {} }, details4);
    if (!res4.providers.includes('WOW Presents Plus')) {
        console.log('PASS: "Breaking Bad" (Negative)');
    } else {
        console.error('FAIL: "Breaking Bad" should NOT have it');
        process.exit(1);
    }

    console.log('ALL TESTS PASSED');
}

testLogic();
