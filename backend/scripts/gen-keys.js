const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const keys = webpush.generateVAPIDKeys();
const backendEnvPath = path.join(__dirname, '..', '.env');
const frontendEnvPath = path.join(__dirname, '..', '..', 'frontend', '.env.local');

try {
  fs.appendFileSync(backendEnvPath, `\n# WEB PUSH\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`);
  if (!fs.existsSync(frontendEnvPath)) {
    fs.writeFileSync(frontendEnvPath, '');
  }
  fs.appendFileSync(frontendEnvPath, `\nNEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}\n`);
  console.log('VAPID KEYS GENERATED AND SAVED TO ENV FILES.');
} catch(e) {
  console.error('Error saving keys', e);
}
