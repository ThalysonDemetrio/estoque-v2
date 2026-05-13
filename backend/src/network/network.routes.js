const express = require('express');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const mikrotikService = require('./mikrotik.service');
const unifiService = require('./unifi.service');
const omadaService = require('./omada.service');
const intelbrasService = require('./intelbras.service');
const { exec } = require('child_process');

const router = express.Router();

const { 
  normalizeIpv4, 
  normalizeMac, 
  normalizeVlan, 
  sanitizeNetworkPayload, 
  hasAnyNetworkField 
} = require('./network.utils');

router.get('/inventory', authMiddleware, async (req, res, next) => {
  try {
    const params = [];
    const where = [
      `(en.ip_address IS NOT NULL OR en.mac_address IS NOT NULL OR en.subnet_mask IS NOT NULL OR en.default_gateway IS NOT NULL OR en.dns_primary IS NOT NULL OR en.dns_secondary IS NOT NULL OR en.vlan_id IS NOT NULL OR en.switch_name IS NOT NULL OR en.switch_port IS NOT NULL OR en.network_notes IS NOT NULL)`
    ];

    if (req.query.switch_name) {
      params.push(`%${req.query.switch_name}%`);
      where.push(`COALESCE(en.switch_name, '') ILIKE $${params.length}`);
    }

    if (req.query.vlan_id) {
      params.push(Number(req.query.vlan_id));
      where.push(`en.vlan_id = $${params.length}`);
    }

    if (req.query.status) {
      params.push(req.query.status);
      where.push(`e.status = $${params.length}`);
    }

    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where.push(`(COALESCE(en.ip_address, '') ILIKE $${params.length} OR COALESCE(en.mac_address, '') ILIKE $${params.length} OR COALESCE(e.etiqueta_id, '') ILIKE $${params.length} OR COALESCE(e.marca, '') ILIKE $${params.length} OR COALESCE(e.modelo, '') ILIKE $${params.length} OR COALESCE(e.localizacao, '') ILIKE $${params.length})`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT e.etiqueta_id AS "etiquetaID",
              e.tipo_equipamento AS "tipoEquipamento",
              e.marca,
              e.modelo,
              e.status,
              e.localizacao,
              c.nome AS "usuarioNome",
              en.ip_address,
              en.mac_address,
              en.subnet_mask,
              en.default_gateway,
              en.dns_primary,
              en.dns_secondary,
              en.vlan_id,
              en.switch_name,
              en.switch_port,
              en.total_ports,
              en.network_notes,
              e.foto_equipamento AS "fotoEquipamento"
         FROM equipamentos e
         JOIN equipment_network en ON en.equipment_id = e.etiqueta_id
         LEFT JOIN colaboradores c ON c.colaborador_id = e.colaborador_atual_id
         ${whereClause}
         ORDER BY e.etiqueta_id`,
      params
    );

    const ipCount = new Map();
    const macCount = new Map();
    result.rows.forEach((row) => {
      if (row.ip_address) ipCount.set(row.ip_address, (ipCount.get(row.ip_address) || 0) + 1);
      if (row.mac_address) macCount.set(row.mac_address, (macCount.get(row.mac_address) || 0) + 1);
    });

    const data = result.rows.map((row) => ({
      ...row,
      hasIpConflict: Boolean(row.ip_address && (ipCount.get(row.ip_address) || 0) > 1),
      hasMacConflict: Boolean(row.mac_address && (macCount.get(row.mac_address) || 0) > 1)
    }));

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
});

router.get('/inventory/export', authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT e.etiqueta_id,
              e.tipo_equipamento,
              e.marca,
              e.modelo,
              e.status,
              e.localizacao,
              en.ip_address,
              en.mac_address,
              en.subnet_mask,
              en.default_gateway,
              en.dns_primary,
              en.dns_secondary,
              en.vlan_id,
              en.switch_name,
              en.switch_port,
              en.total_ports,
              en.network_notes,
              e.foto_equipamento AS "fotoEquipamento"
         FROM equipamentos e
         JOIN equipment_network en ON en.equipment_id = e.etiqueta_id
        WHERE (en.ip_address IS NOT NULL OR en.mac_address IS NOT NULL OR en.subnet_mask IS NOT NULL OR en.default_gateway IS NOT NULL OR en.dns_primary IS NOT NULL OR en.dns_secondary IS NOT NULL OR en.vlan_id IS NOT NULL OR en.switch_name IS NOT NULL OR en.switch_port IS NOT NULL OR en.total_ports IS NOT NULL OR en.network_notes IS NOT NULL)
        ORDER BY e.etiqueta_id`
    );

    const header = [
      'Etiqueta', 'Tipo', 'Marca', 'Modelo', 'Status', 'Localizacao', 'IP', 'MAC', 'Mascara', 'Gateway', 'DNS Primario', 'DNS Secundario', 'VLAN', 'Switch', 'Porta', 'Total Portas', 'Observacoes Rede'
    ];

    const escapeCsv = (value) => {
      const text = String(value ?? '');
      if (/[",\n;]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const lines = [header.join(';')].concat(
      result.rows.map((row) => [
        row.etiqueta_id,
        row.tipo_equipamento,
        row.marca,
        row.modelo,
        row.status,
        row.localizacao,
        row.ip_address,
        row.mac_address,
        row.subnet_mask,
        row.default_gateway,
        row.dns_primary,
        row.dns_secondary,
        row.vlan_id,
        row.switch_name,
        row.switch_port,
        row.total_ports,
        row.network_notes
      ].map(escapeCsv).join(';'))
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventario-rede.csv"');
    return res.send(`\uFEFF${lines.join('\n')}`);
  } catch (error) {
    return next(error);
  }
});

router.put('/:equipmentId', authMiddleware, async (req, res, next) => {
  try {
    const equipmentId = String(req.params.equipmentId || '').trim();
    if (!equipmentId) {
      return res.status(400).json({ error: 'equipmentId obrigatório' });
    }

    const equipmentExists = await query('SELECT 1 FROM equipamentos WHERE etiqueta_id = $1', [equipmentId]);
    if (!equipmentExists.rowCount) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    const payload = sanitizeNetworkPayload(req.body || {});

    // 1. Verificação de Conflito de Porta (HARD BLOCK)
    if (payload.switch_name && payload.switch_port) {
      const portConflict = await query(
        `SELECT equipment_id FROM equipment_network 
          WHERE switch_name = $1 AND switch_port = $2 AND equipment_id != $3`,
        [payload.switch_name, payload.switch_port, equipmentId]
      );
      if (portConflict.rowCount > 0) {
        return res.status(409).json({ 
          error: `A porta ${payload.switch_port} do switch ${payload.switch_name} já está sendo usada pelo dispositivo ${portConflict.rows[0].equipment_id}.` 
        });
      }
    }

    // 2. Verificação de Conflito de IP (WARNING - Informar sem bloquear)
    let ipWarning = null;
    if (payload.ip_address) {
      const ipConflict = await query(
        `SELECT equipment_id FROM equipment_network 
          WHERE ip_address = $1 AND equipment_id != $2`,
        [payload.ip_address, equipmentId]
      );
      if (ipConflict.rowCount > 0) {
        ipWarning = `O IP ${payload.ip_address} já está em uso pelo dispositivo ${ipConflict.rows[0].equipment_id}.`;
      }
    }

    if (!hasAnyNetworkField(payload)) {
      await query('DELETE FROM equipment_network WHERE equipment_id = $1', [equipmentId]);
      return res.json({ data: { equipment_id: equipmentId, removed: true } });
    }

    const result = await query(
      `INSERT INTO equipment_network (
         equipment_id, ip_address, mac_address, subnet_mask, default_gateway,
         dns_primary, dns_secondary, vlan_id, switch_name, switch_port, total_ports,
         network_notes, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (equipment_id) DO UPDATE SET
         ip_address = EXCLUDED.ip_address,
         mac_address = EXCLUDED.mac_address,
         subnet_mask = EXCLUDED.subnet_mask,
         default_gateway = EXCLUDED.default_gateway,
         dns_primary = EXCLUDED.dns_primary,
         dns_secondary = EXCLUDED.dns_secondary,
         vlan_id = EXCLUDED.vlan_id,
         switch_name = EXCLUDED.switch_name,
         switch_port = EXCLUDED.switch_port,
         total_ports = EXCLUDED.total_ports,
         network_notes = EXCLUDED.network_notes,
         updated_at = NOW()
       RETURNING *`,
      [
        equipmentId, payload.ip_address, payload.mac_address, payload.subnet_mask,
        payload.default_gateway, payload.dns_primary, payload.dns_secondary,
        payload.vlan_id, payload.switch_name, payload.switch_port, payload.total_ports,
        payload.network_notes
      ]
    );

    // Se houver rede definida e o dispositivo NÃO estiver no mapa de topologia, criar nó automaticamente
    if (hasAnyNetworkField(payload)) {
       const nodeCheck = await query('SELECT 1 FROM network_topology_nodes WHERE equipment_id = $1', [equipmentId]);
       if (nodeCheck.rowCount === 0) {
          // console.log(`[TOPOLOGIA] Criando nó automático para ${equipmentId}`);
          await query(
            `INSERT INTO network_topology_nodes (equipment_id, pos_x, pos_y, updated_at)
             VALUES ($1, $2, $3, NOW())`,
            [equipmentId, 400 + (Math.random() * 100), 300 + (Math.random() * 100)]
          );
       }
    }

    return res.json({ 
      data: result.rows[0],
      warning: ipWarning 
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
});

router.get('/topology/nodes', authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT COALESCE(n.id, (row_number() over())::int * -1) as id,
              e.etiqueta_id AS equipment_id,
              COALESCE(n.pos_x, 400 + (random() * 200)) as pos_x,
              COALESCE(n.pos_y, 300 + (random() * 200)) as pos_y,
              e.tipo_equipamento,
              e.marca,
              e.modelo,
              en.ip_address,
              en.mac_address,
              en.vlan_id,
              en.switch_name,
              en.switch_port,
              en.total_ports
         FROM equipamentos e
         JOIN equipment_network en ON en.equipment_id = e.etiqueta_id
         LEFT JOIN network_topology_nodes n ON n.equipment_id = e.etiqueta_id
        WHERE (en.ip_address IS NOT NULL OR en.mac_address IS NOT NULL OR en.switch_name IS NOT NULL OR en.vlan_id IS NOT NULL)
        ORDER BY n.id NULLS LAST, e.etiqueta_id`
    );

    return res.json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/topology/nodes', authMiddleware, async (req, res, next) => {
  try {
    const equipmentId = String(req.body?.equipment_id || '').trim();
    const posX = Number(req.body?.pos_x ?? 100);
    const posY = Number(req.body?.pos_y ?? 100);

    if (!equipmentId) {
      return res.status(400).json({ error: 'equipment_id obrigatório' });
    }

    if (!Number.isFinite(posX) || !Number.isFinite(posY)) {
      return res.status(400).json({ error: 'Coordenadas inválidas' });
    }

    const exists = await query('SELECT 1 FROM equipamentos WHERE etiqueta_id = $1', [equipmentId]);
    if (!exists.rowCount) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    const result = await query(
      `INSERT INTO network_topology_nodes (equipment_id, pos_x, pos_y, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (equipment_id) DO UPDATE SET pos_x = EXCLUDED.pos_x, pos_y = EXCLUDED.pos_y, updated_at = NOW()
       RETURNING id, equipment_id, pos_x, pos_y`,
      [equipmentId, posX, posY]
    );

    return res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/topology/nodes/:id', authMiddleware, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const posX = Number(req.body?.pos_x);
    const posY = Number(req.body?.pos_y);

    if (!Number.isInteger(id) || !Number.isFinite(posX) || !Number.isFinite(posY)) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    const result = await query(
      `UPDATE network_topology_nodes
          SET pos_x = $1,
              pos_y = $2,
              updated_at = NOW()
        WHERE id = $3
      RETURNING id, equipment_id, pos_x, pos_y`,
      [posX, posY, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Nó não encontrado' });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.delete('/topology/nodes/:id', authMiddleware, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const nodeResult = await query('SELECT equipment_id FROM network_topology_nodes WHERE id = $1', [id]);
    if (!nodeResult.rowCount) {
      return res.status(404).json({ error: 'Nó não encontrado' });
    }

    const equipmentId = nodeResult.rows[0].equipment_id;

    await query(
      `DELETE FROM network_topology_connections
        WHERE source_equipment_id = $1 OR target_equipment_id = $1`,
      [equipmentId]
    );

    const result = await query('DELETE FROM network_topology_nodes WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Nó não encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get('/topology/connections', authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id,
              source_equipment_id,
              target_equipment_id,
              label,
              connection_type,
              created_at
         FROM network_topology_connections
         ORDER BY id`
    );

    return res.json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/topology/connections', authMiddleware, async (req, res, next) => {
  try {
    const sourceId = String(req.body?.source_equipment_id || '').trim();
    const targetId = String(req.body?.target_equipment_id || '').trim();
    const label = String(req.body?.label || '').trim() || null;
    const type = String(req.body?.connection_type || 'wired').trim();

    if (!sourceId || !targetId || sourceId === targetId) {
      return res.status(400).json({ error: 'source_equipment_id e target_equipment_id válidos são obrigatórios' });
    }

    if (!['wired', 'wireless', 'problem'].includes(type)) {
      return res.status(400).json({ error: 'connection_type inválido' });
    }

    const result = await query(
      `INSERT INTO network_topology_connections (source_equipment_id, target_equipment_id, label, connection_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, source_equipment_id, target_equipment_id, label, connection_type, created_at`,
      [sourceId, targetId, label, type]
    );

    return res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/topology/connections/:id', authMiddleware, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const label = String(req.body?.label || '').trim() || null;
    const type = String(req.body?.connection_type || 'wired').trim();

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    if (!['wired', 'wireless', 'problem'].includes(type)) {
      return res.status(400).json({ error: 'connection_type inválido' });
    }

    const result = await query(
      `UPDATE network_topology_connections
          SET label = $1,
              connection_type = $2
        WHERE id = $3
      RETURNING id, source_equipment_id, target_equipment_id, label, connection_type, created_at`,
      [label, type, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.delete('/topology/connections/:id', authMiddleware, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const result = await query('DELETE FROM network_topology_connections WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});


router.post('/ping', authMiddleware, async (req, res) => {
  const ip = normalizeIpv4(req.body?.ip);
  if (!ip) {
    return res.status(400).json({ error: 'IP inválido para ping' });
  }

  // Windows usa -n para número de pacotes, Linux usa -c
  const isWindows = process.platform === 'win32';
  const command = isWindows ? `ping -n 1 ${ip}` : `ping -c 1 ${ip}`;

  exec(command, (error, stdout, stderr) => {
    res.json({
      data: {
        output: stdout || stderr || 'Sem resposta do comando ping',
        success: !error
      }
    });
  });
});

router.post('/ping/batch', authMiddleware, async (req, res) => {
  const ips = Array.isArray(req.body?.ips) ? req.body.ips : [];
  if (ips.length === 0) {
    return res.status(400).json({ error: 'Nenhum IP fornecido para ping em lote' });
  }

  const isWindows = process.platform === 'win32';
  
  const pingPromises = ips.map(ip => {
    const validIp = normalizeIpv4(ip);
    if (!validIp) return Promise.resolve({ ip, success: false, error: 'IP Inválido' });

    const command = isWindows ? `ping -n 1 -w 1000 ${validIp}` : `ping -c 1 -W 1 ${validIp}`;
    
    return new Promise((resolve) => {
      exec(command, (error, stdout, stderr) => {
        resolve({
          ip: validIp,
          success: !error,
          output: stdout || stderr
        });
      });
    });
  });

  const results = await Promise.all(pingPromises);
  res.json({ data: results });
});

router.post('/scan-subnet', authMiddleware, async (req, res) => {
  try {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = '';
    
    // Tentar encontrar o IP da interface ethernet/wifi ativa
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp) break;
    }

    if (!localIp) {
      return res.status(500).json({ error: 'Não foi possível identificar o IP local do servidor.' });
    }

    // Gerar lista de IPs na sub-rede (considerando /24 por padrão)
    const ipParts = localIp.split('.');
    const subnetPrefix = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
    const ipsToScan = [];
    for (let i = 1; i <= 254; i++) {
      ipsToScan.push(`${subnetPrefix}.${i}`);
    }

    const isWindows = process.platform === 'win32';
    
    // Função para ping individual rápido (timeout de 500ms)
    const quickPing = (ip) => {
      const cmd = isWindows ? `ping -n 1 -w 500 ${ip}` : `ping -c 1 -W 0.5 ${ip}`;
      return new Promise((resolve) => {
        exec(cmd, (err) => resolve({ ip, success: !err }));
      });
    };

    // Executar em lotes de 20 para não sobrecarregar o OS
    const batchSize = 20;
    const results = [];
    for (let i = 0; i < ipsToScan.length; i += batchSize) {
      const batch = ipsToScan.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(quickPing));
      results.push(...batchResults);
    }

    res.json({ 
      data: { 
        totalScanned: ipsToScan.length, 
        onlineCount: results.filter(r => r.success).length,
        network: `${subnetPrefix}.0/24`
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mikrotik/sync', authMiddleware, async (req, res) => {
  const { host, port, user, password } = req.body;

  if (!host || !user || !password) {
    return res.status(400).json({ error: 'Configurações incompletas' });
  }

  try {
    const config = { host, port: port || '443', user, password };
    
    // Busca dados em paralelo
    const [leases, arp] = await Promise.all([
      mikrotikService.getDhcpLeases(config),
      mikrotikService.getArpTable(config)
    ]);

    res.json({
      success: true,
      data: {
        leases,
        arp,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Falha na sincronização MikroTik:', error.message);
    res.status(502).json({ 
      error: `Falha na comunicação com o MikroTik: ${error.message}`
    });
  }
});

router.post('/unifi/sync', authMiddleware, async (req, res) => {
  try {
    const data = await unifiService.getClients(req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(502).json({ error: `Falha na comunicação UniFi: ${error.message}` });
  }
});

router.post('/omada/sync', authMiddleware, async (req, res) => {
  try {
    const data = await omadaService.getClients(req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(502).json({ error: `Falha na comunicação Omada: ${error.message}` });
  }
});

router.post('/intelbras/sync', authMiddleware, async (req, res) => {
  try {
    const data = await intelbrasService.getDeviceSummary(req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(502).json({ error: `Falha na comunicação Intelbras: ${error.message}` });
  }
});

router.get('/vendors/status', authMiddleware, async (req, res) => {
  // Simulação de status das APIs de fabricantes
  res.json({
    data: [
      { id: 'mikrotik', online: true, lastCheck: new Date() },
      { id: 'unifi', online: false, reason: 'Chave de API expirada' },
      { id: 'omada', online: true, lastCheck: new Date() },
      { id: 'intelbras', online: true, lastCheck: new Date() }
    ]
  });
});

router.get('/discover', authMiddleware, async (req, res, next) => {
  try {
    const isWindows = process.platform === 'win32';
    const command = 'arp -a';

    exec(command, async (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: 'Erro ao executar arp -a' });
      }

      const output = stdout || stderr || '';
      const devices = [];
      const lines = output.split('\n');

      // Regex para encontrar IPs e MACs
      // Exemplo Windows: 192.168.0.1      00-11-22-33-44-55     dinâmico
      // Exemplo Linux: ? (192.168.0.1) at 00:11:22:33:44:55 [ether] on eth0
      const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;
      const macRegex = /([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})/;

      lines.forEach(line => {
        const ipMatch = line.match(ipRegex);
        const macMatch = line.match(macRegex);

        if (ipMatch && macMatch) {
          const ip = ipMatch[1];
          const macRaw = macMatch[1];
          const mac = normalizeMac(macRaw);

          // Ignorar endereços de broadcast/multicast comuns
          if (ip.endsWith('.255') || ip.startsWith('224.') || ip.startsWith('239.')) return;
          if (mac === 'FF:FF:FF:FF:FF:FF') return;

          devices.push({ ip, mac });
        }
      });

      // Remover duplicatas de MAC (arp -a pode mostrar por interface)
      const uniqueDevices = [];
      const seenMacs = new Set();
      devices.forEach(d => {
        if (!seenMacs.has(d.mac)) {
          seenMacs.add(d.mac);
          uniqueDevices.push(d);
        }
      });

      // Buscar MACs registrados
      const registeredResult = await query('SELECT mac_address FROM equipment_network WHERE mac_address IS NOT NULL');
      const registeredMacs = new Set(registeredResult.rows.map(r => r.mac_address.toUpperCase()));

      const finalDevices = uniqueDevices.map(d => ({
        ...d,
        isRegistered: registeredMacs.has(d.mac.toUpperCase())
      }));

      res.json({ data: finalDevices });
    });
  } catch (err) {
    next(err);
  }
});

module.exports = { router };
