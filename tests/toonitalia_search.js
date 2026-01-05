const fetch = require('node-fetch');

async function testToonItaliaSearch() {
    const query = 'Deadpool';
    const url = `https://toonitalia.xyz/?s=${query}`;
    console.log(`Testing search: ${url}`);

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Body Length: ${text.length}`);

        // Debug: Dump snippet around entry-header
        const headerMatch = text.match(/<header class="entry-header.*?>[\s\S]*?<\/header>/);
        if (headerMatch) {
            console.log('\n--- Header Snippet ---');
            console.log(headerMatch[0]);

            // Try to find link inside header (entry-title)
            const titleLink = headerMatch[0].match(/class="entry-title.*?<a href="(.*?)"/);
            if (titleLink) {
                console.log(`\nFound link in header: ${titleLink[1]}`);
                const detailUrl = titleLink[1];
                console.log(`\nFetching detail page: ${detailUrl}`);

                const detailRes = await fetch(detailUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                });
                const detailText = await detailRes.text();
                console.log(`Detail Body Length: ${detailText.length}`);

                // Debug: Dump entry-content snippet (larger)
                const contentMatch = detailText.match(/<div class="entry-content.*?>[\s\S]*?<\/div>/);
                if (contentMatch) {
                    console.log('\n--- Entry Content Snippet (First 2000 chars) ---');
                    console.log(contentMatch[0].substring(0, 2000));

                    // Search for go.php or any links
                    const allLinks = contentMatch[0].match(/href="(.*?)"/g);
                    if (allLinks) {
                        console.log(`\nFound ${allLinks.length} total links in content.`);
                        const interestingLinks = allLinks.filter(l => l.includes('go.php') || l.includes('http'));
                        console.log('--- Interesting Links ---');
                        interestingLinks.slice(0, 20).forEach(l => console.log(l));
                    } else {
                        console.warn('\n⚠️ No links found in content.');
                    }

                } else {
                    console.log('\n--- No entry-content found ---');
                }
            }
        } else {
            console.log('\n--- No entry-header found, dumping first 2000 chars ---');
            console.log(text.substring(0, 2000));
        }

    } catch (e) {
        console.error(e.message);
    }
}

testToonItaliaSearch();
