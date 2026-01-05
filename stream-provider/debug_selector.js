const cheerio = require('cheerio');
const { get } = require('./services/streams/utils/request');

async function debug() {
    const searchUrl = 'https://lordchannel.net/?s=Deadpool';
    console.log(`[DEBUG] Fetching Links from: ${searchUrl}`);
    try {
        const html = await get(searchUrl);
        if (!html) { console.log('HTML is null'); return; }

        const $ = cheerio.load(html);

        console.log(`Total Links: ${$('a').length}`);
        console.log('--- FIRST 20 LINKS ---');

        $('a').slice(0, 20).each((i, el) => {
            const txt = $(el).text().trim().replace(/\s+/g, ' ');
            const href = $(el).attr('href');
            console.log(`${i}: [${txt}] -> ${href}`);
        });

    } catch (e) {
        console.error(e.message);
    }
}

debug();
