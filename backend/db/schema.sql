CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================
-- RBAC: colunas de cargo e permissões em users
-- ===========================
ALTER TABLE users ADD COLUMN IF NOT EXISTS cargo TEXT NOT NULL DEFAULT 'usuario';
ALTER TABLE users ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissoes JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS colaboradores (
  colaborador_id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  departamento TEXT,
  cargo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  foto_colaborador TEXT,
  data_entrada DATE,
  data_saida DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipamentos (
  etiqueta_id TEXT PRIMARY KEY,
  codigo_barras TEXT,
  tipo_equipamento TEXT NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  numero_serie TEXT,
  foto_equipamento TEXT,
  propriedade TEXT NOT NULL DEFAULT 'empresa',
  proprietario_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL,
  comprovante_propriedade TEXT,
  status TEXT NOT NULL DEFAULT 'Disponível',
  localizacao TEXT,
  data_aquisicao DATE,
  observacoes TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  quantidade_em_uso INTEGER NOT NULL DEFAULT 0,
  colaborador_atual_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimentacoes (
  movimentacao_id TEXT PRIMARY KEY,
  equipamento_id TEXT NOT NULL REFERENCES equipamentos(etiqueta_id) ON DELETE CASCADE,
  colaborador_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL,
  tipo_movimentacao TEXT NOT NULL,
  setor_origem TEXT,
  setor_destino TEXT,
  data_inicio DATE,
  data_fim DATE,
  responsavel TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS dono_anterior_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS dono_anterior_nome TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS dono_anterior_matricula TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS dono_anterior_setor TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS data_vinculo_anterior DATE;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS novo_dono_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS novo_dono_nome TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS novo_dono_matricula TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS novo_dono_setor TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS data_novo_vinculo DATE;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS tecnico_responsavel_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS tecnico_responsavel_nome TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS motivo TEXT NOT NULL DEFAULT '';
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS protocolo_solicitacao TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS status_anterior TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS status_novo TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS localizacao_anterior TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS localizacao_nova TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS descricao_detalhada TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS link_solicitacao TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS assinatura_digital TEXT;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS confirmado_usuario BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS equipamento_substituto_id TEXT REFERENCES equipamentos(etiqueta_id) ON DELETE SET NULL;

UPDATE movimentacoes
   SET data_hora = COALESCE(data_hora, data_inicio::timestamptz, created_at)
 WHERE data_hora IS NULL;

UPDATE movimentacoes
   SET motivo = COALESCE(NULLIF(trim(motivo), ''), COALESCE(observacao, 'Movimentação registrada no sistema'))
 WHERE motivo IS NULL OR trim(motivo) = '';

CREATE INDEX IF NOT EXISTS idx_equipamentos_status ON equipamentos(status);
CREATE INDEX IF NOT EXISTS idx_equipamentos_colaborador ON equipamentos(colaborador_atual_id);
CREATE INDEX IF NOT EXISTS idx_equipamentos_propriedade ON equipamentos(propriedade, status);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_equipamento ON movimentacoes(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_colaborador ON movimentacoes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data_hora ON movimentacoes(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_usuarios ON movimentacoes(dono_anterior_id, novo_dono_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_protocolo ON movimentacoes(protocolo_solicitacao);

ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS propriedade TEXT NOT NULL DEFAULT 'empresa';
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS proprietario_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS comprovante_propriedade TEXT;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS especificacoes JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS custo_aquisicao NUMERIC(12,2);
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS data_compra DATE;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS nota_fiscal TEXT;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS local_compra TEXT;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS link_loja TEXT;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS lote_tag TEXT;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS familia_id BIGINT;

CREATE TABLE IF NOT EXISTS familias_equipamentos (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  especificacoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  quantidade_total INT NOT NULL DEFAULT 0,
  descricao_completa TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tipo, marca, modelo, especificacoes)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.table_constraints
     WHERE table_name = 'equipamentos'
       AND constraint_name = 'fk_equipamentos_familia'
  ) THEN
    ALTER TABLE equipamentos
      ADD CONSTRAINT fk_equipamentos_familia
      FOREIGN KEY (familia_id) REFERENCES familias_equipamentos(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS equipment_network (
  equipment_id TEXT PRIMARY KEY REFERENCES equipamentos(etiqueta_id) ON DELETE CASCADE,
  ip_address TEXT,
  mac_address TEXT,
  subnet_mask TEXT,
  default_gateway TEXT,
  dns_primary TEXT,
  dns_secondary TEXT,
  vlan_id INTEGER,
  switch_name TEXT,
  switch_port TEXT,
  total_ports INTEGER,
  network_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS network_topology_nodes (
  id SERIAL PRIMARY KEY,
  equipment_id TEXT NOT NULL REFERENCES equipamentos(etiqueta_id) ON DELETE CASCADE,
  pos_x FLOAT NOT NULL DEFAULT 100,
  pos_y FLOAT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (equipment_id)
);

CREATE TABLE IF NOT EXISTS network_topology_connections (
  id SERIAL PRIMARY KEY,
  source_equipment_id TEXT NOT NULL REFERENCES equipamentos(etiqueta_id) ON DELETE CASCADE,
  target_equipment_id TEXT NOT NULL REFERENCES equipamentos(etiqueta_id) ON DELETE CASCADE,
  label VARCHAR(100),
  connection_type VARCHAR(20) DEFAULT 'wired',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_network_ip ON equipment_network(ip_address);
CREATE INDEX IF NOT EXISTS idx_equipment_network_mac ON equipment_network(mac_address);
CREATE INDEX IF NOT EXISTS idx_equipment_network_vlan ON equipment_network(vlan_id);
CREATE INDEX IF NOT EXISTS idx_equipment_network_switch ON equipment_network(switch_name);
-- idx_network_nodes_equipment removido: coberto pelo UNIQUE(equipment_id)
CREATE INDEX IF NOT EXISTS idx_network_connections_source ON network_topology_connections(source_equipment_id);
CREATE INDEX IF NOT EXISTS idx_network_connections_target ON network_topology_connections(target_equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'equipment_network'
      AND constraint_name = 'chk_equipment_network_vlan'
  ) THEN
    ALTER TABLE equipment_network
      ADD CONSTRAINT chk_equipment_network_vlan
      CHECK (vlan_id IS NULL OR (vlan_id BETWEEN 1 AND 4094));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'network_topology_connections'
      AND constraint_name = 'chk_network_connection_type'
  ) THEN
    ALTER TABLE network_topology_connections
      ADD CONSTRAINT chk_network_connection_type
      CHECK (connection_type IN ('wired', 'wireless', 'problem'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS solicitacao_protocolos_seq (
  periodo TEXT PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solicitacoes (
  solicitacao_id TEXT PRIMARY KEY,
  protocolo TEXT NOT NULL UNIQUE,
  tipo_solicitacao TEXT NOT NULL,
  solicitante_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL,
  solicitante_nome TEXT NOT NULL,
  departamento TEXT NOT NULL,
  centro_custo TEXT,
  equipamento_atual_id TEXT REFERENCES equipamentos(etiqueta_id) ON DELETE SET NULL,
  tipo_equipamento_solicitado TEXT,
  descricao_problema TEXT,
  justificativa TEXT,
  urgencia TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_necessidade DATE,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_conclusao TIMESTAMPTZ,
  anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_por_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solicitacao_checklists (
  checklist_id TEXT PRIMARY KEY,
  solicitacao_id TEXT NOT NULL UNIQUE REFERENCES solicitacoes(solicitacao_id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  responsavel_colaborador_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL,
  responsavel_colaborador_nome TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solicitacao_checklist_itens (
  item_id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL REFERENCES solicitacao_checklists(checklist_id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 1,
  descricao TEXT NOT NULL,
  tipo_item TEXT NOT NULL DEFAULT 'geral',
  equipamento_id TEXT REFERENCES equipamentos(etiqueta_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacao TEXT,
  anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
  concluido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checklist_templates (
  template_id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  responsavel_colaborador_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL,
  responsavel_colaborador_nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checklist_template_itens (
  template_item_id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES checklist_templates(template_id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 1,
  descricao TEXT NOT NULL,
  tipo_item TEXT NOT NULL DEFAULT 'geral',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processamentos (
  processamento_id TEXT PRIMARY KEY,
  solicitacao_id TEXT NOT NULL REFERENCES solicitacoes(solicitacao_id) ON DELETE CASCADE,
  equipamento_id TEXT REFERENCES equipamentos(etiqueta_id) ON DELETE SET NULL,
  colaborador_destino_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL,
  colaborador_destino_nome TEXT,
  colaborador_destino_departamento TEXT,
  tecnico_ti_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  tecnico_ti_nome TEXT,
  tipo_acao TEXT NOT NULL,
  diagnostico TEXT,
  observacoes TEXT,
  equipamento_anterior_id TEXT REFERENCES equipamentos(etiqueta_id) ON DELETE SET NULL,
  confirmacao_entrega BOOLEAN NOT NULL DEFAULT FALSE,
  equipamento_testado BOOLEAN,
  assinatura_recebimento TEXT,
  data_processamento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_confirmacao TIMESTAMPTZ,
  cancelado BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_rejeicao TEXT
);

ALTER TABLE processamentos ADD COLUMN IF NOT EXISTS colaborador_destino_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL;
ALTER TABLE processamentos ADD COLUMN IF NOT EXISTS colaborador_destino_nome TEXT;
ALTER TABLE processamentos ADD COLUMN IF NOT EXISTS colaborador_destino_departamento TEXT;

-- alocacoes, historico_equipamentos, logs_sincronizacao, auditoria_eventos removidas (2026-03-10)

CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes(status, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_tipo ON solicitacoes(tipo_solicitacao, urgencia);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_departamento ON solicitacoes(departamento);
-- idx_checklists_solicitacao removido: coberto pelo UNIQUE(solicitacao_id)
CREATE INDEX IF NOT EXISTS idx_checklists_responsavel ON solicitacao_checklists(responsavel_colaborador_id);
CREATE INDEX IF NOT EXISTS idx_checklist_itens_checklist ON solicitacao_checklist_itens(checklist_id, ordem);
CREATE INDEX IF NOT EXISTS idx_checklist_itens_status ON solicitacao_checklist_itens(status);
CREATE INDEX IF NOT EXISTS idx_checklist_template_nome ON checklist_templates(nome);
CREATE INDEX IF NOT EXISTS idx_checklist_template_itens_template ON checklist_template_itens(template_id, ordem);
CREATE INDEX IF NOT EXISTS idx_processamentos_solicitacao ON processamentos(solicitacao_id, data_processamento DESC);
-- idx_alocacoes_solicitacao, idx_logs_sync_protocolo: tabelas removidas

-- Migração de polegadas/descricao para especificacoes já concluída (colunas removidas)

-- ===========================
-- VISTORIAS (INSPEÇÕES TÉCNICAS)
-- ===========================
CREATE TABLE IF NOT EXISTS equipment_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id TEXT NOT NULL REFERENCES equipamentos(etiqueta_id) ON DELETE CASCADE,
  inspector_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  data_vistoria TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score_calculado INTEGER NOT NULL,
  notas_gerais TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES equipment_inspections(id) ON DELETE CASCADE,
  item_nome TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('bom', 'alerta', 'critico')),
  comentario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vistorias_equipamento ON equipment_inspections(equipment_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_data ON equipment_inspections(data_vistoria DESC);

-- ===========================
-- AUDITORIA (AUDIT TRAIL)
-- ===========================
CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id SERIAL PRIMARY KEY,
  entidade TEXT NOT NULL,          -- 'equipamento', 'solicitacao', 'colaborador'
  entidade_id TEXT NOT NULL,
  acao TEXT NOT NULL,              -- 'create', 'update', 'delete', 'process'
  payload JSONB,                   -- Dados da alteração
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  user_nome TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entidade ON audit_logs(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

INSERT INTO familias_equipamentos (tipo, marca, modelo, especificacoes, quantidade_total, descricao_completa)
SELECT
  e.tipo_equipamento,
  e.marca,
  e.modelo,
  COALESCE(e.especificacoes, '{}'::jsonb),
  COUNT(*)::int,
  trim(concat_ws(' ', e.tipo_equipamento, e.marca, e.modelo))
FROM equipamentos e
LEFT JOIN familias_equipamentos f
  ON f.tipo = e.tipo_equipamento
 AND f.marca = e.marca
 AND f.modelo = e.modelo
 AND f.especificacoes = COALESCE(e.especificacoes, '{}'::jsonb)
WHERE f.id IS NULL
GROUP BY e.tipo_equipamento, e.marca, e.modelo, COALESCE(e.especificacoes, '{}'::jsonb);

UPDATE equipamentos e
   SET familia_id = f.id
  FROM familias_equipamentos f
 WHERE e.familia_id IS NULL
   AND f.tipo = e.tipo_equipamento
   AND f.marca = e.marca
   AND f.modelo = e.modelo
   AND f.especificacoes = COALESCE(e.especificacoes, '{}'::jsonb);

UPDATE familias_equipamentos f
   SET quantidade_total = COALESCE(sub.total, 0),
       atualizado_em = NOW()
  FROM (
    SELECT familia_id, COUNT(*)::int AS total
      FROM equipamentos
     WHERE familia_id IS NOT NULL
     GROUP BY familia_id
  ) sub
 WHERE f.id = sub.familia_id;

CREATE INDEX IF NOT EXISTS idx_equipamentos_familia ON equipamentos(familia_id);
-- idx_familias_lookup removido: coberto pelo UNIQUE(tipo, marca, modelo, especificacoes)

UPDATE equipamentos
   SET propriedade = CASE
     WHEN lower(trim(COALESCE(propriedade, ''))) IN ('usuario', 'usuário', 'pessoal') THEN 'usuario'
     ELSE 'empresa'
   END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'equipamentos'
      AND constraint_name = 'chk_equipamentos_propriedade'
  ) THEN
    ALTER TABLE equipamentos
      ADD CONSTRAINT chk_equipamentos_propriedade
      CHECK (propriedade IN ('empresa', 'usuario'));
  END IF;
END $$;

-- ===========================
-- Limpeza: colunas órfãs removidas (2026-03-10)
-- ===========================
ALTER TABLE movimentacoes DROP COLUMN IF EXISTS dono_antigo_id;
ALTER TABLE movimentacoes DROP COLUMN IF EXISTS dono_novo_id;
ALTER TABLE movimentacoes DROP COLUMN IF EXISTS antigo_dono_id;
ALTER TABLE movimentacoes DROP COLUMN IF EXISTS antigo_dono_nome;
ALTER TABLE movimentacoes DROP COLUMN IF EXISTS antigo_dono;
ALTER TABLE movimentacoes DROP COLUMN IF EXISTS novo_dono;
ALTER TABLE equipamentos DROP COLUMN IF EXISTS polegadas;
ALTER TABLE equipamentos DROP COLUMN IF EXISTS descricao;

-- ===========================
-- CHAT E NOTIFICAÇÕES (2026-03-10)
-- ===========================
CREATE TABLE IF NOT EXISTS chat_mensagens (
  mensagem_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contexto_tipo TEXT NOT NULL CHECK (contexto_tipo IN ('movimentacao', 'solicitacao')),
  contexto_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  user_nome TEXT NOT NULL,
  texto TEXT,
  arquivo_nome TEXT,
  arquivo_tipo TEXT,
  arquivo_dados TEXT,
  fixada BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_mensagens_contexto ON chat_mensagens(contexto_tipo, contexto_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_created ON chat_mensagens(created_at DESC);

CREATE TABLE IF NOT EXISTS chat_leituras (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  contexto_tipo TEXT NOT NULL,
  contexto_id TEXT NOT NULL,
  ultima_leitura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, contexto_tipo, contexto_id)
);

-- ===========================================================================================
-- PENTE FINO — QUALIDADE DO SCHEMA (2026-03-10)
-- Constraints de integridade, índices de performance e view de atrasos
-- ===========================================================================================

-- ------------------------------------------------------------------------------------------
-- 1. CHECK CONSTRAINTS — validação de domínio no nível do banco
--    Garante que valores inválidos nunca entrem nas colunas críticas
-- ------------------------------------------------------------------------------------------

-- Normalizar valores legados antes de adicionar constraints
UPDATE solicitacoes SET urgencia = 'alta'   WHERE urgencia NOT IN ('baixa', 'media', 'alta');
UPDATE solicitacoes SET status   = 'pendente' WHERE status NOT IN ('pendente', 'em_atendimento', 'concluido', 'rejeitado');

DO $$
BEGIN
  -- solicitacoes: status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'solicitacoes' AND constraint_name = 'chk_sol_status'
  ) THEN
    ALTER TABLE solicitacoes
      ADD CONSTRAINT chk_sol_status
      CHECK (status IN ('pendente', 'em_atendimento', 'concluido', 'rejeitado'));
  END IF;

  -- solicitacoes: urgencia
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'solicitacoes' AND constraint_name = 'chk_sol_urgencia'
  ) THEN
    ALTER TABLE solicitacoes
      ADD CONSTRAINT chk_sol_urgencia
      CHECK (urgencia IN ('baixa', 'media', 'alta'));
  END IF;

  -- movimentacoes: tipo_movimentacao
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'movimentacoes' AND constraint_name = 'chk_mov_tipo'
  ) THEN
    ALTER TABLE movimentacoes
      ADD CONSTRAINT chk_mov_tipo
      CHECK (tipo_movimentacao IN ('alocacao', 'devolucao', 'transferencia', 'manutencao', 'substituicao'));
  END IF;

  -- solicitacao_checklists: status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'solicitacao_checklists' AND constraint_name = 'chk_checklist_status'
  ) THEN
    ALTER TABLE solicitacao_checklists
      ADD CONSTRAINT chk_checklist_status
      CHECK (status IN ('pendente', 'em_andamento', 'concluido'));
  END IF;

  -- processamentos: tipo_acao não pode ser vazio
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'processamentos' AND constraint_name = 'chk_proc_tipo_acao'
  ) THEN
    ALTER TABLE processamentos
      ADD CONSTRAINT chk_proc_tipo_acao
      CHECK (tipo_acao <> '');
  END IF;
END $$;

-- ------------------------------------------------------------------------------------------
-- 2. ÍNDICES DE PERFORMANCE — consultas críticas do negócio
-- ------------------------------------------------------------------------------------------

-- Atrasos: buscar solicitações com prazo vencido ainda em aberto (consulta mais frequente)
CREATE INDEX IF NOT EXISTS idx_sol_necessidade_aberta
  ON solicitacoes(data_necessidade)
  WHERE data_necessidade IS NOT NULL
    AND status NOT IN ('concluido', 'rejeitado');

-- Dashboard: solicitações abertas por urgência
CREATE INDEX IF NOT EXISTS idx_sol_urgencia_aberta
  ON solicitacoes(urgencia, data_criacao DESC)
  WHERE status NOT IN ('concluido', 'rejeitado');

-- Calendário: filtro por período de criação
CREATE INDEX IF NOT EXISTS idx_sol_data_criacao
  ON solicitacoes(data_criacao DESC);

-- idx_historico_equip_data: historico_equipamentos removida

-- ------------------------------------------------------------------------------------------
-- 3. VIEW DE SOLICITAÇÕES ATRASADAS — relatório e calendário
--    Substitui lógica de filtragem no código da aplicação
-- ------------------------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_solicitacoes_atrasadas AS
SELECT
  solicitacao_id,
  protocolo,
  tipo_solicitacao,
  solicitante_nome,
  departamento,
  urgencia,
  status,
  data_necessidade,
  data_criacao,
  (CURRENT_DATE - data_necessidade)::int AS dias_atraso
FROM solicitacoes
WHERE data_necessidade IS NOT NULL
  AND data_necessidade < CURRENT_DATE
  AND status NOT IN ('concluido', 'rejeitado')
ORDER BY urgencia DESC, data_necessidade ASC;

-- ------------------------------------------------------------------------------------------
-- 4. INVENTÁRIO DE TABELAS — situação de uso (2026-03-10)
-- ------------------------------------------------------------------------------------------
-- TABELAS ATIVAS (lidas + escritas pelas rotas):
--   users, colaboradores, equipamentos, familias_equipamentos
--   movimentacoes, equipment_network, network_topology_nodes, network_topology_connections
--   solicitacoes, solicitacao_protocolos_seq, processamentos
--   solicitacao_checklists, solicitacao_checklist_itens
--   chat_mensagens, chat_leituras
--
-- TABELAS ÓRFÃS (nenhum código as toca):
--   checklist_templates    → feature não implementada no front/back
--   checklist_template_itens
--
-- TABELAS REMOVIDAS (2026-03-10):
--   alocacoes              → duplicava processamentos.tipo_acao='alocacao'
--   historico_equipamentos → duplicava trilha de movimentacoes
--   logs_sincronizacao     → integração externa nunca implementada
--   auditoria_eventos      → trilha coberta por movimentacoes
--   typeorm_migrations     → remanescente de experimento ORM abandonado

-- ===========================
-- RECUPERAÇÃO DE SENHA
-- ===========================
CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- ===========================
-- PUSH NOTIFICATIONS (WEB PUSH)
-- ===========================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  expiration_time TEXT,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
