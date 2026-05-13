"use client";

import { useState, useEffect } from "react";
import { EquipamentosService } from "@/services/equipamentos.service";
import { ColaboradoresService } from "@/services/colaboradores.service";
import { MovimentacoesService } from "@/services/movimentacoes.service";
import { useToast } from "@/contexts/ToastContext";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";
import { NMCombobox, NMComboboxOption } from "@/components/ui/NMCombobox";
import { useChat } from "@/contexts/ChatContext";

interface MovimentacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MovimentacaoModal({ isOpen, onClose, onSuccess }: MovimentacaoModalProps) {
  const [loading, setLoading] = useState(false);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const toast = useToast();
  const { triggerRefresh } = useChat();
  const [form, setForm] = useState({
    equipamentoID: "",
    tipoMovimentacao: "",
    colaboradorID: "",
    motivo: "",
    responsavel: "",
    dataHora: new Date().toISOString().slice(0, 16),
    setorOrigem: "",
    setorDestino: "",
    observacao: "",
  });

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        EquipamentosService.getEquipamentos(),
        ColaboradoresService.getColaboradores(),
      ]).then(([eqs, cols]) => {
        setEquipamentos(Array.isArray(eqs) ? eqs : []);
        setColaboradores(Array.isArray(cols) ? cols : []);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.equipamentoID || !form.tipoMovimentacao || !form.motivo) {
      alert("Preencha: Equipamento, Tipo e Motivo!");
      return;
    }
    setLoading(true);
    try {
      await MovimentacoesService.createMovimentacao({
        ...form,
        novoDonoID: form.colaboradorID || undefined,
        responsavel: form.responsavel || "Sistema",
      });
      toast.success("Movimentação registrada!", `Tipo: ${form.tipoMovimentacao} — ${form.equipamentoID}`);
      triggerRefresh(); // SpaceStock Sync
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao registrar", error.message || "Verifique os campos e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const TIPOS = [
    { value: "alocacao", label: "Alocação" },
    { value: "transferencia", label: "Transferência" },
    { value: "devolucao", label: "Devolução" },
    { value: "manutencao", label: "Manutenção" },
    { value: "substituicao", label: "Substituição" },
  ];

  return (
    <SlidebarPanel
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="bg-white dark:bg-slate-900 h-full w-full border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
    >
      <SlidebarHeader
        title="Registrar Movimentação"
        subtitle="Processamento de Transição de Ativo"
        iconClassName="fa-arrows-rotate"
        onClose={onClose}
        className="p-8 border-b border-slate-100 dark:border-white/5 relative overflow-hidden shrink-0 bg-white dark:bg-slate-900 flex items-center justify-between"
        titleClassName="text-xl font-black tracking-tight text-slate-900 dark:text-white line-clamp-1"
        subtitleClassName="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mt-1"
      />

        <div className="p-6 overflow-y-auto flex-1">
          <form id="movForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NMCombobox
                label="Equipamento *"
                placeholder="Pesquisar por etiqueta ou modelo..."
                options={equipamentos.map(eq => ({
                  value: eq.etiquetaID,
                  label: eq.etiquetaID,
                  sublabel: `${eq.marca} ${eq.modelo} | ${eq.status} | ${eq.colaboradorAtualNome || 'Disponível'}`,
                  icon: "fa-laptop"
                }))}
                value={form.equipamentoID}
                onChange={(val) => setForm(p => ({ ...p, equipamentoID: val }))}
                required
              />
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Tipo de Movimentação *</label>
                <select name="tipoMovimentacao" value={form.tipoMovimentacao} onChange={handleChange} title="Tipo de movimentação" aria-label="Tipo de movimentação" required
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main dark:[color-scheme:dark]">
                  <option value="">Selecione...</option>
                  {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <NMCombobox
              label="Colaborador Destino"
              placeholder="Pesquisar por nome ou departamento..."
              options={colaboradores.map(c => ({
                value: c.colaboradorID,
                label: c.nome,
                sublabel: c.departamento,
                icon: "fa-user"
              }))}
              value={form.colaboradorID}
              onChange={(val) => setForm(p => ({ ...p, colaboradorID: val }))}
            />

            <div>
              <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Motivo *</label>
              <textarea name="motivo" value={form.motivo} onChange={handleChange} required rows={2}
                placeholder="Ex: Alocação para novo colaborador do setor TI..."
                className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 resize-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Responsável/Técnico</label>
                <input type="text" name="responsavel" value={form.responsavel} onChange={handleChange}
                  placeholder="Nome do responsável (Ex: Usuário / Técnico)"
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Data/Hora</label>
                <input type="datetime-local" name="dataHora" value={form.dataHora} onChange={handleChange} title="Data e hora"
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main dark:[color-scheme:dark]" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Setor de Origem</label>
                <input type="text" name="setorOrigem" value={form.setorOrigem} onChange={handleChange}
                  placeholder="Ex: Almoxarifado"
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Setor de Destino</label>
                <input type="text" name="setorDestino" value={form.setorDestino} onChange={handleChange}
                  placeholder="Ex: TI, RH..."
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Observações</label>
              <textarea name="observacao" value={form.observacao} onChange={handleChange} rows={2}
                placeholder="Anotações adicionais..."
                className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 resize-none" />
            </div>
          </form>
        </div>

      <SlidebarFooter className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={onClose} className="py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm">Cancelar</button>
          <button type="submit" form="movForm" disabled={loading}
            className="py-3 px-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:scale-[1.02] transition-all disabled:opacity-50">
            {loading ? <span className="flex items-center gap-2"><i className="fa-solid fa-spinner fa-spin"></i> Registrando...</span> : "Registrar"}
          </button>
        </div>
      </SlidebarFooter>
    </SlidebarPanel>
  );
}
