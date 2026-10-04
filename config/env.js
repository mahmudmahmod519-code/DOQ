const path = require('path');
const dotenv = require('dotenv');

const requested = process.env.DOQ_ENV_FILE || process.env.DOTENV_CONFIG_PATH || '.env';
const envPath = path.isAbsolute(requested) ? requested : path.resolve(process.cwd(), requested);

dotenv.config({ path: envPath, quiet: true });

module.exports = { envPath };
