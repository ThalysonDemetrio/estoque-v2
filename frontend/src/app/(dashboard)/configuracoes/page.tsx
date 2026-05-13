"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";
import { NeumorphicContainer } from "@/components/dashboard/NeumorphicCharts";

const AVATARES_PREDEFINIDOS = [
  "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Felix&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Starlight&backgroundColor=c0aede",
  "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Cosmos&backgroundColor=d1d4f9",
  "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Nova&backgroundColor=ffd5dc",
  "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Orbit&backgroundColor=ffdfbf",
  "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Nebula&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Quasar&backgroundColor=c0aede",
  "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Pulsar&backgroundColor=d1d4f9",
];

const TABS_DISPONIVEIS = [
  { key: "dashboard",            label: "Dashboard" },
  { key: "equipamentos",         label: "Equipamentos" },
  { key: "colaboradores",        label: "Colaboradores" },
  { key: "movimentacoes",        label: "Movimentações" },
  { key: "solicitacoes",         label: "Solicitações" },
  { key: "rede",                 label: "Rede" },
  { key: "auditoria",            label: "Auditoria" },
  { key: "rastreabilidade",      label: "Rastreabilidade" },
  { key: "investimentos",        label: "Investimentos" },
  { key: "diagnosticos",         label: "Diagnósticos" },
  { key: "calendario",           label: "Calendário" },
  { key: "configuracoes",        label: "Configurações" },
  { key: "chat",                 label: "Chat (Suporte)" },
];

const CARGO_META: Record<string, { label: string; color: string }> = {
  admin:   { label: "Admin",   color: "bg-red-500/10 text-red-600 shadow-nm-inset border-red-500/20" },
  gestor:  { label: "Gestor",  color: "bg-blue-500/10 text-blue-600 shadow-nm-inset border-blue-500/20" },
  usuario: { label: "Usuário", color: "bg-surface-soft text-muted shadow-nm-inset border-border-subtle" },
};

const EMPTY_FORM = {
  nome: "", email: "", password: "", cargo: "usuario",
  ativo: true, permissoes: {} as Record<string, { view?: boolean; edit?: boolean }>,
};

async function adminFetch(path: string, init?: RequestInit) {
  const url = `${api.baseURL}/api/admin${path}`;
  return api.fetchWithRetry(url, init);
}

async function settingsFetch(path: string, init?: RequestInit) {
  const url = `${api.baseURL}/api/settings${path}`;
  return api.fetchWithRetry(url, init);
}

export default function ConfiguracoesPage() {
  const { user, updateProfile } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [newPin, setNewPin] = useState("");
  const [updatingPin, setUpdatingPin] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // Estados do Perfil Próprio
  const [profileName, setProfileName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.nome || "");
      setSelectedAvatar(user.avatar || "");
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const r = await adminFetch("/users");
      setUsuarios(Array.isArray(r?.data) ? r.data : []);
    } catch (_) {
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackup = async () => {
    try {
      const r = await settingsFetch("/backup-status");
      setBackupStatus(r?.data);
    } catch (_) {}
  };

  useEffect(() => { fetchUsers(); fetchBackup(); }, []);

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setErrMsg("");
    setShowForm(true);
  };

  const openEdit = (u: any) => {
    setEditingUser(u);
    const perms: Record<string, { view?: boolean; edit?: boolean }> = {};
    TABS_DISPONIVEIS.forEach(t => { 
      const existing = u.permissoes?.[t.key];
      if (typeof existing === "boolean") {
        perms[t.key] = { view: existing, edit: false };
      } else {
        perms[t.key] = { 
          view: existing?.view ?? false, 
          edit: existing?.edit ?? false 
        };
      }
    });
    setForm({ nome: u.nome || "", email: u.email, password: "", cargo: u.cargo, ativo: u.ativo !== false, permissoes: perms });
    setErrMsg("");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrMsg("");
    try {
      const payload: any = { nome: form.nome, cargo: form.cargo, ativo: form.ativo, permissoes: form.permissoes };
      if (!editingUser) { payload.email = form.email; payload.password = form.password; }
      else if (form.password) { payload.password = form.password; }

      if (editingUser) {
        await adminFetch(`/users/${editingUser.user_id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        await adminFetch("/users", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      fetchUsers();
    } catch (err: any) {
      setErrMsg(err.message || "Erro ao salvar usuário.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: any) => {
    if (!window.confirm(`Excluir usuário "${u.nome || u.email}"?`)) return;
    try {
      await adminFetch(`/users/${u.user_id}`, { method: "DELETE" });
      fetchUsers();
    } catch (err: any) { alert(err.message || "Erro ao excluir."); }
  };

  const handleToggleAtivo = async (u: any) => {
    try {
      await adminFetch(`/users/${u.user_id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      fetchUsers();
    } catch (err: any) { alert(err.message); }
  };

  const { success, error: toastError } = useToast();

  const handleUpdatePin = async () => {
    if (!newPin || !/^\d{4,8}$/.test(newPin)) {
      setErrMsg("O PIN deve ter entre 4 e 8 dígitos numéricos.");
      return;
    }
    setUpdatingPin(true);
    setErrMsg("");
    try {
      await settingsFetch("/investimentos-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin }),
      });
      success("Segurança Atualizada", "O novo PIN de investimentos foi configurado com sucesso.");
      setNewPin("");
    } catch (err: any) {
      setErrMsg(err.message || "Erro ao atualizar PIN.");
      toastError("Falha na Segurança", "Não foi possível atualizar o PIN.");
    } finally {
      setUpdatingPin(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ nome: profileName, avatar: selectedAvatar });
      success("Perfil Atualizado", "Suas alterações de identidade foram salvas.");
    } catch (err: any) {
      toastError("Erro ao Salvar", err.message || "Não foi possível atualizar o perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toastError("Arquivo muito grande", "A imagem deve ter no máximo 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-10 max-w-[1200px] mx-auto p-4">
      {/* Perfil do Operador */}
      <NeumorphicContainer title="Perfil do Operador" icon="fa-user-astronaut text-brand">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 p-2">
          {/* Avatar Preview & Selection */}
          <div className="lg:col-span-5 flex flex-col items-center gap-6">
            <div className="relative group">
              <div className="w-40 h-40 rounded-[2.5rem] bg-surface-soft border-4 border-white dark:border-white/5 shadow-nm-flat overflow-hidden flex items-center justify-center transition-transform hover:scale-105 duration-500">
                {selectedAvatar ? (
                  <img src={selectedAvatar} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-muted opacity-30">
                    <i className="fa-solid fa-user-astronaut text-5xl mb-2"></i>
                    <span className="text-[10px] font-black uppercase tracking-widest">Sem Foto</span>
                  </div>
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 w-12 h-12 bg-brand text-white rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:bg-brand-dark transition-all active:scale-95 border-4 border-surface">
                <i className="fa-solid fa-camera"></i>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </div>
            
            <div className="w-full">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-4 text-center">Galeria de Operadores</p>
              <div className="grid grid-cols-4 gap-3">
                {AVATARES_PREDEFINIDOS.map((url, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setSelectedAvatar(url)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all active:scale-90 ${selectedAvatar === url ? 'border-brand shadow-nm-inset ring-4 ring-brand/10' : 'border-border-subtle hover:border-brand/40 shadow-nm-flat opacity-70 hover:opacity-100'}`}
                  >
                    <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-3 ml-1">Assinatura Visual (Nome)</label>
                <input 
                  type="text" 
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="Seu nome de exibição"
                  className="w-full px-6 py-4 bg-surface-soft border border-border-subtle rounded-3xl text-sm font-black shadow-nm-inset focus:ring-4 focus:ring-brand/10 transition-all outline-none uppercase tracking-tight"
                />
              </div>

              <div className="p-6 bg-surface-soft border border-border-subtle rounded-3xl shadow-nm-inset space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                  <span className="text-muted">E-mail de Acesso</span>
                  <span className="text-strong">{user?.email}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest border-t border-border-subtle/50 pt-2">
                  <span className="text-muted">Nível Hierárquico</span>
                  <span className="text-brand">{CARGO_META[user?.cargo || ""]?.label || user?.cargo}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSaveProfile}
              disabled={savingProfile || (profileName === user?.nome && selectedAvatar === user?.avatar)}
              className="w-full py-5 bg-brand text-white text-xs font-black uppercase tracking-[0.25em] rounded-[1.5rem] shadow-nm-flat hover:bg-brand-dark transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-30 disabled:grayscale"
            >
              {savingProfile ? (
                <i className="fa-solid fa-spinner fa-spin"></i>
              ) : (
                <>
                  <i className="fa-solid fa-id-card text-base opacity-60"></i>
                  Sincronizar Identidade
                </>
              )}
            </button>
            <p className="text-[9px] text-center font-bold text-muted uppercase tracking-widest opacity-40">
              Essas alterações afetam como você é visto no Log de Auditoria e Chat.
            </p>
          </div>
        </div>
      </NeumorphicContainer>

      {/* Gestão de Usuários */}
      <NeumorphicContainer 
        title="Gestão de Usuários" 
        icon="fa-users text-emerald-500"
        extra={
          <button onClick={openCreate}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all shadow-nm-flat flex items-center gap-2 active:scale-95">
            <i className="fa-solid fa-plus"></i> Novo Usuário
          </button>
        }
      >

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 gap-3 dark:text-slate-300">
            <i className="fa-solid fa-spinner fa-spin text-emerald-500"></i> Carregando usuários...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-surface-soft/50 text-muted uppercase tracking-[0.2em] text-[9px] font-black border-b border-border-subtle">
                  <th className="py-4 px-6">Nome / E-mail</th>
                  <th className="py-4 px-6">Cargo</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Abas</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-300">Nenhum usuário encontrado.</td></tr>
                ) : usuarios.map((u: any) => {
                  const cm = CARGO_META[u.cargo] || { label: u.cargo, color: "bg-slate-100 text-slate-600" };
                  const permsCount = Object.values(u.permissoes || {}).filter(Boolean).length;
                  return (
                    <tr key={u.user_id} className="border-b border-border-subtle/30 hover:bg-surface-soft/30 transition-all group">
                      <td className="py-4 px-6">
                        <p className="font-black text-strong uppercase tracking-tight">{u.nome || "—"}</p>
                        <p className="text-[10px] text-muted font-bold">{u.email}</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-[9px] px-3 py-1.5 rounded-xl font-black uppercase tracking-widest ${cm.color} border flex items-center justify-center w-fit min-w-[80px]`}>{cm.label}</span>
                      </td>
                      <td className="py-4 px-6">
                        <button onClick={() => handleToggleAtivo(u)} title="Clique para alternar">
                          <span className={`text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest border border-current/10 ${u.ativo !== false ? "bg-emerald-500/10 text-emerald-600 font-black" : "bg-red-500/10 text-red-600 font-black"}`}>
                            {u.ativo !== false ? "Ativo" : "Inativo"}
                          </span>
                        </button>
                      </td>
                      <td className="py-4 px-6 text-[10px] font-bold text-main">
                        {u.cargo === "admin"
                          ? <span className="text-brand font-black uppercase tracking-widest">Master</span>
                          : permsCount > 0 ? `${permsCount} Módulos` : <span className="text-muted italic opacity-50 uppercase tracking-tighter">Restrito</span>
                        }
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex gap-2 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(u)} className="w-8 h-8 rounded-lg bg-surface border border-border-subtle text-brand hover:shadow-nm-flat transition-all flex items-center justify-center active:scale-95">
                            <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                          </button>
                          <button onClick={() => handleDelete(u)} className="w-8 h-8 rounded-lg bg-surface border border-border-subtle text-red-500 hover:shadow-nm-flat transition-all flex items-center justify-center active:scale-95">
                            <i className="fa-solid fa-trash text-[10px]"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </NeumorphicContainer>

      {/* Sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <NeumorphicContainer title="Informações do Sistema" icon="fa-circle-info text-indigo-500">
          <ul className="space-y-4 px-2">
            {[
              { k: "Versão",      v: "v2.0 Stable (NEO)" },
              { k: "Database",    v: "PostgreSQL Engine" },
              { k: "Runtime",     v: "Next.js Node Core" },
              { k: "Interface",   v: "Neumorphic v2.5" },
            ].map(({ k, v }) => (
              <li key={k} className="flex justify-between items-center py-2 border-b border-border-subtle/30 border-dashed last:border-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted">{k}</span>
                <span className="text-xs font-black text-strong">{v}</span>
              </li>
            ))}
          </ul>
        </NeumorphicContainer>

        <NeumorphicContainer title="Status do Banco" icon="fa-database text-blue-500">
          <div className="px-2">
            {backupStatus ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-surface-soft rounded-2xl shadow-nm-inset border border-border-subtle">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${backupStatus.status === "ok" ? "bg-emerald-500" : "bg-red-500"}`}></span>
                    <span className="text-xs font-black uppercase tracking-widest text-strong">{backupStatus.status === "ok" ? "Conectado" : "Falha na Conexão"}</span>
                  </div>
                  <i className="fa-solid fa-square-poll-vertical text-muted opacity-30 text-xl"></i>
                </div>
                
                <div className="space-y-3">
                   <div className="flex justify-between text-[10px] font-black uppercase text-muted tracking-widest">
                      <span>Catálogo</span>
                      <span className="text-strong">{backupStatus.database}</span>
                   </div>
                   <div className="flex justify-between text-[10px] font-black uppercase text-muted tracking-widest">
                      <span>Última Checagem</span>
                      <span className="text-strong">{new Date(backupStatus.timestamp).toLocaleTimeString("pt-BR")}</span>
                   </div>
                </div>

                <button onClick={fetchBackup} className="w-full py-3 bg-surface border border-border-subtle text-muted text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:shadow-nm-flat transition-all flex items-center justify-center gap-2 active:scale-95">
                  <i className="fa-solid fa-arrows-rotate"></i> Validar Integridade
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-3 opacity-40">
                 <i className="fa-solid fa-circle-notch fa-spin text-2xl text-brand"></i>
                 <span className="text-[9px] font-black uppercase tracking-widest">Sincronizando...</span>
              </div>
            )}
          </div>
        </NeumorphicContainer>
      </div>

      {/* Segurança */}
      <NeumorphicContainer title="Segurança do Cockpit" icon="fa-shield-halved text-amber-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 p-2">
          <div className="space-y-4">
             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-strong">PIN de Acesso (Investimentos)</h4>
             <p className="text-[10px] font-bold text-muted leading-relaxed uppercase tracking-tight">
               Esta senha protege o acesso aos dados financeiros e relatórios de investimento. O valor é armazenado com criptografia irreversível (Hash) no banco de dados.
             </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative">
              <input 
                 type="password" 
                 maxLength={8}
                 value={newPin}
                 onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))}
                 placeholder="Definir novo PIN (4-8 dígitos)"
                 className="w-full px-5 py-4 bg-surface border border-border-subtle rounded-2xl text-xs font-black shadow-nm-inset focus:ring-4 focus:ring-amber-500/10 transition-all outline-none tracking-[0.5em] text-center"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted opacity-20 pointer-events-none">
                <i className="fa-solid fa-key text-sm"></i>
              </div>
            </div>

            <button 
              onClick={handleUpdatePin}
              disabled={updatingPin || newPin.length < 4}
              className="w-full py-4 bg-surface border border-border-subtle text-amber-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:shadow-nm-flat hover:bg-amber-500/5 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-30 disabled:grayscale"
            >
              {updatingPin ? (
                <i className="fa-solid fa-circle-notch animate-spin"></i>
              ) : (
                <>
                  <i className="fa-solid fa-lock-open text-[10px]"></i>
                  Atualizar Chave de Acesso
                </>
              )}
            </button>
          </div>
        </div>
      </NeumorphicContainer>

      {/* Modal Criar/Editar Usuário */}
      {showForm && (
        <SlidebarPanel isOpen={showForm} onClose={() => setShowForm(false)}>
          <SlidebarHeader
            title={editingUser ? "Editar Usuário" : "Novo Usuário"}
            iconClassName={editingUser ? "fa-user-pen text-brand" : "fa-user-plus text-emerald-500"}
            onClose={() => setShowForm(false)}
          />

            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar bg-surface">
               <form id="userForm" onSubmit={handleSubmit} className="space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-2 ml-1">Nome Completo</label>
                     <input 
                        type="text" 
                        value={form.nome} 
                        onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                        placeholder="Nome completo"
                        className="w-full px-5 py-3.5 bg-surface border border-border-subtle rounded-2xl text-xs font-black shadow-nm-inset focus:ring-4 focus:ring-brand/10 transition-all outline-none uppercase tracking-tight" 
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-2 ml-1">E-mail Corporativo *</label>
                     <input 
                        type="email" 
                        value={form.email} 
                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))} 
                        title="E-mail" 
                        placeholder="usuario@empresa.com" 
                        required 
                        disabled={!!editingUser}
                        className="w-full px-5 py-3.5 bg-surface border border-border-subtle rounded-2xl text-xs font-black shadow-nm-inset focus:ring-4 focus:ring-brand/10 transition-all outline-none disabled:opacity-50 uppercase tracking-tight" 
                     />
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-2 ml-1">{editingUser ? "Alterar Senha (opcional)" : "Senha de Acesso *"}</label>
                     <input 
                        type="password" 
                        value={form.password} 
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))} 
                        required={!editingUser}
                        placeholder="••••••••"
                        className="w-full px-5 py-3.5 bg-surface border border-border-subtle rounded-2xl text-xs font-black shadow-nm-inset focus:ring-4 focus:ring-brand/10 transition-all outline-none uppercase tracking-tight" 
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-2 ml-1">Nível de Acesso *</label>
                     <select 
                        value={form.cargo} 
                        onChange={e => setForm(p => ({ ...p, cargo: e.target.value }))} 
                        title="Cargo" 
                        aria-label="Cargo" 
                        required
                        className="w-full px-5 py-3.5 bg-surface border border-border-subtle rounded-2xl text-xs font-black shadow-nm-inset focus:ring-4 focus:ring-brand/10 transition-all outline-none uppercase tracking-tight dark:[color-scheme:dark]"
                     >
                       <option value="usuario">Colaborador / Padrão</option>
                       <option value="gestor">Gestor de Inventário</option>
                       <option value="admin">Administrador Master</option>
                     </select>
                   </div>
                 </div>

                 <div className="p-6 bg-surface-soft border border-border-subtle rounded-2xl shadow-nm-inset">
                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div className="relative">
                        <input 
                           type="checkbox" 
                           checked={form.ativo} 
                           onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} 
                           className="sr-only peer" 
                        />
                        <div className="w-14 h-7 bg-surface shadow-nm-inset rounded-full transition-all peer-checked:bg-emerald-500/20"></div>
                        <div className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-nm-flat transition-all peer-checked:translate-x-7 peer-checked:bg-emerald-500"></div>
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[10px] font-black uppercase tracking-widest text-strong">Status da Conta</span>
                         <span className="text-[9px] font-bold text-muted uppercase tracking-tighter">Habilitar acesso do colaborador ao sistema</span>
                      </div>
                    </label>
                 </div>

                 {form.cargo !== "admin" && (
                   <div className="space-y-6">
                      <p className="block text-[10px] font-black uppercase tracking-widest text-muted mb-2 ml-1">Módulos do Sistema (Acesso)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                       {TABS_DISPONIVEIS.map((tab) => {
                         const p = form.permissoes[tab.key] || { view: false, edit: false };
                         return (
                           <div key={tab.key} className={`p-5 rounded-3xl transition-all border border-border-subtle ${p.view ? 'bg-surface-soft shadow-nm-inset' : 'bg-surface shadow-nm-flat opacity-70'}`}>
                             <div className="flex items-center gap-3 mb-5">
                               <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border border-border-subtle/30 ${p.view ? 'bg-brand/10 text-brand shadow-nm-inset' : 'bg-surface-soft text-muted shadow-nm-flat'}`}>
                                 <i className="fa-solid fa-folder text-[11px]"></i>
                               </div>
                               <span className="text-[10px] font-black uppercase tracking-tight text-strong">{tab.label}</span>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-2">
                               <button
                                 type="button"
                                 onClick={() => setForm(prev => ({ 
                                   ...prev, 
                                   permissoes: { 
                                     ...prev.permissoes, 
                                     [tab.key]: { ...p, view: !p.view } 
                                   } 
                                 }))}
                                 className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all flex items-center justify-center gap-1.5 ${p.view ? 'bg-emerald-500/10 text-emerald-600 shadow-nm-inset' : 'bg-surface border border-border-subtle text-muted hover:shadow-nm-flat active:scale-95'}`}
                               >
                                 <i className={`fa-solid ${p.view ? 'fa-eye' : 'fa-eye-slash'} opacity-60`}></i>
                                 Ver
                               </button>
                               <button
                                 type="button"
                                 onClick={() => setForm(prev => ({ 
                                   ...prev, 
                                   permissoes: { 
                                     ...prev.permissoes, 
                                     [tab.key]: { ...p, edit: !p.edit } 
                                   } 
                                 }))}
                                 className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all flex items-center justify-center gap-1.5 ${p.edit ? 'bg-amber-500/10 text-amber-600 shadow-nm-inset' : 'bg-surface border border-border-subtle text-muted hover:shadow-nm-flat active:scale-95'}`}
                               >
                                 <i className={`fa-solid ${p.edit ? 'fa-pen-to-square' : 'fa-lock'} opacity-60`}></i>
                                 Edit
                               </button>
                             </div>
                           </div>
                         );
                       })}
                      </div>
                   </div>
                 )}

                {errMsg && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-600 text-[10px] font-black uppercase tracking-widest px-5 py-4 rounded-2xl animate-pulse">
                    <i className="fa-solid fa-triangle-exclamation mr-2"></i>{errMsg}
                  </div>
                )}
               </form>
            </div>

            <SlidebarFooter className="p-8 border-t border-border-subtle/30 bg-surface/50">
              <div className="grid grid-cols-2 gap-6 pb-2">
                <button onClick={() => setShowForm(false)} className="py-4 px-6 bg-surface border border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:shadow-nm-flat transition-all active:scale-95">
                  Cancelar
                </button>
                <button type="submit" form="userForm" disabled={saving}
                  className="py-4 px-6 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-nm-flat hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-95">
                  {saving ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Processando...</> : "Confirmar Acesso"}
                </button>
              </div>
            </SlidebarFooter>
        </SlidebarPanel>
      )}
    </div>
  );
}
