const https = require('https');
const http = require('http');

/**
 * Serviço robusto para comunicação com MikroTik RouterOS v7 via REST API
 */
class MikrotikService {
  constructor() {
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
  }

  /**
   * Faz uma requisição HTTP ou HTTPS usando os módulos nativos do Node.js
   */
  async request(config, endpoint) {
    const { host, port, user, password } = config;
    const isHttps = Number(port) !== 80;
    const protocol = isHttps ? https : http;
    
    const auth = Buffer.from(`${user}:${password}`).toString('base64');

    return new Promise((resolve, reject) => {
      const options = {
        hostname: host,
        port: port || (isHttps ? 443 : 80),
        path: `/rest${endpoint}`,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        agent: isHttps ? this.httpsAgent : undefined,
        timeout: 10000 // 10 segundos de timeout
      };

      const req = protocol.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              resolve(body);
            }
          } else {
            const err = new Error(`MikroTik respondeu com HTTP ${res.statusCode}${body ? ': ' + body : ''}`);
            err.status = res.statusCode;
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        let msg = err.message;
        if (err.code === 'ECONNREFUSED') msg = 'Conexão recusada. Verifique se o serviço REST API (www ou www-ssl) está ativo no MikroTik.';
        if (err.code === 'ETIMEDOUT') msg = 'Tempo de conexão esgotado. Verifique o IP e as regras de firewall.';
        
        const enhancedError = new Error(msg);
        enhancedError.code = err.code;
        reject(enhancedError);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout na conexão com o MikroTik.'));
      });

      req.end();
    });
  }

  async getDhcpLeases(config) {
    return this.request(config, '/ip/dhcp-server/lease');
  }

  async getArpTable(config) {
    return this.request(config, '/ip/arp');
  }
}

module.exports = new MikrotikService();
