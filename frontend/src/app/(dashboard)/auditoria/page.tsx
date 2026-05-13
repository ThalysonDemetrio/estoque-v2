"use client";

import { useState, useEffect } from "react";
import { AuditService, AuditLog } from "@/services/audit.service";
import { useTranslation } from "react-i18next";

function fmt(dt?: string) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  criada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  atualizada: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  delete: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  process: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  processada_substituicao: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  confirm: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  concluida: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  movimentacao: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  alocacao: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  devolucao: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
};

export default function AuditoriaPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ entidade: "", acao: "" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await AuditService.getLogs(filter);
        setLogs(data);
      } catch (error) {
        console.error("Erro ao carregar logs", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Logs de Auditoria</h1>
          <p className="text-slate-500 text-sm">Rastreabilidade completa de todas as ações no sistema</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={filter.entidade}
            onChange={e => setFilter(prev => ({ ...prev, entidade: e.target.value }))}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todas as Entidades</option>
            <option value="equipamento">Equipamento</option>
            <option value="movimentacao">Movimentação</option>
            <option value="solicitacao">Solicitação</option>
            <option value="colaborador">Colaborador</option>
          </select>
          <select 
            value={filter.acao}
            onChange={e => setFilter(prev => ({ ...prev, acao: e.target.value }))}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todas as Ações</option>
            <option value="create">Criação</option>
            <option value="update">Atualização</option>
            <option value="delete">Exclusão</option>
            <option value="process">Processamento</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <th className="px-6 py-4">Data/Hora</th>
              <th className="px-6 py-4">Entidade</th>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Ação</th>
              <th className="px-6 py-4">Usuário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  <i className="fa-solid fa-spinner fa-spin mr-2"></i> Carregando registros...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.audit_id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                    {fmt(log.created_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200 capitalize">
                    {log.entidade}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-500 font-mono">
                    {log.entidade_id}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${ACTION_COLORS[log.acao] || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
                      {log.acao}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                        {log.user_nome?.charAt(0) || "U"}
                      </div>
                      {log.user_nome || "Sistema"}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
