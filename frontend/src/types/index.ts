export interface Colaborador {
  colaboradorID: string;
  nome: string;
  email: string;
  departamento: string;
  cargo: string;
  fotoColaborador?: string | null;
  ativo?: boolean;
  observacoes?: string;
}

export interface Equipamento {
  etiquetaID: string;
  marca?: string;
  modelo?: string;
  tipoEquipamento?: string;
  numeroSerie?: string;
  localizacao?: string;
  status?: string;
  fotoEquipamento?: string;
  dataCompra?: string;
  valorCompra?: number;
  colaboradorAtualID?: string;
  propriedade?: 'empresa' | 'usuario';
  observacoes?: string;
  dataAquisicao?: string;
  custoAquisicao?: string | number;
  localCompra?: string;
  linkLoja?: string;
  ip_address?: string;
  mac_address?: string;
  subnet_mask?: string;
  default_gateway?: string;
  dns_primary?: string;
  dns_secondary?: string;
  vlan_id?: string;
  switch_name?: string;
  switch_port?: string;
  total_ports?: number;
  network_notes?: string;
  manutencoes?: any[];
  setor?: string;
  descricao?: string;
  especificacoes?: {
    descricao?: string;
    [key: string]: any;
  };
  saude?: number;
  dataVistoria?: string;
}

export interface Movimentacao {
  movimentacaoID?: string;
  equipamentoID: string;
  tipoMovimentacao: "alocacao" | "devolucao" | "transferencia" | "manutencao" | "substituicao" | string;
  colaboradorID?: string;
  donoAnteriorID?: string;
  novoDonoID?: string;
  motivo?: string;
  responsavel?: string;
  dataHora?: string;
  novoDonoNome?: string;
  donoAnteriorNome?: string;
  descricaoDetalhada?: string;
  descricao?: string;
  protocolo?: string;
  // Joined fields
  marca?: string;
  modelo?: string;
  tipoEquipamento?: string;
  fotoEquipamento?: string | null;
  donoAnteriorFoto?: string | null;
  novoDonoFoto?: string | null;
  tecnicoResponsavelFoto?: string | null;
  protocoloSolicitacao?: string;
}

export interface Solicitacao {
  solicitacaoID: string;
  protocolo?: string;
  tipoSolicitacao: string;
  solicitanteNome: string;
  solicitanteID: string;
  departamento?: string;
  equipamentoAtualID?: string;
  urgencia: "baixa" | "media" | "alta" | "critica";
  status: string;
  descricaoResumo?: string;
  descricao?: string;
  dataSolicitacao?: string;
  dataNecessidade?: string;
  dataCriacao?: string;
  dataConclusao?: string;
  colaboradorDestinoID?: string;
  colaboradorDestinoNome?: string;
  colaboradorDestinoDepartamento?: string;
  solicitanteFoto?: string | null;
  tecnicoTIFoto?: string | null;
  tecnicoTINome?: string | null;
  colaboradorDestinoFoto?: string | null;
  checklistResponsavelFoto?: string | null;
  tipoAcao?: string;
  observacoesTI?: string;
  processamentoID?: string;
  equipamentoAlocadoID?: string;
  confirmacaoEntrega?: boolean;
  dataProcessamento?: string;
  dataConfirmacao?: string;
  checklistID?: string;
  checklistStatus?: string;
  checklistTotalItens?: number;
  checklistItensPendentes?: number;
  checklistItensConcluidos?: number;
  anexos?: any[];
}

export interface ChatConversation {
  contextoTipo: "movimentacao" | "solicitacao";
  contextoId: string;
  ultimaMensagemAt: string;
  ultimoRemetente?: string;
  ultimoTexto?: string;
  naoLidos: number;
}

export interface ChatMessage {
  mensagemId: string;
  userNome: string;
  texto: string;
  createdAt: string;
  arquivoNome?: string;
  arquivoTipo?: string;
  arquivoDados?: string;
  fixada?: boolean;
}

export interface ChecklistItem {
  itemID: string;
  ordem: number;
  descricao: string;
  status: "pendente" | "concluido" | "nao_efetuada" | "atencao";
  observacao?: string;
  tipoItem?: string;
  equipamentoID?: string;
}

export interface Checklist {
  itens: ChecklistItem[];
  inventario?: any[];
}
