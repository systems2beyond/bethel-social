const axios = require('axios');

const keysToTest = [
    { name: 'ORIGINAL', key: 'AIzaSyDY4Dy5hsGQEma3hnuMRf6QANl2YQls66Y' },
    { name: 'FIREBASE', key: 'AIzaSyCJY1tZPXM7BEAHPfYsFLp9grad89nar8g' },
    { name: 'MAPS', key: 'AIzaSyBSElSTOBIY6LFVatm4Hl-BmYYavo-SItY' }
];
const CX = '963445ad09d264687';

async function testSearch() {
    for (const { name, key } of keysToTest) {
        console.log(`\nTesting ${name}: ${key.substring(0, 5)}...`);
        try {
            const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: { key, cx: CX, q: 'faith', num: 1 }
            });
            console.log('✅ SUCCESS!');
            console.log(`Use this key for backend search: ${key}`);
            process.exit(0);
        } catch (error) {
            console.log(`❌ FAILED: ${error.response?.data?.error?.message || error.message}`);
        }
    }
}

testSearch();
