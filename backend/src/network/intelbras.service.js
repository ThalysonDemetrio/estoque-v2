const https = require('https');

/**
 * Serviço para integração com Ecossistema Intelbras (Zeus/INC)
 */
class IntelbrasService {
  constructor() {
    this.agent = new https.Agent({ rejectUnauthorized: false });
  }

  async request(config, endpoint, method = 'GET', body = null) {
    const { host, user, password } = config;
    
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${user}:${password}`).toString('base64');
      const options = {
        hostname: host,
        port: 443,
        path: `/api${endpoint}`,
        method: method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        agent: this.agent
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(responseBody)); } catch (e) { resolve(responseBody); }
          } else {
            reject(new Error(`Intelbras Error ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async getDeviceSummary(config) {
    return this.request(config, '/devices/summary');
  }
}

module.exports = new IntelbrasService();
