const path = require('node:path');

const isHosted = Boolean(process.env.VERCEL) || process.env.RENDER === 'true';

// Deployment platforms supply runtime variables. Never import local credentials
// in production or tests, and never overwrite variables supplied by the shell.
if (!isHosted && !['production', 'test'].includes(process.env.NODE_ENV)) {
  require('dotenv').config({
    path: path.resolve(__dirname, '../../.env'),
    override: false,
    quiet: true
  });
}

module.exports = {
  isProduction: isHosted || process.env.NODE_ENV === 'production'
};
