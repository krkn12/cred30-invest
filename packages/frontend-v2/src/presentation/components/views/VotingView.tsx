import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Info, Trophy, BarChart3, Clock, AlertTriangle, FileText, Download, Users, ShieldCheck } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';
import jsPDF from 'jspdf';
import { AppState } from '../../../domain/types/common.types';

interface VotingViewProps {
    appState: AppState;
    onBack: () => void;
    onRefresh: () => Promise<void>;
    onSuccess: (title: string, msg: string) => void;
    onError: (title: string, msg: string) => void;
}

export const VotingView: React.FC<VotingViewProps> = ({ appState, onBack, onRefresh, onSuccess, onError }) => {
    const [proposals, setProposals] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [votingInProgress, setVotingInProgress] = useState<number | null>(null);

    const user = appState.currentUser!;
    const userQuotasCount = appState.quotas.filter(q => q.userId === user.id && q.status === 'ACTIVE').length;
    const totalCommunityMembers = appState.users.length;

    const fetchProposals = async () => {
        try {
            const res = await apiService.get('/voting/proposals');
            if (res.success) {
                setProposals(res.data as any[]);
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProposals();
        // Polling para atualização em tempo real (a cada 10s)
        const interval = setInterval(fetchProposals, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleVote = async (proposalId: number, vote: 'YES' | 'NO') => {
        if (userQuotasCount < 5) {
            onError("Acesso Negado", "Você precisa de pelo menos 5 licenças ativas para votar.");
            return;
        }
        if (user.score < 500) {
            onError("Score Insuficiente", "Seu score precisa ser de pelo menos 500 para participar das decisões.");
            return;
        }

        setVotingInProgress(proposalId);
        try {
            const res = await apiService.post('/voting/vote', { proposalId, vote });
            if (res.success) {
                onSuccess("Voto Registrado", res.message);
                fetchProposals();
                onRefresh(); // Sincroniza o score no app todo
                generateReceipt(proposalId, vote);
            } else {
                onError("Erro", res.message);
            }
        } catch (e: any) {
            onError("Erro", e.message);
        } finally {
            setVotingInProgress(null);
        }
    };

    const generateReceipt = (proposalId: number, vote: 'YES' | 'NO') => {
        const proposal = proposals.find(p => p.id === proposalId);
        const doc = new jsPDF();

        doc.setFillColor(5, 5, 5);
        doc.rect(0, 0, 210, 297, 'F');

        doc.setTextColor(34, 211, 238);
        doc.setFontSize(22);
        doc.text("CRED30 - COMPROVANTE DE VOTAÇÃO", 20, 30);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(`Protocolo: VOTE-${proposalId}-${Date.now()}`, 20, 45);
        doc.text(`Data: ${new Date().toLocaleString('pt-BR')}`, 20, 52);

        doc.setDrawColor(34, 211, 238);
        doc.line(20, 60, 190, 60);

        doc.setFontSize(14);
        doc.text("DETALHES DA PROPOSTA:", 20, 75);
        doc.setFontSize(12);
        doc.text(`Título: ${proposal?.title || 'N/A'}`, 20, 85);

        doc.setFontSize(14);
        doc.text("SEU VOTO:", 20, 105);
        doc.setTextColor(vote === 'YES' ? 52 : 239, vote === 'YES' ? 211 : 68, vote === 'YES' ? 153 : 68);
        doc.setFontSize(16);
        doc.text(vote === 'YES' ? "SIM (APROVO)" : "NÃO (REJEITO)", 20, 115);

        doc.setTextColor(150, 150, 150);
        doc.setFontSize(10);
        const footerText = "Este documento serve como prova de participação na governança Cred30. A recompensa de 10 pontos de score foi adicionada à sua conta.";
        doc.text(footerText, 20, 140, { maxWidth: 170 });

        doc.save(`voto-cred30-prop-${proposalId}.pdf`);
    };

    const generateResultReport = (proposal: any) => {
        const doc = new jsPDF();

        doc.setFillColor(5, 5, 5);
        doc.rect(0, 0, 210, 297, 'F');

        doc.setTextColor(34, 211, 238);
        doc.setFontSize(22);
        doc.text("RELATÓRIO DE RESULTADO - CRED30", 20, 30);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(`Proposta #${proposal.id}`, 20, 45);
        doc.text(`Título: ${proposal.title}`, 20, 52);
        doc.text(`Status: ${proposal.status === 'ACTIVE' ? 'EM ANDAMENTO' : 'ENCERRADA'}`, 20, 59);

        doc.setDrawColor(34, 211, 238);
        doc.line(20, 70, 190, 70);

        const total = proposal.yes_votes + proposal.no_votes;
        const yesPerc = total > 0 ? (proposal.yes_votes / total) * 100 : 0;
        const noPerc = total > 0 ? (proposal.no_votes / total) * 100 : 0;

        doc.setFontSize(14);
        doc.text("SUMÁRIO DE VOTOS:", 20, 85);

        doc.setTextColor(52, 211, 153);
        doc.text(`SIM: ${proposal.yes_votes} (${yesPerc.toFixed(1)}%)`, 30, 95);

        doc.setTextColor(239, 68, 68);
        doc.text(`NÃO: ${proposal.no_votes} (${noPerc.toFixed(1)}%)`, 30, 105);

        doc.setTextColor(255, 255, 255);
        doc.text(`Total de Votos: ${total}`, 20, 120);

        const win = yesPerc > noPerc ? "APROVADA" : noPerc > yesPerc ? "REJEITADA" : "EMPATE";
        doc.setFontSize(18);
        doc.text(`RESULTADO: ${win}`, 20, 140);

        doc.save(`resultado-cred30-prop-${proposal.id}.pdf`);
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <BarChart3 className="text-primary-400" size={32} />
                        GOVERNANÇA
                    </h1>
                    <p className="text-zinc-500 text-sm">Decisões democráticas baseadas em sua participação no clube.</p>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-initial bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400">
                            <Users size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] text-zinc-500 uppercase font-bold text-nowrap">Comunidade</p>
                            <p className="text-sm font-bold text-white">
                                {totalCommunityMembers} Membros
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 sm:flex-initial bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] text-zinc-500 uppercase font-bold text-nowrap">Poder de Voto</p>
                            <p className={`text-sm font-bold ${userQuotasCount >= 5 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {userQuotasCount} Votos
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Aviso de Requisitos */}
            {(userQuotasCount < 5 || user.score < 500) && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-4 mb-6">
                    <AlertTriangle className="text-red-400 shrink-0 mt-1" size={20} />
                    <div className="text-sm">
                        <p className="text-red-400 font-bold mb-1">Votação Bloqueada</p>
                        <p className="text-zinc-400 leading-relaxed">
                            Para participar da governança do Cred30, você precisa de no mínimo <strong>5 licenças ativas</strong> e <strong>500 pontos de score</strong>. No Cred30, seu voto tem peso proporcional ao número de licenças que você possui.
                            {userQuotasCount < 5 && <span className="block mt-1">• Faltam {5 - userQuotasCount} licenças.</span>}
                            {user.score < 500 && <span className="block mt-1">• Faltam {500 - user.score} pontos de score.</span>}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                {isLoading ? (
                    <div className="py-20 text-center text-zinc-500 animate-pulse">Carregando votações...</div>
                ) : proposals.length === 0 ? (
                    <div className="py-20 text-center bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
                        <Info className="mx-auto mb-4 text-zinc-600" size={48} />
                        <h3 className="text-white font-bold">Nenhuma Votação Aberta</h3>
                        <p className="text-zinc-500 text-sm">Fique atento às notificações para novas propostas.</p>
                    </div>
                ) : (
                    proposals.map(prop => {
                        const totalVotos = prop.yes_votes + prop.no_votes;
                        const yesPerc = totalVotos > 0 ? (prop.yes_votes / totalVotos) * 100 : 0;
                        const noPerc = totalVotos > 0 ? (prop.no_votes / totalVotos) * 100 : 0;

                        return (
                            <div key={prop.id} className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden group">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${prop.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                                {prop.status === 'ACTIVE' ? 'Em Votação' : 'Encerrada'}
                                            </span>
                                            <h3 className="text-xl font-bold text-white mt-2">{prop.title}</h3>
                                        </div>
                                        <div className="flex items-center gap-2 text-primary-400">
                                            <Trophy size={16} />
                                            <span className="text-xs font-bold">+10 SCORE</span>
                                        </div>
                                    </div>

                                    <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                                        {prop.description}
                                    </p>

                                    {/* Placar Real-Time (Visível apenas após votar ou se encerrada) */}
                                    {(prop.user_vote || prop.status === 'CLOSED') ? (
                                        <div className="bg-black/40 rounded-2xl p-4 mb-6 animate-in fade-in zoom-in duration-500">
                                            <div className="flex justify-between text-[10px] font-black uppercase text-zinc-500 mb-2">
                                                <span>Poder Sim: {prop.yes_votes}</span>
                                                <span>Poder Não: {prop.no_votes}</span>
                                            </div>
                                            <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${yesPerc}%` }}></div>
                                                <div className="h-full bg-red-500 transition-all duration-1000 shadow-[0_0_10px_rgba(239,68,68,0.3)]" style={{ width: `${noPerc}%` }}></div>
                                            </div>
                                            <p className="text-[9px] text-zinc-600 mt-2 text-center uppercase font-bold tracking-tighter">
                                                Resultado atual da comunidade
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-6 mb-6 flex flex-col items-center justify-center gap-2">
                                            <ShieldCheck size={24} className="text-zinc-700" />
                                            <p className="text-[10px] text-zinc-500 uppercase font-bold">Voto Secreto</p>
                                            <p className="text-xs text-zinc-600">O placar da comunidade será revelado após o seu voto.</p>
                                        </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row gap-3">
                                        {!prop.user_vote && prop.status === 'ACTIVE' ? (
                                            <>
                                                <button
                                                    onClick={() => handleVote(prop.id, 'YES')}
                                                    disabled={votingInProgress === prop.id || userQuotasCount < 5 || user.score < 500}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                                                >
                                                    <CheckCircle2 size={20} /> VOTAR NO SIM
                                                </button>
                                                <button
                                                    onClick={() => handleVote(prop.id, 'NO')}
                                                    disabled={votingInProgress === prop.id || userQuotasCount < 5 || user.score < 500}
                                                    className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                                                >
                                                    <XCircle size={20} /> VOTAR NO NÃO
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col sm:flex-row gap-3">
                                                <div className="flex-1 bg-zinc-800/50 border border-zinc-700 p-4 rounded-2xl flex items-center justify-center gap-3">
                                                    <div className={prop.user_vote === 'YES' ? 'text-emerald-400' : prop.user_vote === 'NO' ? 'text-red-400' : 'text-zinc-500'}>
                                                        {prop.user_vote === 'YES' ? <CheckCircle2 size={20} /> : prop.user_vote === 'NO' ? <XCircle size={20} /> : null}
                                                    </div>
                                                    <span className="text-zinc-400 text-sm font-bold">
                                                        {prop.user_vote ? `Você votou com ${userQuotasCount} votos` : 'Votação Encerrada'}
                                                    </span>
                                                </div>
                                                {prop.user_vote && (
                                                    <button
                                                        onClick={() => generateReceipt(prop.id, prop.user_vote)}
                                                        className="px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl border border-zinc-700 transition flex items-center justify-center gap-2"
                                                    >
                                                        <FileText size={18} /> PDF VOTO
                                                    </button>
                                                )}
                                                {user.isAdmin && (
                                                    <button
                                                        onClick={() => generateResultReport(prop)}
                                                        className="px-6 py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-primary-900/20"
                                                    >
                                                        <Download size={18} /> RELATÓRIO ADM
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
