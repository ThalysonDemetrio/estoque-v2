"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Equipamento, Colaborador } from '@/types';
import { SmartAvatar } from '@/components/ui/SmartAvatar';

interface AssetListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  assets: Equipamento[];
  colaboradores: Colaborador[];
  onAssetClick: (asset: Equipamento) => void;
  onColaboradorClick: (colab: Colaborador) => void;
}

export function AssetListModal({ isOpen, onClose, title, assets, colaboradores, onAssetClick, onColaboradorClick }: AssetListModalProps) {
  if (!isOpen) return null;

  const getColaborador = (id?: string) => {
    if (!id) return null;
    return colaboradores.find(c => c.colaboradorID === id);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
           initial={{ opacity: 0, scale: 0.95, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95, y: 20 }}
           className="bg-surface w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-border-subtle overflow-hidden"
         >
           {/* Header */}
           <div className="p-8 border-b border-border-subtle flex items-center justify-between bg-surface-soft/50">
             <div>
               <h2 className="text-xl font-black text-strong flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand shadow-nm-inset">
                   <i className="fa-solid fa-list-ul"></i>
                 </div>
                 {title}
               </h2>
               <p className="text-[10px] font-black text-muted mt-2 uppercase tracking-widest leading-none">Exibindo {assets.length} ativos encontrados</p>
             </div>
             <button 
               onClick={onClose}
               className="w-12 h-12 rounded-2xl bg-surface-soft hover:bg-surface shadow-nm-inset hover:shadow-nm-flat flex items-center justify-center text-muted hover:text-brand transition-all"
             >
               <i className="fa-solid fa-xmark"></i>
             </button>
           </div>
 
           <div className="p-8 max-h-[60vh] overflow-y-auto no-scrollbar">
             <div className="grid grid-cols-1 gap-4">
               {assets.map((asset) => {
                 const colab = getColaborador(asset.colaboradorAtualID);
                 
                 return (
                   <div 
                     key={asset.etiquetaID}
                     className="w-full text-left group flex items-center gap-5 p-5 rounded-3xl border border-border-subtle bg-surface shadow-nm-flat hover-nm-elevated transition-all"
                   >
                     <button 
                       onClick={() => onAssetClick(asset)}
                       className="w-16 h-16 shrink-0 rounded-2xl bg-surface-soft flex items-center justify-center overflow-hidden border border-border-subtle shadow-nm-inset group-hover:scale-105 transition-transform"
                     >
                       <SmartAvatar 
                         src={asset.fotoEquipamento} 
                         name={`${asset.marca} ${asset.modelo}`}
                         size="full"
                         type="item"
                       />
                     </button>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-3 mb-1.5 leading-none">
                         <span className="text-[10px] font-black text-brand uppercase tracking-widest opacity-60">
                           #{asset.etiquetaID}
                         </span>
                         <span className={`text-[8px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest ${
                           asset.status?.toLowerCase().includes("uso") ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"
                         }`}>
                           {asset.status}
                         </span>
                       </div>
                       <button 
                         onClick={() => onAssetClick(asset)}
                         className="text-sm font-black text-strong truncate capitalize hover:text-brand block text-left transition-colors"
                       >
                         {asset.marca} {asset.modelo}
                       </button>
                       
                       <div className="flex items-center gap-3 mt-3">
                         {colab ? (
                           <button 
                             onClick={(e) => { e.stopPropagation(); onColaboradorClick(colab); }}
                             className="flex items-center gap-2 bg-surface-soft px-2.5 py-1 rounded-xl border border-border-subtle hover:border-brand/30 hover:bg-surface transition-all group/colab shadow-sm"
                           >
                             <SmartAvatar src={colab.fotoColaborador} name={colab.nome} size="xs" />
                             <span className="text-[10px] font-black text-muted uppercase tracking-tighter truncate max-w-[120px] group-hover/colab:text-brand">
                               {colab.nome}
                             </span>
                           </button>
                         ) : (
                           <span className="text-[10px] font-black text-muted opacity-40 uppercase tracking-widest">
                             Estoque / {asset.localizacao || 'Sede'}
                           </span>
                         )}
                         <span className="text-border-subtle">•</span>
                         <span className="text-[10px] font-black text-muted opacity-40 uppercase tracking-widest">
                           {asset.propriedade === 'empresa' ? 'Patrimônio' : 'Usuário'}
                         </span>
                       </div>
                     </div>
                     <button 
                       onClick={() => onAssetClick(asset)}
                       className="w-10 h-10 rounded-xl bg-surface-soft flex items-center justify-center text-muted group-hover:text-brand shadow-nm-inset opacity-0 group-hover:opacity-100 transition-all"
                     >
                       <i className="fa-solid fa-chevron-right text-xs"></i>
                     </button>
                   </div>
                 );
               })}
             </div>
           </div>
 
           {/* Footer */}
           <div className="p-6 bg-surface-soft/30 border-t border-border-subtle flex justify-end">
             <button 
               onClick={onClose}
               className="px-8 py-4 bg-strong text-surface text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-strong/20"
             >
               Fechar Visualização
             </button>
           </div>
         </motion.div>
      </div>
    </AnimatePresence>
  );
}
