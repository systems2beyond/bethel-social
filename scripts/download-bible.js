const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '../src/data/bible');
const BOOKS = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

// Helper to get formatted filename for TehShrike repo (e.g. "1 Samuel" -> "1Samuel.json" or "Song of Solomon" -> "SongofSolomon.json"?)
// Actually TehShrike uses "1Samuel.json". Let's verify spaces.
// Repo: https://github.com/TehShrike/world-english-bible/tree/master/json
// It seems to be "1Samuel.json", "SongofSolomon.json". No spaces.

const RAW_BOOKS_URL = 'https://raw.githubusercontent.com/TehShrike/world-english-bible/master/json/';

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'node.js' } }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    // Strip BOM if present
                    const cleanData = data.toString().trim().replace(/^\uFEFF/, '');
                    resolve(JSON.parse(cleanData));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function downloadKJV() {
    console.log('Downloading KJV...');
    try {
        const kjvData = await fetchJson('https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json');
        fs.writeFileSync(path.join(DATA_DIR, 'kjv.json'), JSON.stringify(kjvData));
        console.log('Saved kjv.json');
    } catch (e) {
        console.error('Error downloading KJV:', e);
    }
}

async function downloadWEB() {
    console.log('Fetching WEB file list...');
    // Fetch directory listing to find exact filenames
    const dirUrl = 'https://api.github.com/repos/TehShrike/world-english-bible/contents/json';

    // We need a User-Agent for GitHub API
    const options = {
        headers: { 'User-Agent': 'node.js' }
    };

    try {
        const files = await new Promise((resolve, reject) => {
            https.get(dirUrl, options, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        if (!Array.isArray(files)) {
            throw new Error('Failed to get file list (Rate limit?): ' + JSON.stringify(files));
        }

        const bibleData = [];

        // Map our standard books to the files found
        for (const book of BOOKS) {
            // Find a file that "looks like" the book name.
            // Normalize both to lowercase alphanumeric for matching.
            const target = book.toLowerCase().replace(/[^a-z0-9]/g, '');

            const match = files.find(f => {
                const fname = f.name.toLowerCase().replace('.json', '').replace(/[^a-z0-9]/g, '');
                return fname === target;
            });

            if (!match) {
                console.warn(`Could not find file for book: ${book}`);
                continue;
            }

            console.log(`Fetching ${book} from ${match.name}...`);
            const bookContent = await fetchJson(match.download_url);

            // Normalize to KJV structure (thiagobodruk format): { name, abbrev, chapters: [ [v1, v2], [v1, v2] ] }
            const chapters = [];

            // TehShrike format is [ { "chapterNumber": 1, "verses": [ { "verseNumber": 1, "text": "..." } ] } ]
            // Note: TehShrike usually returns an array of chapters.
            if (Array.isArray(bookContent)) {
                bookContent.forEach(ch => {
                    if (ch.verses && Array.isArray(ch.verses)) {
                        const verseList = ch.verses.map(v => v.text);
                        chapters.push(verseList);
                    }
                });
            }

            bibleData.push({
                name: book,
                abbrev: match.name.replace('.json', ''), // Simple abbrev
                chapters: chapters
            });
        }

        fs.writeFileSync(path.join(DATA_DIR, 'web.json'), JSON.stringify(bibleData));
        console.log('Saved web.json');

    } catch (e) {
        console.error('Error downloading WEB:', e);
    }
}

async function main() {
    await downloadKJV();
    await downloadWEB();
}

main();
