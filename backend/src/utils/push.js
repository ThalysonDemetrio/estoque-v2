const webpush = require('web-push');
const { query } = require('../db');

webpush.setVapidDetails(
  'mailto:admin@seusistema.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

async function sendPushToUser(userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return; // Push desativado/não configurado

  try {
    const result = await query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [userId]);
    
    if (result.rowCount === 0) return; // Nenhuma inscrição para o usuário

    const dataBuffer = Buffer.from(JSON.stringify(payload));

    const promises = result.rows.map(async (sub) => {
      const subscriptionInfo = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(subscriptionInfo, dataBuffer);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // 410 Gone / 404 Not Found significa que a inscrição do celular não é mais válida
          await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        } else {
          console.error('[WebPush] Falha ao enviar para a inscrição ID:', sub.id, err);
        }
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('[WebPush] Erro geral ao despachar pacotes:', error);
  }
}

module.exports = {
  webpush,
  sendPushToUser
};
