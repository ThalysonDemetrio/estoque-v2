const express = require('express');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications/alerts
// Retorna alertas de garantia expirando (baseado em data_compra + 1 ano)
// e equipamentos sem movimentação há mais de 6 meses
router.get('/alerts', authMiddleware, async (req, res, next) => {
  try {

    // 1. Garantias expirando nos próximos 30 dias ou já vencidas
    const garantiaPromise = query(`
      SELECT
        etiqueta_id, tipo_equipamento, marca, modelo,
        (data_compra + INTERVAL '1 year') AS data_garantia_estimada,
        EXTRACT(DAY FROM (data_compra + INTERVAL '1 year') - NOW()) AS dias_ate_vencimento
      FROM equipamentos
      WHERE data_compra IS NOT NULL
        AND status NOT IN ('Descartado', 'Baixado')
        AND (data_compra + INTERVAL '1 year') <= (NOW() + INTERVAL '30 days')
      ORDER BY (data_compra + INTERVAL '1 year') ASC
      LIMIT 20
    `);

    // 2. Equipamentos "Em Uso" sem movimentação há mais de 180 dias
    const inativosPromise = query(`
      SELECT e.etiqueta_id, e.tipo_equipamento, e.marca, e.modelo, e.updated_at
      FROM equipamentos e
      WHERE e.status ILIKE '%em uso%'
        AND e.updated_at < NOW() - INTERVAL '180 days'
        AND NOT EXISTS (
          SELECT 1 FROM movimentacoes m
          WHERE m.equipamento_id = e.etiqueta_id
            AND m.data_hora > NOW() - INTERVAL '180 days'
        )
      LIMIT 20
    `);

    // 3. Solicitações Pendentes (Últimas 48h)
    const solicitacoesPromise = query(`
      SELECT solicitacao_id, protocolo, solicitante_nome, data_criacao, urgencia, tipo_solicitacao
      FROM solicitacoes
      WHERE status = 'pendente'
        AND data_criacao > NOW() - INTERVAL '48 hours'
      ORDER BY data_criacao DESC
      LIMIT 10
    `);

    // 4. Movimentações Recentes (Últimas 24h)
    const movsPromise = query(`
      SELECT m.movimentacao_id, m.tipo_movimentacao, m.data_hora, e.tipo_equipamento, m.equipamento_id
      FROM movimentacoes m
      JOIN equipamentos e ON e.etiqueta_id = m.equipamento_id
      WHERE m.data_hora > NOW() - INTERVAL '24 hours'
      ORDER BY m.data_hora DESC
      LIMIT 10
    `);

    // 5. Mensagens de Chat não lidas (Últimos 7 dias)
    const chatPromise = query(`
      SELECT m.mensagem_id, m.user_nome, m.texto, m.created_at, m.contexto_tipo, m.contexto_id
      FROM chat_mensagens m
      LEFT JOIN chat_leituras cl ON cl.user_id = $1 AND cl.contexto_tipo = m.contexto_tipo AND cl.contexto_id = m.contexto_id
      WHERE m.user_id != $1
        AND (cl.ultima_leitura IS NULL OR m.created_at > cl.ultima_leitura)
        AND m.created_at > NOW() - INTERVAL '7 days'
      ORDER BY m.created_at DESC
      LIMIT 5
    `, [req.user.userId]);

    // 6. Novos Equipamentos (Últimas 24h)
    const novosPromise = query(`
      SELECT etiqueta_id, tipo_equipamento, marca, modelo, created_at
      FROM equipamentos
      WHERE created_at > NOW() - INTERVAL '24 hours'
        AND status = 'Novo'
      LIMIT 10
    `);

    const [gRes, iRes, sRes, mRes, cRes, nRes] = await Promise.all([
      garantiaPromise, inativosPromise, solicitacoesPromise, movsPromise, chatPromise, novosPromise
    ]);

    const alerts = [];

    // Map Garantias
    gRes.rows.forEach(row => {
      const dias = Math.round(Number(row.dias_ate_vencimento));
      const vencida = dias < 0;
      alerts.push({
        id: `garantia-${row.etiqueta_id}`,
        type: vencida ? 'critical' : 'warning',
        category: 'garantia',
        icon: 'fa-shield-heart',
        title: vencida ? 'Garantia Vencida' : 'Garantia Expirando',
        description: `${row.marca} ${row.modelo} (${row.etiqueta_id}) - ${vencida ? 'Venceu há' : 'Vence em'} ${Math.abs(dias)} dias.`,
        path: `/equipamentos?open=${row.etiqueta_id}`,
        timestamp: row.data_garantia_estimada
      });
    });

    // Map Inativos
    iRes.rows.forEach(row => {
      alerts.push({
        id: `inativo-${row.etiqueta_id}`,
        type: 'warning',
        category: 'manutencao',
        icon: 'fa-clock-rotate-left',
        title: 'Ativo Inativo',
        description: `O item ${row.etiqueta_id} (${row.marca}) não tem movimentação há mais de 6 meses.`,
        path: `/equipamentos?open=${row.etiqueta_id}`,
        timestamp: row.updated_at
      });
    });

    // Map Solicitações
    sRes.rows.forEach(row => {
      alerts.push({
        id: `solic-${row.solicitacao_id}`,
        type: row.urgencia === 'Alta' ? 'critical' : 'info',
        category: 'solicitacao',
        icon: 'fa-clipboard-list',
        title: 'Nova Solicitação',
        description: `Protocolo #${row.protocolo} de ${row.solicitante_nome} (${row.tipo_solicitacao}).`,
        path: `/solicitacoes?open=${row.solicitacao_id}`,
        timestamp: row.data_criacao
      });
    });

    // Map Movimentações
    mRes.rows.forEach(row => {
      alerts.push({
        id: `mov-${row.movimentacao_id}`,
        type: 'info',
        category: 'movimentacao',
        icon: 'fa-arrows-rotate',
        title: 'Movimentação Registrada',
        description: `O item ${row.equipamento_id} (${row.tipo_equipamento}) foi movido (${row.tipo_movimentacao}).`,
        path: `/movimentacoes?open=${row.movimentacao_id}`,
        timestamp: row.data_hora
      });
    });

    // Map Chats
    cRes.rows.forEach(row => {
      alerts.push({
        id: `chat-${row.mensagem_id}`,
        type: 'info',
        category: 'chat',
        icon: 'fa-comment-dots',
        title: `Mensagem de ${row.user_nome}`,
        description: row.texto || 'Enviou um arquivo.',
        path: row.contexto_tipo === 'solicitacao' ? `/solicitacoes?open=${row.contexto_id}` : `/movimentacoes?open=${row.contexto_id}`,
        timestamp: row.created_at
      });
    });

    // Map Novos
    nRes.rows.forEach(row => {
      alerts.push({
        id: `novo-${row.etiqueta_id}`,
        type: 'info',
        category: 'equipamento',
        icon: 'fa-laptop-medical',
        title: 'Novo Dispositivo',
        description: `O item ${row.etiqueta_id} (${row.marca} ${row.modelo}) foi adicionado ao inventário.`,
        path: `/equipamentos?open=${row.etiqueta_id}`,
        timestamp: row.created_at
      });
    });

    // Ordena por data (mais recentes primeiro)
    alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json({
      data: alerts,
      total: alerts.length,
      critical: alerts.filter(a => a.type === 'critical').length,
      warning: alerts.filter(a => a.type === 'warning').length
    });

  } catch (error) {
    return next(error);
  }
});

router.post('/subscribe', authMiddleware, async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Dados de inscrição (endpoint e keys) são incompletos.' });
    }

    await query(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        updated_at = NOW()
    `, [req.user.userId, endpoint, keys.p256dh, keys.auth]);

    return res.status(201).json({ success: true, message: 'Dispositivo cadastrado para Push Notificações Nativas.' });
  } catch(err) {
    return next(err);
  }
});

module.exports = router;
