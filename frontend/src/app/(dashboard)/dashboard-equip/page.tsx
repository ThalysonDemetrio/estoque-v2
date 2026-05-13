"use client";

import { useState, useEffect, useMemo } from "react";
import { EquipamentosService } from "@/services/equipamentos.service";
import { ColaboradoresService } from "@/services/colaboradores.service";

const norm = (s: string) => (s || "").toLowerCase();

type Propriedade = "todos" | "empresa" | "usuario";

export default function DashboardEquipamentosPage() {
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [propriedade, setPropriedade] = useState<Propriedade>("todos");
  const [filterSetor, setFilterSetor] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [eqs, cols] = await Promise.all([
          EquipamentosService.getEquipamentos(),
          ColaboradoresService.getColaboradores(),
        ]);
        setEquipamentos(Array.isArray(eqs) ? eqs : []);
        setColaboradores(Array.isArray(cols) ? cols : []);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    return equipamentos.filter((e) => {
      const matchProp = propriedade === "todos" || norm(e.propriedade).includes(norm(propriedade === "empresa" ? "empresa" : "usuario"));
      const matchSetor = !filterSetor || (e.localizacao || "").toLowerCase().includes(filterSetor.toLowerCase());
      return matchProp && matchSetor;
    });
  }, [equipamentos, propriedade, filterSetor]);

  // By tipo
  const byTipo: Record<string, { total: number; emUso: number; disp: number; manut: number }> = {};
  filtered.forEach((e) => {
    const t = e.tipoEquipamento || "Outros";
    if (!byTipo[t]) byTipo[t] = { total: 0, emUso: 0, disp: 0, manut: 0 };
    byTipo[t].total++;
    if (norm(e.status).includes("uso")) byTipo[t].emUso++;
    else if (norm(e.status).includes("disp")) byTipo[t].disp++;
    else if (norm(e.status).includes("manut")) byTipo[t].manut++;
  });
  const tipoRows = Object.entries(byTipo).sort((a, b) => b[1].total - a[1].total);

  // By setor (localizacao)
  const bySetor: Record<string, number> = {};
  filtered.forEach((e) => {
    const s = e.localizacao || "Sem Setor";
    bySetor[s] = (bySetor[s] || 0) + 1;
  });
  const setorRows = Object.entries(bySetor).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxSetor = Math.max(...setorRows.map((s) => s[1]), 1);
  const setores = [...new Set(equipamentos.map((e) => e.localizacao).filter(Boolean))].sort();

  // Colaborador distribution
  const colMap: Record<string, string> = {};
  colaboradores.forEach((c) => { colMap[c.colaboradorID] = `${c.nome} (${c.departamento || ""})`; });
  const byColab: Record<string, number> = {};
  filtered.forEach((e) => {
    if (e.colaboradorAtualID) {
      const name = colMap[e.colaboradorAtualID] || e.colaboradorAtualID;
      byColab[name] = (byColab[name] || 0) + 1;
    }
  });
  const topColabs = Object.entries(byColab).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const total = filtered.length;
  const emUso = filtered.filter(e => norm(e.status).includes("uso")).length;
  const disponiveis = filtered.filter(e => norm(e.status).includes("disp")).length;
  const manutencao = filtered.filter(e => norm(e.status).includes("manut")).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
        <i className="fa-solid fa-spinner fa-spin text-3xl text-purple-500"></i>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-wrap gap-3 items-center justify-between dark:bg-slate-900 dark:border-slate-700">
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1 dark:bg-slate-800">
          {(["todos", "empresa", "usuario"] as Propriedade[]).map((p) => (
            <button key={p} onClick={() => setPropriedade(p)}
              className={`py-1.5 px-4 rounded-lg text-sm font-semibold capitalize transition-all ${propriedade === p ? "bg-white shadow text-purple-600 dark:bg-slate-700 dark:text-indigo-300" : "text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"}`}>
              {p === "todos" ? "Todos" : p === "empresa" ? "Empresa" : "Pessoal"}
            </button>
          ))}
        </div>

        <select value={filterSetor} onChange={e => setFilterSetor(e.target.value)}
          title="Filtrar por setor"
          aria-label="Filtrar por setor"
          className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl py-2 px-3 outline-none focus:ring-2 focus:ring-purple-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:[color-scheme:dark]">
          <option value="">Todos os Setores</option>
          {setores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: total, icon: "fa-laptop", color: "text-slate-800", bg: "bg-slate-50", border: "border-slate-200" },
          { label: "Em Uso", value: emUso, icon: "fa-user", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-100" },
          { label: "Disponíveis", value: disponiveis, icon: "fa-circle-check", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100" },
          { label: "Manutenção", value: manutencao, icon: "fa-wrench", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-100" },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} border ${k.border} shadow-sm rounded-xl p-5 flex items-center gap-4 dark:bg-slate-900 dark:border-slate-700`}>
            <div className={`w-12 h-12 ${k.bg} rounded-xl flex items-center justify-center dark:bg-slate-800`}>
              <i className={`fa-solid ${k.icon} ${k.color} text-xl`}></i>
            </div>
            <div>
              <p className={`text-3xl font-extrabold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-300">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Por Tipo */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 dark:bg-slate-900 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2 dark:text-slate-100">
            <i className="fa-solid fa-layer-group text-purple-500"></i> Estatísticas por Tipo
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs dark:border-slate-700 dark:text-slate-300">
                  <th className="pb-2 font-semibold text-left">Tipo</th>
                  <th className="pb-2 font-semibold text-right">Total</th>
                  <th className="pb-2 font-semibold text-right">Em Uso</th>
                  <th className="pb-2 font-semibold text-right">Disp.</th>
                  <th className="pb-2 font-semibold text-right">Manut.</th>
                </tr>
              </thead>
              <tbody>
                {tipoRows.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-300">Sem dados</td></tr>
                ) : tipoRows.map(([tipo, s]) => (
                  <tr key={tipo} className="border-b border-slate-50 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 font-medium text-slate-700 dark:text-slate-200">{tipo}</td>
                    <td className="py-2.5 text-right font-bold text-slate-800">{s.total}</td>
                    <td className="py-2.5 text-right text-blue-600 font-semibold">{s.emUso}</td>
                    <td className="py-2.5 text-right text-emerald-600 font-semibold">{s.disp}</td>
                    <td className="py-2.5 text-right text-amber-600 font-semibold">{s.manut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Por Setor */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 dark:bg-slate-900 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2 dark:text-slate-100">
            <i className="fa-solid fa-building text-indigo-500"></i> Distribuição por Localização
          </h3>
          {setorRows.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm dark:text-slate-300">Sem dados de localização</div>
          ) : (
            <div className="space-y-3">
              {setorRows.map(([setor, count]) => (
                <div key={setor}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-slate-700 font-medium truncate dark:text-slate-200">{setor}</span>
                    <span className="text-sm font-bold text-indigo-700">{count}</span>
                  </div>
                  <progress
                    className="h-2 w-full rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-indigo-400 [&::-moz-progress-bar]:bg-indigo-400 dark:[&::-webkit-progress-bar]:bg-slate-700"
                    value={count}
                    max={maxSetor}
                    aria-label={`Barra de proporcao do setor ${setor}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Colaboradores */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 dark:bg-slate-900 dark:border-slate-700">
        <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2 dark:text-slate-100">
          <i className="fa-solid fa-user-tie text-emerald-500"></i> Colaboradores com Mais Equipamentos
        </h3>
        {topColabs.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm dark:text-slate-300">Nenhum equipamento alocado no momento</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {topColabs.map(([name, count], idx) => (
              <div key={name} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm ${idx === 0 ? "bg-amber-400" : idx === 1 ? "bg-slate-400" : "bg-blue-400"}`}>
                  {idx + 1}
                </div>
                <p className="text-sm font-semibold text-slate-800 truncate dark:text-slate-100" title={name}>{name.split("(")[0].trim()}</p>
                <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-300">{count} equip.</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
