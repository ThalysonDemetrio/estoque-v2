import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { EquipamentosService } from "@/services/equipamentos.service";
import { useToast } from "@/contexts/ToastContext";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { NMCombobox } from "@/components/ui/NMCombobox";
import { ColaboradoresService } from "@/services/colaboradores.service";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";
import { useChat } from "@/contexts/ChatContext";
import { Equipamento } from "@/types";

interface EquipamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  equipamentoData?: Equipamento; // If passed, it's edit mode
  switches?: Equipamento[];
  inventory?: Equipamento[];
}

export function EquipamentoModal({
  isOpen,
  onClose,
  onSuccess,
  equipamentoData,
  switches,
  inventory = [],
}: EquipamentoModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Equipamento>>({
    etiquetaID: "",
    tipoEquipamento: "",
    marca: "",
    modelo: "",
    numeroSerie: "",
    status: "Disponível",
    propriedade: "empresa",
    localizacao: "",
    dataCompra: "",
    custoAquisicao: "",
    localCompra: "",
    linkLoja: "",
    observacoes: "",
    fotoEquipamento: "",
    ip_address: "",
    mac_address: "",
    subnet_mask: "",
    default_gateway: "",
    dns_primary: "",
    dns_secondary: "",
    vlan_id: "",
    switch_name: "",
    switch_port: "",
    network_notes: "",
    colaboradorAtualID: "",
  });
  const [colaboradores, setColaboradores] = useState<any[]>([]);

  const isEditMode = !!equipamentoData;
  const toast = useToast();
  const { triggerRefresh } = useChat();
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (equipamentoData) {
        // Objeto com todos os campos padrão inicializados como ""
        const defaultFields = {
          etiquetaID: "",
          tipoEquipamento: "",
          marca: "",
          modelo: "",
          numeroSerie: "",
          status: "Disponível",
          propriedade: "empresa",
          localizacao: "",
          dataCompra: "",
          custoAquisicao: "",
          localCompra: "",
          linkLoja: "",
          observacoes: "",
          fotoEquipamento: "",
          ip_address: "",
          mac_address: "",
          subnet_mask: "",
          default_gateway: "",
          dns_primary: "",
          dns_secondary: "",
          vlan_id: "",
          switch_name: "",
          switch_port: "",
          total_ports: undefined,
          network_notes: "",
        };

        const sanitizedData = Object.fromEntries(
          Object.entries(equipamentoData).map(([key, value]) => {
            if (key === "dataCompra" && value) {
              // Ensure ISO date is stripped of time for the input[type=date]
              return [key, String(value).split("T")[0]];
            }
            return [key, value === null || value === undefined ? "" : value];
          })
        );

        setFormData({
          ...defaultFields,
          ...sanitizedData,
          propriedade: (sanitizedData.propriedade as "empresa" | "usuario") || "empresa",
        });
      } else {
        setFormData({
          etiquetaID: "",
          tipoEquipamento: "",
          marca: "",
          modelo: "",
          numeroSerie: "",
          status: "Disponível",
          propriedade: "empresa",
          localizacao: "",
          dataCompra: "",
          custoAquisicao: "",
          localCompra: "",
          linkLoja: "",
          observacoes: "",
          network_notes: "",
          colaboradorAtualID: "",
        });
      }

      // Fetch colaboradores for the selector
      ColaboradoresService.getColaboradores({}).then(data => {
        setColaboradores(Array.isArray(data) ? data : []);
      }).catch(err => console.error("Erro ao carregar colaboradores:", err));
    }
  }, [isOpen, equipamentoData]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ 
      ...prev, 
      [name]: name === "total_ports" ? (value === "" ? undefined : parseInt(value)) : value 
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande", "A foto deve ter no máximo 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData((prev: any) => ({ ...prev, fotoEquipamento: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        custoAquisicao: formData.custoAquisicao ? Number(formData.custoAquisicao) : null,
      };

      if (isEditMode) {
        await EquipamentosService.updateEquipamento(payload.etiquetaID as string, payload as any);
        toast.success("Equipamento atualizado!", `${payload.etiquetaID} salvo com sucesso.`);
      } else {
        await EquipamentosService.createEquipamento(payload as any);
        toast.success("Equipamento criado!", `${payload.etiquetaID || payload.tipoEquipamento} cadastrado.`);
      }
      triggerRefresh(); // SpaceStock Sync
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar", error.message || "Verifique os campos e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <SlidebarPanel
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="bg-white dark:bg-slate-900 h-full w-full border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
    >
      <SlidebarHeader
        title={isEditMode ? "Editar Equipamento" : "Novo Equipamento"}
        subtitle={isEditMode ? "Atualizacao de cadastro" : "Cadastro de inventario"}
        iconClassName={isEditMode ? "fa-pen-to-square" : "fa-laptop-medical"}
        onClose={onClose}
        className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between"
        titleClassName="text-xl font-black text-slate-900 dark:text-white"
        subtitleClassName="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1"
      />

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="equipamentoForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Etiqueta ID *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="etiquetaID"
                    value={formData.etiquetaID || ""}
                    onChange={handleChange}
                    disabled={isEditMode}
                    required
                    placeholder="Ex: EQ-001"
                    className="flex-1 px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 disabled:opacity-50"
                  />
                  {!isEditMode && (
                    <button type="button" onClick={() => setScannerOpen(true)}
                      title="Escanear código de barras"
                      aria-label="Escanear codigo de barras"
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shrink-0">
                      <i className="fa-solid fa-barcode"></i>
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Tipo *
                </label>
                <select
                  name="tipoEquipamento"
                  value={formData.tipoEquipamento || ""}
                  onChange={handleChange}
                  title="Tipo de equipamento"
                  aria-label="Tipo de equipamento"
                  required
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main dark:[color-scheme:dark]"
                >
                  <option value="">Selecione...</option>
                  <option value="Monitor">Monitor</option>
                  <option value="Computador">Computador</option>
                  <option value="Switch">Switch</option>
                  <option value="Roteador">Roteador</option>
                  <option value="Fone de Ouvido">Fone de Ouvido</option>
                  <option value="Braço Articulado">Braço Articulado</option>
                  <option value="Mouse">Mouse</option>
                  <option value="Teclado">Teclado</option>
                  <option value="Cabo">Cabo</option>
                  <option value="Acessório">Acessório</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Marca *
                </label>
                <input
                  type="text"
                  name="marca"
                  value={formData.marca || ""}
                  onChange={handleChange}
                  required
                  placeholder="Dell, HP, Logitech..."
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Modelo *
                </label>
                <input
                  type="text"
                  name="modelo"
                  value={formData.modelo || ""}
                  onChange={handleChange}
                  required
                  placeholder="Ex: U2420"
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Número de Série
                </label>
                <input
                  type="text"
                  name="numeroSerie"
                  value={formData.numeroSerie || ""}
                  onChange={handleChange}
                  placeholder="Número de série (Opcional)"
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Status *
                </label>
                <select
                  name="status"
                  value={formData.status || "Disponível"}
                  onChange={handleChange}
                  title="Status do equipamento"
                  aria-label="Status do equipamento"
                  required
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main dark:[color-scheme:dark]"
                >
                  <option value="Disponível">Disponível</option>
                  <option value="Em Uso">Em Uso</option>
                  <option value="Em Uso - Infraestrutura">Em Uso - Infraestrutura</option>
                  <option value="Em Uso - Pessoal">Em Uso - Pessoal</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Retirado">Retirado</option>
                  <option value="Baixado">Baixado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Propriedade *
                </label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="propriedade"
                      value="empresa"
                      checked={formData.propriedade === "empresa"}
                      onChange={handleChange}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Empresa</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="propriedade"
                      value="usuario"
                      checked={formData.propriedade === "usuario"}
                      onChange={handleChange}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Pessoal / Usuário</span>
                  </label>
                </div>

                <div className="mt-4">
                  <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                    Usuário Atual / Dono
                  </label>
                  <NMCombobox
                    placeholder="Selecione o colaborador..."
                    options={colaboradores.map(c => ({
                      value: String(c.colaboradorID || c.id),
                      label: c.nome,
                      sublabel: c.departamento || c.cargo,
                      icon: "fa-user"
                    }))}
                    value={formData.colaboradorAtualID || ""}
                    onChange={(val) => setFormData(p => ({ ...p, colaboradorAtualID: val }))}
                  />
                  <p className="text-[9px] text-muted mt-1 ml-1 leading-tight">
                    * Defina o responsável inicial. Para equipamentos pessoais, o dono é obrigatório.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Foto do Equipamento
                </label>
                <div className="flex items-start gap-3">
                  {/* Preview */}
                  <div className="w-16 h-16 shrink-0 rounded-2xl overflow-hidden bg-surface-soft border border-border-subtle flex items-center justify-center shadow-nm-inset">
                    {formData.fotoEquipamento ? (
                      <Image 
                        src={formData.fotoEquipamento} 
                        alt="preview" 
                        width={64} 
                        height={64} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <i className="fa-solid fa-image text-muted/30 text-xl"></i>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} title="Selecionar foto do equipamento" aria-label="Selecionar foto do equipamento" className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full px-4 py-3 text-[10px] font-black uppercase tracking-widest bg-surface-soft border border-border-subtle border-dashed rounded-2xl hover:bg-surface text-brand transition-all flex items-center justify-center gap-2 shadow-nm-flat">
                      <i className="fa-solid fa-upload text-xs"></i> Enviar foto (max 2MB)
                    </button>
                    {formData.fotoEquipamento && (
                      <button type="button" onClick={() => setFormData((p: any) => ({ ...p, fotoEquipamento: "" }))}
                        className="w-full text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors flex items-center justify-center gap-1">
                        <i className="fa-solid fa-trash-can text-[10px]"></i> Remover foto
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Localização
                </label>
                <input
                  type="text"
                  name="localizacao"
                  value={formData.localizacao || ""}
                  onChange={handleChange}
                  placeholder="Ex: Sala 101, Almoxarifado..."
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Data de Compra
                </label>
                <input
                  type="date"
                  name="dataCompra"
                  value={formData.dataCompra || ""}
                  onChange={handleChange}
                  title="Data de compra"
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main dark:[color-scheme:dark]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Custo (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="custoAquisicao"
                  value={formData.custoAquisicao ?? ""}
                  onChange={handleChange}
                  placeholder="Ex: 1500.50"
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Local de Compra
                </label>
                <input
                  type="text"
                  name="localCompra"
                  value={formData.localCompra || ""}
                  onChange={handleChange}
                  placeholder="Ex: Kalunga, Amazon..."
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50"
                />
              </div>
            </div>

            {/* ─── Detalhes de Rede (Collapsible) ─── */}
            <details className="group border border-slate-200 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 cursor-pointer select-none list-none">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <i className="fa-solid fa-network-wired text-blue-500"></i>
                  Detalhes de Rede
                </span>
                <i className="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform group-open:rotate-180"></i>
              </summary>
              <div className="p-4 space-y-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Endereço IP</label>
                    <input type="text" name="ip_address" value={formData.ip_address || ""} onChange={handleChange}
                      placeholder="192.168.1.10"
                      className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">MAC Address</label>
                    <input type="text" name="mac_address" value={formData.mac_address || ""} onChange={handleChange}
                      placeholder="AA:BB:CC:DD:EE:FF"
                      className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Máscara de Sub-rede</label>
                    <input type="text" name="subnet_mask" value={formData.subnet_mask || ""} onChange={handleChange}
                      placeholder="255.255.255.0"
                      className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Gateway Padrão</label>
                    <input type="text" name="default_gateway" value={formData.default_gateway || ""} onChange={handleChange}
                      placeholder="192.168.1.1"
                      className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">DNS Primário</label>
                    <input type="text" name="dns_primary" value={formData.dns_primary || ""} onChange={handleChange}
                      placeholder="8.8.8.8"
                      className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">DNS Secundário</label>
                    <input type="text" name="dns_secondary" value={formData.dns_secondary || ""} onChange={handleChange}
                      placeholder="1.1.1.1"
                      className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">VLAN ID</label>
                    <input type="number" name="vlan_id" value={formData.vlan_id || ""} onChange={handleChange}
                      placeholder="10" min={1} max={4094}
                      className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Switch</label>
                    <select
                      name="switch_name"
                      value={formData.switch_name || ""}
                      onChange={handleChange}
                      title="Switch"
                      aria-label="Switch"
                      className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main dark:[color-scheme:dark]"
                    >
                      <option value="">Nenhum/Direto</option>
                      {formData.switch_name && switches && !switches.some(s => s.etiquetaID === formData.switch_name) && (
                         <option value={formData.switch_name}>{formData.switch_name} (Não listado/Antigo)</option>
                      )}
                      {switches?.map(s => (
                         <option key={s.etiquetaID} value={s.etiquetaID}>
                            {s.marca} {s.modelo} ({s.etiquetaID})
                         </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Porta do Switch</label>
                    <select
                      name="switch_port"
                      value={formData.switch_port || ""}
                      onChange={handleChange}
                      disabled={!formData.switch_name}
                      className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main disabled:opacity-50"
                    >
                      <option value="">Selecionar Porta</option>
                      {(() => {
                        const selectedSwitch = switches?.find(s => s.etiquetaID === formData.switch_name);
                        if (!selectedSwitch) return null;
                        
                        const total = Number(selectedSwitch.total_ports || 0);
                        if (total <= 0) return <option disabled>Sem portas definidas</option>;

                        const usedPorts = new Set(
                          inventory
                            .filter(eq => eq.switch_name === selectedSwitch.etiquetaID && eq.etiquetaID !== formData.etiquetaID)
                            .map(eq => eq.switch_port)
                        );

                        const options = [];
                        for (let i = 1; i <= total; i++) {
                           const portName = `Porta ${i}`;
                           const isUsed = usedPorts.has(portName) || usedPorts.has(String(i));
                           if (!isUsed || formData.switch_port === portName || formData.switch_port === String(i)) {
                              options.push(<option key={i} value={portName}>{portName}</option>);
                           }
                        }
                        return options;
                      })()}
                    </select>
                  </div>
                </div>
                {formData.tipoEquipamento === "Switch" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Total de Portas</label>
                    <input type="number" name="total_ports" value={formData.total_ports || ""} onChange={handleChange}
                      placeholder="Ex: 24, 48" min={1}
                      className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Observações de Rede</label>
                  <textarea name="network_notes" value={formData.network_notes || ""} onChange={handleChange}
                    rows={2} placeholder="Anotações sobre a configuração de rede..."
                    className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 resize-none dark:text-slate-200" />
                </div>
              </div>
            </details>

            <div>
              <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
                Observações
              </label>
              <textarea
                name="observacoes"
                value={formData.observacoes || ""}
                onChange={handleChange}
                rows={3}
                placeholder="Detalhes adicionais..."
                className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 resize-none"
              ></textarea>
            </div>
          </form>
        </div>

      <SlidebarFooter className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="equipamentoForm"
            disabled={loading}
            className="py-3 px-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i> Salvando...
              </span>
            ) : (
              "Salvar Equipamento"
            )}
          </button>
        </div>
      </SlidebarFooter>
    </SlidebarPanel>

    {/* Barcode Scanner Modal */}
    <BarcodeScanner
      isOpen={scannerOpen}
      onClose={() => setScannerOpen(false)}
      title="Escanear Etiqueta do Equipamento"
      onScan={(code) => {
        setFormData((prev: any) => ({ ...prev, etiquetaID: code }));
        setScannerOpen(false);
      }}
    />
    </>
  );
}
