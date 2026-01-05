// Centralized special genre mapping for all endpoints
const SPECIAL_GENRE_MAP = {
    'Animal Horror': 'animal_horror',
    'Virus': 'virus_catalog',
    'Dystopia': 'dystopia_catalog',
    'Apocalypse': 'apocalypse_catalog',
    'Supernatural': 'supernatural_catalog',
    'Medical Drama': 'medical_drama_catalog'
};

// Centralized special genre config for provider catalog and keyword-based filter
const SPECIAL_GENRE_CONFIG = {
    'Animal Horror': {
        keywords: ['shark', 'animal attack', 'killer dog', 'piranha', 'crocodile', 'anaconda', 'wolf', 'bear', 'animal horror', 'bird attack', 'rabies', 'animal research', 'creature', 'wildlife', 'human vs nature', 'rabid', 'man-eating', 'giant animal', 'nature run amok', 'killer animal', 'mutant animal', 'beast', 'prehistoric animal', 'monster shark', 'killer whale', 'killer insect', 'deadly animal'],
        minRating: 5.0,
        horrorVariants: ['horror'],
        requiredGenres: ['Horror'],
        validTypes: ['movie']
    },
    'Virus': {
        keywords: ['virus', 'pandemic', 'epidemic', 'outbreak', 'infection', 'disease', 'plague', 'ebola', 'lethal virus', 'zombie', 'epidemia', 'body horror', 'biological weapon'],
        minRating: 6.0,
        extraExclusions: ['famiglia', 'commedia', 'musica', 'romance', 'romantico'],
        excludedKeywords: ['alzheimers', 'parkinsons', 'aids', 'hiv', 'cancer']
    },
    'Dystopia': {
        keywords: ['dystopia', 'totalitarian', 'cyberpunk', 'dystopian', 'surveillance state', 'societal collapse'],
        minRating: 6.5
    },
    'Apocalypse': {
        keywords: ['post-apocalyptic', 'apocalypse', 'nuclear war', 'global catastrophe', '"post apocalyptic future', 'doomsday', 'end of the world', '"destruction of planet', '"cataclysmic storm', 'global catastrophe', 'nuclear holocaust', 'cataclysm', 'survival', 'dystopia', 'wasteland', 'ruins', 'disaster'],
        minRating: 6.0
    },
    'Supernatural': {
        keywords: ['supernatural', 'demon', 'ghost', 'exorcism', 'possession', 'witch', 'vampire', 'werewolf', 'haunted house', 'paranormal', 'paranormal investigation', 'demonic', 'demonic spirit', 'demonology', 'malevolent spirit', 'poltergeist', 'demonic possession', 'religion and supernatural', 'paranormal phenomena', 'religious horror', 'supernatural power', 'black magic', 'folk horror', 'curse', 'dark fantasy', 'gothic horror', 'devil', 'supernatural horror'],
        minRating: 6.0,
        horrorVariants: ['horror']
    },
    'Medical Drama': {
        keywords: ['medical drama'],
        minRating: 0,
        validTypes: ['series']
    }
};



// TMDB Series Genre ID to Name mapping
const TMDB_SERIES_GENRE_MAP = {
    10759: "Action & Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    10762: "Kids",
    9648: "Mystery",
    10763: "News",
    10764: "Reality",
    10765: "Sci-Fi & Fantasy",
    10766: "Soap",
    10767: "Talk",
    10768: "War & Politics",
    37: "Western"
};

const ASIAN_COUNTRIES = [
    'CN', 'JP', 'KR', 'TH', 'VN', 'ID', 'MY', 'PH', 'SG', 'TW', 'HK', 'MO', 'KH', 'LA', 'MM', 'BN', 'TL', 'IN', 'PK', 'LK', 'BD', 'NP'
];

const EUROPEAN_COUNTRIES = [
    'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'TR', 'UA', 'GB', 'VA',
    'FO', 'GI', 'IM', 'GG', 'JE', 'AX'
];

// Shared genre and provider lists for all catalogs
const MOVIE_GENRES = [
    "Novità", "Trending", "Azione", "Avventura", "Animazione", "Animal Horror",
    "Apocalypse", "Cinema TV", "Commedia", "Crime", "Documentario", "Dramma",
    "Dystopia", "Famiglia", "Fantascienza", "Fantasy", "Guerra", "Storia",
    "Horror", "Musica", "Mistero", "Romance", "Supernatural", "Thriller",
    "Virus", "Western", "Asian Drama", "European Drama"
];

const PROVIDER_MOVIE_GENRES = [
    "Azione", "Avventura", "Animazione", "Animal Horror", "Apocalypse",
    "Commedia", "Crime", "Documentario", "Dramma", "Dystopia", "Famiglia",
    "Fantascienza", "Fantasy", "Guerra", "Storia", "Horror", "Musica",
    "Mistero", "Romance", "Supernatural", "Thriller", "Virus", "Western"
];

const SERIES_GENRES = [
    "Novità", "Trending", "Nuovi Episodi", "Action & Adventure", "Animation", "Apocalypse", "Comedy",
    "Crime", "Documentary", "Drama", "Dystopia", "Family", "Kids", "Mystery",
    "News", "Reality", "Sci-Fi & Fantasy", "Soap", "Supernatural", "Talk",
    "War & Politics", "Western", "Virus", "Medical Drama", "Asian Drama", "European Drama"
];

const PROVIDER_SERIES_GENRES = [
    "Action & Adventure", "Animation", "Apocalypse", "Comedy", "Crime",
    "Documentary", "Drama", "Dystopia", "Family", "Kids", "Mystery", "News",
    "Reality", "Sci-Fi & Fantasy", "Soap", "Supernatural", "Talk", "Virus",
    "War & Politics", "Western", "Medical Drama"
];

const MANIFEST_PROVIDERS_MOVIE = [
    "Netflix", "Netflix: Europe", "Netflix: Asia", "Apple TV+", "Amazon Prime",
    "Disney Plus", "Sky/NOW", "Paramount+", "Infinity", "MGM Plus",
    "Lionsgate+", "Timvision", "MUBI", "Full Action"
];

const MANIFEST_PROVIDERS_SERIES = [
    "Netflix", "Netflix: Europe", "Netflix: Asia", "Apple TV+", "Amazon Prime Video",
    "Disney Plus", "Sky/NOW", "Paramount+", "Infinity", "MGM Plus",
    "Lionsgate+", "Timvision", "Discovery+", "WOW Presents Plus"
];

const PROVIDERS = [
    // legacy/shared for main catalog, do not change
    "netflix_it", "netflix_europe", "netflix_asia", "netflix_horror",
    "prime", "disney", "apple", "raiplay", "infinity", "now", "paramount",
    "chili", "rakuten", "mubi", "plex", "google", "youtube", "tivuuon",
    "all_ita", "all_eu"
];

// Strictly for provider catalog: new mapping of primary names, TMDB IDs, and original names
const PROVIDER_CATALOG_MAP = [
    { name: "Netflix", ids: [8, 1796], originals: ["Netflix", "Netflix Standard with Ads"] },
    { name: "Amazon Prime Video", ids: [119, 10, 2100], originals: ["Amazon Prime Video", "Amazon Video", "Amazon Prime Video with Ads"] },
    { name: "Disney Plus", ids: [337], originals: ["Disney Plus"] },
    { name: "Sky / NOW", ids: [29, 39], originals: ["Sky Go", "Now TV", "Sky/NOW"] },
    { name: "Infinity", ids: [359, 110, 1726], originals: ["Mediaset Infinity", "Infinity+", "Infinity Selection", "Infinity"] },
    { name: "Apple TV+", ids: [350, 2243], originals: ["Apple TV+", "Apple TV Plus"] },
    { name: "MUBI", ids: [11, 201], originals: ["MUBI"] },
    { name: "Discovery+", ids: [524, 584], originals: ["Discovery+"] },
    { name: "Crunchyroll", ids: [283, 1968], originals: ["Crunchyroll"] },
    { name: "Hayu", ids: [223, 296], originals: ["Hayu"] },
    { name: "Paramount+", ids: [531, 582, 1853], originals: ["Paramount Plus", "Paramount+", "Paramount Plus Apple TV"] },
    { name: "Rakuten TV", ids: [35], originals: ["Rakuten TV"] },
    { name: "Pluto TV", ids: [300], originals: ["Pluto TV"] },
    { name: "CHILI", ids: [40], originals: ["CHILI"] },
    { name: "Timvision", ids: [109], originals: ["Timvision"] },
    { name: "Rai Play", ids: [222], originals: ["Rai Play"] },
    { name: "YouTube Premium", ids: [188], originals: ["YouTube Premium"] },
    { name: "Plex", ids: [538], originals: ["Plex"] },
    { name: "Serially", ids: [696], originals: ["Serially"] },
    { name: "DOCSVILLE", ids: [475], originals: ["DOCSVILLE"] },
    { name: "Curiosity Stream", ids: [190], originals: ["Curiosity Stream"] },
    { name: "WOW Presents Plus", ids: [546], originals: ["WOW Presents Plus"] },
    { name: "Magellan TV", ids: [551], originals: ["Magellan TV"] },
    { name: "Dekkoo", ids: [444], originals: ["Dekkoo"] },
    { name: "Hoichoi", ids: [315], originals: ["Hoichoi"] },
    { name: "Cultpix", ids: [692], originals: ["Cultpix"] },
    { name: "FilmBox+", ids: [701], originals: ["FilmBox+"] },
    { name: "CG Collection", ids: [1727], originals: ["CG Collection"] },
    { name: "iWonder Full", ids: [1728], originals: ["iWonder Full"] },
    { name: "Full Action", ids: [1729], originals: ["Full Action"] },
    { name: "HistoryPlay", ids: [1710], originals: ["HistoryPlay"] },
    { name: "Sun Nxt", ids: [309], originals: ["Sun Nxt"] },
    { name: "Anime Generation", ids: [1895], originals: ["Anime Generation"] },
    { name: "Raro Video", ids: [1896], originals: ["Raro Video"] },
    { name: "Shahid VIP", ids: [1715], originals: ["Shahid VIP"] },
    { name: "MGM Plus", ids: [2141], originals: ["MGM Plus"] },
    { name: "JustWatchTV", ids: [2285], originals: ["JustWatchTV"] },
    { name: "Lionsgate+", ids: [2358], originals: ["Lionsgate+"] },
    { name: "OUTtv", ids: [607], originals: ["OUTtv"] },
    { name: "Noggin", ids: [262], originals: ["Noggin"] },
    { name: "FOUND TV", ids: [2478], originals: ["FOUND TV"] },
    { name: "Kocowa", ids: [464], originals: ["Kocowa"] },
    { name: "Hopster", ids: [1890], originals: ["Hopster"] }
];

const SERIETV_COLLECTIONS_GENRES = [
    "Azione", "Avventura", "Animazione", "Commedia", "Crime",
    "Documentario", "Dramma", "Famiglia", "Fantasy", "Storia",
    "Horror", "Musica", "Mistero", "Romance", "Fantascienza",
    "Cinema TV", "Thriller", "Guerra", "Western", "Animal Horror",
    "Virus", "Dystopia", "Apocalypse", "Supernatural"
];

const COLLEZIONI_POPOLARI_GENRES = [
    "Recenti", "Azione", "Avventura", "Animal Horror", "Animazione",
    "Apocalypse", "Commedia", "Crime", "Documentario", "Dramma",
    "Dystopia", "Famiglia", "Fantascienza", "Fantasy", "Guerra",
    "Horror", "Musica", "Mistero", "Romance", "Storia",
    "Supernatural", "Thriller", "Virus", "Western", "Asian Drama", "European Drama"
];

const KEYWORD_CATALOGS = {
    animal_horror: {
        name: 'Animal Horror', keywords: ['shark', 'animal attack', 'killer dog', 'piranha', 'crocodile', 'anaconda', 'wolf', 'bear', 'insect', "birds", "mutant animal", 'animal horror', 'killer animal', 'genetically mutated', 'spiders',
            'swarm', 'mutant', 'creature feature', 'giant animal', 'mutated animal', 'animal mutation', 'animal terror', 'killer insects', 'animal invasion', 'wild animal', 'alligator', 'crocodile attack', 'shark attack', 'wolf attack', 'bear attack', 'animal outbreak', 'animal uprising', 'animal apocalypse', 'animal disaster', 'animal escape', 'alien animal', 'prehistoric animal', 'mutated creature', 'giant insect', 'killer creature', 'wild beast', 'feral animal', 'rampaging animal', 'venomous animal', 'predatory animal', 'toxic animal', 'sea monster', 'killer whale', 'giant shark', 'mutant shark', 'giant creature', 'mutant fish', 'killer fish', 'mutant reptile', 'giant reptile', 'rampaging beast', 'wild predator', 'ferocious animal', 'deadly animal', 'menacing animal', 'terrifying animal', 'monstrous animal', 'raging animal', 'savage animal', 'vicious animal', 'violent animal', 'bloodthirsty animal', 'frenzied animal', 'berserk animal', 'rampant animal', 'untamed animal', 'wildlife horror', 'cryptic animal', 'mythical creature', 'legendary beast', 'fantastical animal', 'supernatural beast', 'enchanted creature', 'magical animal', 'mystical beast', 'otherworldly creature', 'phantom animal', 'spectral beast', 'ghostly creature', 'haunted animal', 'cursed beast', 'bewitched creature', 'spiritual animal', 'divine beast', 'celestial creature', 'ethereal animal', 'transcendent beast', 'arcane creature', 'occult animal', 'esoteric beast', 'enigmatic creature', 'mysterious animal', 'beast', 'spider', 'rabid animal', 'man-eating', 'swarm', 'spiders'
        ], minRating: 5.5, includeMovies: true, includeTV: false
    },
    virus_catalog: { name: 'Virus & Disease', keywords: ['virus', 'pandemic', 'epidemic', 'outbreak', 'infection', 'disease', 'plague', 'ebola', 'zombie', 'undead'], minRating: 6.0, includeMovies: true, includeTV: true },
    dystopia_catalog: { name: 'Dystopia', keywords: ['dystopia', 'totalitarian', 'totalitarismo', 'cyberpunk', 'dystopian'], minRating: 6.5, includeMovies: true, includeTV: true },
    apocalypse_catalog: { name: 'Apocalypse', keywords: ['post-apocalyptic', 'apocalypse', 'fine del mondo', 'nuclear war', 'global catastrophe', 'end of the world', 'apocolyptic'], minRating: 6.0, includeMovies: true, includeTV: true },
    supernatural_catalog: { name: 'Supernatural', keywords: ['supernatural', 'demon', 'ghost', 'exorcism', 'possession', 'witch', 'vampire', 'werewolf', 'witchcraft', 'occult', 'haunted', 'poltergeist'], minRating: 6.0, includeMovies: true, includeTV: true }
};

const MANIFEST_COLLECTION_GENRES = [
    "Action & Adventure",
    "Animation",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Family",
    "Kids",
    "Mystery",
    "News",
    "Reality",
    "Sci-Fi & Fantasy",
    "Soap",
    "Talk",
    "War & Politics",
    "Western",
    "Horror",
    "Music",
    "Romance",
    "Thriller",
    "History",
    "TV Movie",
    "Animal Horror",
    "Virus",
    "Dystopia",
    "Apocalypse",
    "Apocalypse",
    "Supernatural",
    "Medical Drama",
    "Nuovi Episodi"
];

const GENRE_MAP = {
    // TMDB genres to manifest genres
    "Action": "Action & Adventure",
    "Adventure": "Action & Adventure",
    "Action & Adventure": "Action & Adventure",
    "Animation": "Animation",
    "Comedy": "Comedy",
    "Crime": "Crime",
    "Documentary": "Documentary",
    "Drama": "Drama",
    "Family": "Family",
    "Kids": "Kids",
    "Mystery": "Mystery",
    "News": "News",
    "Reality": "Reality",
    "Sci-Fi & Fantasy": "Sci-Fi & Fantasy",
    "Science Fiction": "Sci-Fi & Fantasy",
    "Fantasy": "Sci-Fi & Fantasy",
    "Soap": "Soap",
    "Talk": "Talk",
    "War & Politics": "War & Politics",
    "War": "War & Politics",
    "Politics": "War & Politics",
    "Western": "Western",
    // Italian TMDB genres to manifest genres
    "Azione": "Action & Adventure",
    "Avventura": "Action & Adventure",
    "Animazione": "Animation",
    "Commedia": "Comedy",
    "Crime": "Crime",
    "Documentario": "Documentary",
    "Dramma": "Drama",
    "Famiglia": "Family",
    "Fantascienza": "Sci-Fi & Fantasy",
    "Fantasy": "Sci-Fi & Fantasy",
    "Guerra": "War & Politics",
    "Storia": "War & Politics", // Mapping History to War & Politics as per manifest usually, or keep separate if manifest supports History? Manifest doesn't list History.
    "Horror": "Horror", // Horror is same
    "Musica": "Music", // Manifest doesn't list Music? Let's check.
    "Mistero": "Mystery",
    "Romance": "Romance", // Manifest doesn't list Romance?
    "Thriller": "Thriller", // Manifest doesn't list Thriller?
    "Cinema TV": "TV Movie", // Manifest doesn't list TV Movie?
    // Special genres (already match manifest)
    "Virus": "Virus",
    "Dystopia": "Dystopia",
    "Apocalypse": "Apocalypse",
    "Supernatural": "Supernatural",
    "Medical Drama": "Medical Drama",
    "Nuovi Episodi": "Nuovi Episodi",
    "Asian Drama": "Asian Drama",
    "European Drama": "European Drama"
};

const EXCLUDED_GENRES = ['documentario', 'documentary', 'reality', 'talk', 'animazione', 'animation'];
const STRICT_EXCLUDED_GENRES = ['documentario', 'documentary', 'reality', 'talk', 'animazione', 'animation', 'bambini', 'kids'];

const ITALIAN_TO_ENGLISH_GENRES = {
    "Azione": "Action & Adventure",
    "Avventura": "Action & Adventure",
    "Animazione": "Animation",
    "Commedia": "Comedy",
    "Crime": "Crime",
    "Documentario": "Documentary",
    "Dramma": "Drama",
    "Famiglia": "Family",
    "Fantascienza": "Sci-Fi & Fantasy",
    "Fantasy": "Sci-Fi & Fantasy",
    "Guerra": "War & Politics",
    "Storia": "War & Politics",
    "Horror": "Horror",
    "Musica": "Music",
    "Mistero": "Mystery",
    "Romance": "Romance",
    "Thriller": "Thriller",
    "Western": "Western",
    "Cinema TV": "TV Movie",
    "Animal Horror": "Animal Horror"
};

module.exports = {
    ASIAN_COUNTRIES,
    EUROPEAN_COUNTRIES,
    SPECIAL_GENRE_MAP,
    SPECIAL_GENRE_CONFIG,
    SERIES_GENRES,
    TMDB_SERIES_GENRE_MAP,
    MOVIE_GENRES,
    PROVIDER_MOVIE_GENRES,
    PROVIDER_SERIES_GENRES,
    MANIFEST_PROVIDERS_MOVIE,
    MANIFEST_PROVIDERS_SERIES,
    PROVIDERS,
    PROVIDER_CATALOG_MAP,
    SERIETV_COLLECTIONS_GENRES,
    COLLEZIONI_POPOLARI_GENRES,
    KEYWORD_CATALOGS,
    MANIFEST_COLLECTION_GENRES,
    GENRE_MAP,
    EXCLUDED_GENRES,
    STRICT_EXCLUDED_GENRES,
    ITALIAN_TO_ENGLISH_GENRES,
    TRACKERS: [
        "udp://tracker.opentrackr.org:1337/announce",
        "udp://9.rarbg.com:2810/announce",
        "udp://tracker.openbittorrent.com:80/announce",
        "udp://opentracker.i2p.rocks:6969/announce",
        "udp://tracker.torrent.eu.org:451/announce",
        "udp://open.stealth.si:80/announce",
        "udp://vibe.sleepyinternetfun.xyz:1738/announce",
        "udp://tracker1.bt.moack.co.kr:80/announce",
        "udp://tracker.zerobytes.xyz:1337/announce",
        "udp://tracker.tiny-vps.com:6969/announce",
        "udp://tracker.theoks.net:6969/announce",
        "udp://tracker.swateam.org.uk:2710/announce",
        "udp://tracker.publictracker.xyz:6969/announce",
        "udp://tracker.monitorit4.me:6969/announce",
        "udp://tracker.moeking.me:6969/announce",
        "udp://tracker.lelux.fi:6969/announce",
        "udp://tracker.encrypted-data.xyz:1337/announce",
        "udp://tracker.dump.cl:6969/announce",
        "udp://tracker.dler.org:6969/announce"
    ]
};
