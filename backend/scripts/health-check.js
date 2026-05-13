const http = require('http');

const url = process.env.API_URL || 'http://localhost:3000/health';

http.get(url, (res) => {
  const { statusCode } = res;
  if (statusCode !== 200) {
    console.error(`Healthcheck falhou: ${statusCode}`);
    process.exit(1);
  }
  console.log('API OK');
  res.resume();
}).on('error', (err) => {
  console.error('Erro no healthcheck:', err.message);
  process.exit(1);
});
