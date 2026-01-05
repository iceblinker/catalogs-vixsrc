const fetch = require('node-fetch');

async function inspect() {
    const url = 'https://vixcloud.co/embed/223701?token=db5dff0b9117be13d1063dfbcbaa1a2f&expires=1769533488&canPlayFHD=1';
    console.log(`Fetching ${url}...`);

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://animeunity.so/'
            }
        });

        const html = await res.text();
        // console.log('--- HTML CONTENT ---');
        // console.log(html);
        // console.log('--- END HTML ---');

        const token = 'db5dff0b9117be13d1063dfbcbaa1a2f';
        const expires = '1769533488';

        const tIdx = html.indexOf(token);
        if (tIdx !== -1) {
            console.log(`Found TOKEN at index ${tIdx}`);
            console.log(html.substring(tIdx - 100, tIdx + 100));
        } else {
            console.log('TOKEN not found in HTML');
        }

        const eIdx = html.indexOf(expires);
        if (eIdx !== -1) {
            console.log(`Found EXPIRES at index ${eIdx}`);
            console.log(html.substring(eIdx - 100, eIdx + 100));
        } else {
            console.log('EXPIRES not found in HTML');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

inspect();
