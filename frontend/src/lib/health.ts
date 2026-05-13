import { Equipamento } from "@/types";
import { Vistoria } from "@/services/equipamentos.service";

/**
 * Calcula o score de saúde de um equipamento baseado em múltiplos fatores.
 * Sincronizado com a lógica da página de Diagnósticos.
 */
export function calculateAssetHealth(
  equipamento: Equipamento,
  latestVistoria?: Vistoria
): { 
  healthScore: number; 
  riskScore: number; 
  reasons: string[]; 
  impacts: Array<{ label: string; value: number; type: 'positive' | 'negative' | 'neutral' }>
} {
  let riskScore = 0;
  const reasons: string[] = [];
  const impacts: Array<{ label: string; value: number; type: 'positive' | 'negative' | 'neutral' }> = [];
  const now = new Date();

  // 1. Life Expectancy by Category
  const lifeExpectancyMap: Record<string, number> = {
    switch: 120, router: 120, server: 84, workstation: 84, laptop: 48, notebook: 48, monitor: 96, default: 60
  };

  const tipo = (equipamento.tipoEquipamento || "").toLowerCase();
  const expectancy = Object.entries(lifeExpectancyMap).find(([key]) => tipo.includes(key))?.[1] || lifeExpectancyMap.default;

  // 2. Age Factor Logic
  if (equipamento.dataCompra) {
    const ageInMonths = (now.getTime() - new Date(equipamento.dataCompra).getTime()) / (1000 * 60 * 60 * 24 * 30);
    let agePenalty = Math.min(60, (ageInMonths / expectancy) * 60);

    const loc = (equipamento.localizacao || "").toLowerCase();
    const sector = (equipamento.setor || "").toLowerCase();
    const isControlled = loc.includes("cpd") || loc.includes("rack") || loc.includes("data center") || sector.includes("ti");
    
    if (isControlled) {
      const mitigation = agePenalty * 0.3;
      agePenalty *= 0.7;
      impacts.push({ label: "Ambiente Controlado (Mitigação)", value: Math.round(mitigation), type: 'positive' });
    }

    riskScore += agePenalty;
    impacts.push({ label: "Desgaste por Idade/Uso", value: -Math.round(agePenalty), type: 'negative' });

    if (ageInMonths > expectancy) reasons.push(`Vida útil estimada excedida (${Math.round(expectancy/12)} anos)`);
    else if (ageInMonths > expectancy * 0.8) reasons.push("Fim do ciclo de vida planejado");
  } else {
    riskScore += 10;
    impacts.push({ label: "Ausência de Histórico de Compra", value: -10, type: 'negative' });
    reasons.push("Sem histórico de aquisição (impacto reduzido)");
  }

  // 3. Status & Criticality
  const status = (equipamento.status || "").toLowerCase();
  if (status.includes("manut")) {
    riskScore += 30;
    impacts.push({ label: "Estado em Manutenção", value: -30, type: 'negative' });
  }
  
  if (tipo.includes("servidor") || tipo.includes("switch")) {
    riskScore += 5;
    impacts.push({ label: "Criticidade de Infraestrutura", value: -5, type: 'negative' });
  }

  // 4. Maintenance History
  const historyCount = equipamento.manutencoes?.length || 0;
  const historyPenalty = historyCount * 5;
  riskScore += historyPenalty;
  if (historyCount > 0) {
    impacts.push({ label: `${historyCount} Intervenções Técnicas`, value: -historyPenalty, type: 'negative' });
    reasons.push(`${historyCount} intervenções técnicas no histórico`);
  }

  // 5. Final Calculation Baseline
  let finalHealthScore = Math.max(0, 100 - riskScore);

  // 6. Inspection Override (Weight 80%)
  const effectiveVistoria = latestVistoria || (
    equipamento.saude !== undefined && equipamento.saude !== null
      ? { scoreCalculado: equipamento.saude, dataVistoria: equipamento.dataVistoria || new Date().toISOString() } as Vistoria
      : undefined
  );

  if (effectiveVistoria) {
    const vistoriaContribution = effectiveVistoria.scoreCalculado * 0.8;
    const logicContribution = finalHealthScore * 0.2;
    
    finalHealthScore = Math.round(vistoriaContribution + logicContribution);
    riskScore = 100 - finalHealthScore;

    impacts.push({ 
      label: `Auditória Real (${new Date(effectiveVistoria.dataVistoria).toLocaleDateString()})`, 
      value: Math.round(effectiveVistoria.scoreCalculado), 
      type: effectiveVistoria.scoreCalculado > 70 ? 'positive' : effectiveVistoria.scoreCalculado > 40 ? 'neutral' : 'negative' 
    });

    if (latestVistoria) {
      reasons.unshift(`Última vistoria: ${new Date(latestVistoria.dataVistoria).toLocaleDateString()}`);
    }
  }

  return {
    healthScore: isNaN(finalHealthScore) ? 100 : Math.round(finalHealthScore),
    riskScore: Math.round(isNaN(riskScore) ? 0 : riskScore),
    reasons,
    impacts
  };
}

/**
 * Calcula o Score de Integridade Global para um conjunto de equipamentos.
 */
export function calculateGlobalHealthScore(
  equipamentos: Equipamento[],
  vistoriasMap: Record<string, Vistoria[]> = {}
): number {
  if (equipamentos.length === 0) return 100;

  const totalScore = equipamentos.reduce((acc, eq) => {
    const vistorias = vistoriasMap[eq.etiquetaID] || [];
    const latestVistoria = vistorias[0];

    const health = calculateAssetHealth(eq, latestVistoria);
    return acc + health.healthScore;
  }, 0);

  return Math.round(totalScore / equipamentos.length);
}
