#!/usr/bin/env node

/**
 * Generate required environment variables for the authentication system
 * Usage: node generate-env-vars.js
 */

const crypto = require('crypto');

console.log('🔐 MyBalance Authentication - Environment Variables Generator\n');

// Generate encryption key
const encryptionKey = crypto.randomBytes(32).toString('hex');
console.log('ENCRYPTION_KEY (copy to .env.local):');
console.log(`ENCRYPTION_KEY=${encryptionKey}\n`);

// Generate RSA key pair for JWT
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

console.log('JWT_PRIVATE_KEY (copy to .env.local, keep the quotes):');
console.log(`JWT_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"\n`);

console.log('JWT_PUBLIC_KEY (copy to .env.local, keep the quotes):');
console.log(`JWT_PUBLIC_KEY="${publicKey.replace(/\n/g, '\\n')}"\n`);

console.log('📋 Complete .env.local template:');
console.log('=====================================');
console.log(`# Google OAuth
CLIENT_ID=your_google_oauth_client_id
CLIENT_SECRET=your_google_oauth_client_secret
REDIRECT_URI=http://localhost:8100/auth/callback

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/mybalance

# CORS
ORIGIN_URL=http://localhost:8100

# WebAuthn (optional)
RP_ID=localhost

# Generated Keys
ENCRYPTION_KEY=${encryptionKey}
JWT_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"
JWT_PUBLIC_KEY="${publicKey.replace(/\n/g, '\\n')}"`);

console.log('\n✅ Environment variables generated successfully!');
console.log('\n⚠️  Security Notes:');
console.log('- Keep these keys secure and never commit them to version control');
console.log('- Use different keys for different environments (dev/staging/prod)');
console.log('- Store keys securely in your deployment platform');
console.log('- Rotate keys periodically for maximum security');