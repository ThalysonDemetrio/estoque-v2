const https = require('https');

/**
 * Serviço para integração com TP-Link Omada SDN Controller
 */
class OmadaService {
  constructor() {
    this.agent = new https.Agent({ rejectUnauthorized: false });
  }

  async request(config, endpoint, method = 'GET', body = null) {
    const { controllerUrl, clientId, clientSecret } = config;
    const url = new URL(controllerUrl);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: `/api/v2${endpoint}`,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Omada-Api-Key': clientId // Placeholder
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
            reject(new Error(`Omada Error ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async getClients(config) {
    return this.request(config, '/sites/default/clients');
  }
}

module.exports = new OmadaService();
