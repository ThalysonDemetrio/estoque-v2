import { useState, useEffect, useRef } from "react";
import { ColaboradoresService } from "@/services/colaboradores.service";
import { useToast } from "@/contexts/ToastContext";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { useChat } from "@/contexts/ChatContext";

interface ColaboradorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  colaboradorData?: any;
}

export function ColaboradorModal({ isOpen, onClose, onSuccess, colaboradorData }: ColaboradorModalProps) {
  const [loading, setLoading] = useState(false);
  const EMPTY_FORM = {
    nome: "", email: "", departamento: "", cargo: "",
    fotoColaborador: "", ativo: true,
  };
  const [formData, setFormData] = useState<any>({
    colaboradorID: "",
    ...EMPTY_FORM
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!colaboradorData;
  const toast = useToast();
  const { triggerRefresh } = useChat();

  useEffect(() => {
    if (isOpen) {
      setFormData(colaboradorData ? { ...EMPTY_FORM, ...colaboradorData, ativo: colaboradorData.ativo ?? true } : EMPTY_FORM);
    }
  }, [isOpen, colaboradorData]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev: any) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
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
      setFormData((prev: any) => ({ ...prev, fotoColaborador: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEditMode) {
        await ColaboradoresService.updateColaborador(colaboradorData.colaboradorID, formData);
        toast.success("Colaborador atualizado!", `${formData.nome} foi salvo.`);
      } else {
        await ColaboradoresService.createColaborador(formData);
        toast.success("Colaborador criado!", `${formData.nome} cadastrado.`);
      }
      triggerRefresh(); // SpaceStock Sync
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao salvar", error.message || "Verifique os campos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlidebarPanel
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="bg-white dark:bg-slate-900 h-full w-full border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
    >
      <SlidebarHeader
        title={isEditMode ? "Editar Perfil" : "Novo Colaborador"}
        subtitle={isEditMode ? "Gestão de talentos" : "Integração ao sistema"}
        iconClassName={isEditMode ? "fa-user-pen" : "fa-user-plus"}
        onClose={onClose}
        className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between"
        titleClassName="text-xl font-black text-slate-900 dark:text-white"
        subtitleClassName="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1"
      />

      <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
        <form id="colaboradorForm" onSubmit={handleSubmit} className="space-y-8">
          {/* Avatar Selection Area */}
          <div className="flex flex-col items-center justify-center p-6 bg-surface-soft rounded-[2.5rem] border border-dashed border-border-subtle shadow-nm-inset">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <SmartAvatar 
                src={formData.fotoColaborador} 
                name={formData.nome || "Novo Colaborador"} 
                size="xl"
                className="ring-4 ring-white dark:ring-slate-900 shadow-xl"
              />
              <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                <i className="fa-solid fa-camera text-white text-xl"></i>
              </div>
            </div>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*" 
              onChange={handlePhotoUpload} 
              className="hidden" 
            />
            <div className="mt-4 text-center">
              <p className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest leading-none">Foto de Perfil</p>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 px-4 py-2 bg-surface border border-border-subtle rounded-xl text-[10px] font-black uppercase tracking-widest text-brand hover:bg-surface-soft transition-all shadow-nm-flat"
              >
                <i className="fa-solid fa-upload mr-2"></i> Selecionar Foto
              </button>
              <p className="text-[9px] text-muted font-bold mt-2 italic uppercase">Formatos: JPG, PNG (Max 2MB)</p>
            </div>
            {formData.fotoColaborador && (
               <button 
                type="button" 
                onClick={() => setFormData((p: any) => ({ ...p, fotoColaborador: "" }))}
                className="mt-3 text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-600 transition-colors flex items-center justify-center gap-1"
               >
                 <i className="fa-solid fa-trash-can text-[10px]"></i> Remover Foto
               </button>
            )}
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Matrícula / ID *</label>
                <div className="relative">
                  <i className="fa-solid fa-id-card absolute left-4 top-1/2 -translate-y-1/2 text-subtle text-xs"></i>
                  <input 
                    type="text" 
                    name="colaboradorID" 
                    value={formData.colaboradorID} 
                    onChange={handleChange} 
                    required
                    disabled={isEditMode}
                    placeholder="Ex: COLAB001"
                    className="w-full pl-12 pr-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 disabled:opacity-50" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Nome Completo *</label>
                <div className="relative">
                  <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-subtle text-xs"></i>
                  <input 
                    type="text" name="nome" value={formData.nome} onChange={handleChange} required
                    placeholder="Ex: João da Silva"
                    className="w-full pl-12 pr-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50" 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Departamento *</label>
                <div className="relative">
                  <i className="fa-solid fa-building absolute left-4 top-1/2 -translate-y-1/2 text-subtle text-xs"></i>
                  <input 
                    type="text" name="departamento" value={formData.departamento} onChange={handleChange} required
                    placeholder="Ex: Tecnologia, RH..."
                    className="w-full pl-12 pr-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Cargo *</label>
                <div className="relative">
                  <i className="fa-solid fa-briefcase absolute left-4 top-1/2 -translate-y-1/2 text-subtle text-xs"></i>
                  <input 
                    type="text" name="cargo" value={formData.cargo} onChange={handleChange} required
                    placeholder="Ex: Desenvolvedor Senior"
                    className="w-full pl-12 pr-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50" 
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-500/10 rounded-2xl">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Status da Conta</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Colaboradores inativos não podem receber equipamentos</p>
                </div>
                <div className="relative">
                  <input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleChange} className="sr-only peer" />
                  <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 peer-checked:bg-indigo-500 rounded-full transition-all duration-300"></div>
                  <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 peer-checked:translate-x-6"></div>
                </div>
              </label>
            </div>
          </div>
        </form>
      </div>

      <SlidebarFooter className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
        <div className="grid grid-cols-2 gap-4">
          <button 
            type="button" 
            onClick={onClose} 
            className="py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            form="colaboradorForm" 
            disabled={loading}
            className="py-3.5 px-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i> Salvando...
              </span>
            ) : (
              isEditMode ? "Salvar Alterações" : "Cadastrar Colaborador"
            )}
          </button>
        </div>
      </SlidebarFooter>
    </SlidebarPanel>
  );
}
