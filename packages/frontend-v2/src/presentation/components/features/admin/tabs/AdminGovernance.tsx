import React, { useState, useEffect } from 'react';
import { Vote, Send, BarChart3, Gavel } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminGovernanceProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const AdminGovernance: React.FC<AdminGovernanceProps> = ({ onSuccess, onError }) => {
    const [proposals, setProposals] = useState<any[]>([]);
    const [newPropTitle, setNewPropTitle] = useState('');
    const [newPropDesc, setNewPropDesc] = useState('');

    useEffect(() => {
        fetchProposals();
    }, []);

    const fetchProposals = async () => {
        try {
            const res = await apiService.getProposals();
            if (res.success) {
                setProposals(res.data || []);
            }
        } catch (e) {
            console.error('Erro ao buscar propostas:', e);
        }
    };

    const handleCreateProposal = async () => {
        if (!newPropTitle || !newPropDesc) return;
        try {
            const res = await apiService.createProposal(newPropTitle, newPropDesc);
            if (res.success) {
                onSuccess('Sucesso', 'Proposta criada e enviada para votação!');
                setNewPropTitle('');
                setNewPropDesc('');
                fetchProposals();
            } else {
                onError('Erro', res.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const handleCloseProposal = async (id: number) => {
        if (!window.confirm('Encerrar esta votação definitivamente?')) return;
        try {
            const res = await apiService.closeProposal(id);
            if (res.success) {
                onSuccess('Sucesso', 'Votação encerrada!');
                fetchProposals();
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-zinc-800 rounded-lg"><Vote className="text-primary-400" size={20} /></div>
                        Nova Proposta do Clube
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1 mb-2 block">Título da Proposta</label>
                            <input
                                placeholder="Ex: Aumento do teto de apoio mútuo"
                                value={newPropTitle}
                                onChange={(e) => setNewPropTitle(e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-medium"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1 mb-2 block">Descrição Detalhada</label>
                            <textarea
                                rows={4}
                                placeholder="Explique os benefícios para a comunidade..."
                                value={newPropDesc}
                                onChange={(e) => setNewPropDesc(e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-medium resize-none"
                            />
                        </div>
                        <button
                            onClick={handleCreateProposal}
                            className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2"
                        >
                            <Send size={20} /> LANÇAR PARA VOTAÇÃO
                        </button>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="p-2 bg-zinc-800 rounded-lg"><BarChart3 className="text-zinc-400" size={20} /></div>
                        Propostas em Aberto / Histórico
                    </h3>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {proposals.map((prop) => (
                            <div key={prop.id} className="bg-black/20 border border-zinc-800 p-6 rounded-2xl space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-white font-bold">{prop.title}</h4>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                            Criada em: {new Date(prop.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${prop.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                        {prop.status === 'ACTIVE' ? 'EM VOTAÇÃO' : 'ENCERRADA'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black/40 p-3 rounded-xl border border-zinc-800">
                                        <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Poder Sim</p>
                                        <p className="text-xl font-black text-emerald-400">{prop.yes_votes}</p>
                                    </div>
                                    <div className="bg-black/40 p-3 rounded-xl border border-zinc-800">
                                        <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Poder Não</p>
                                        <p className="text-xl font-black text-red-400">{prop.no_votes}</p>
                                    </div>
                                </div>

                                {prop.status === 'ACTIVE' && (
                                    <button
                                        onClick={() => handleCloseProposal(prop.id)}
                                        className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-black border border-red-500/20 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"
                                    >
                                        <Gavel size={14} /> ENCERRAR VOTAÇÃO
                                    </button>
                                )}
                            </div>
                        ))}
                        {proposals.length === 0 && (
                            <div className="text-center py-20 opacity-30">
                                <Vote size={48} className="mx-auto mb-4" />
                                <p className="text-xs font-bold uppercase tracking-widest">Nenhuma proposta registrada</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
