
try {
    require('dotenv').config(); // Load .env if present
    console.log('Attempting to check-load functions...');
    const functions = require('./lib/index.js');
    console.log('Successfully loaded functions:', Object.keys(functions));
} catch (error) {
    console.error('FATAL: Failed to load functions/lib/index.js');
    console.error(error);
}
