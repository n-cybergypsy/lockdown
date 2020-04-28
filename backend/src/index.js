// Entrypoint
import './main';

require('dotenv').config();
console.log(process.env.MONGO_DB_USER)
console.log(process.env.MONGO_DB_PASSWORD)
console.log(process.env.MONGO_DB)