const embedUrl = 'https://vixcloud.co/embed/223701?token=803acd235fce5aed58dd5e89bec08cad6&expires=1769533993&canPlayFHD=1';

console.log('Embed URL:', embedUrl);

let token = '';
let expires = '';

if (!token || !expires) {
    console.log('Token/Expires missing, trying fallback...');
    try {
        const urlObj = new URL(embedUrl);
        if (!token) token = urlObj.searchParams.get('token');
        if (!expires) expires = urlObj.searchParams.get('expires');
        console.log(`Fallback token: '${token}', expires: '${expires}'`);
    } catch (e) {
        console.log('URL parsing failed:', e.message);
    }
}

const paramStr = `token=${encodeURIComponent(token || '')}&expires=${encodeURIComponent(expires || '')}`;
console.log('Param Str:', paramStr);
