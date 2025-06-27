// In api/check-env.js

require('dotenv').config();

console.log('--- Environment Check ---');
console.log('My DATABASE_URL is:', process.env.DATABASE_URL);
console.log('-------------------------');