const https = require('https');

/**
 * Serviço para integração com Ubiquiti UniFi Controller / Site Manager
 */
class UnifiService {
  constructor() {
    this.agent = new https.Agent({ rejectUnauthorized: false });
  }

  async request(config, endpoint, method = 'GET', body = null) {
    const { controllerUrl, apiKey, siteId } = config;
    const url = new URL(controllerUrl);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: `/api/s/${siteId || 'default'}${endpoint}`,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey // Placeholder para Site Manager API
        },
        agent: this.agent
      };

      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
      }

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(responseBody)); } catch (e) { resolve(responseBody); }
          } else {
            reject(new Error(`UniFi Error ${res.statusCode}: ${responseBody}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async getClients(config) {
    return this.request(config, '/stat/sta');
  }

  async getDevices(config) {
    return this.request(config, '/stat/device');
  }
}

module.exports = new UnifiService();
