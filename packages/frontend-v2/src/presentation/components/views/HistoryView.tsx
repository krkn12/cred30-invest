import React, { useState, useEffect, useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, XCircle, Search, Filter, Calendar, DollarSign, TrendingUp, TrendingDown, Receipt, ChevronDown } from 'lucide-react';
import { Transaction } from '../../../domain/types/common.types';
import { AdBanner } from '../ui/AdBanner';

interface HistoryViewProps {
    transactions: Transaction[];
}

type FilterType = 'ALL' | 'IN' | 'OUT';
type StatusFilter = 'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED';

export const HistoryView = ({ transactions }: HistoryViewProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<FilterType>('ALL');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [showFilters, setShowFilters] = useState(false);

    // Classificar tipos de transação
    const isIncoming = (type: string) => ['DEPOSIT', 'DIVIDEND', 'REFERRAL_BONUS', 'LOAN_RECEIVED', 'QUOTA_SELL', 'EDUCATION_REWARD', 'GAME_WIN'].includes(type);
    const isOutgoing = (type: string) => ['WITHDRAWAL', 'LOAN_PAYMENT', 'QUOTA_PURCHASE', 'LOAN_INSTALLMENT', 'GAME_BET'].includes(type);

    // Traduzir tipos
    const translateType = (type: string) => {
        const map: Record<string, string> = {
            'DEPOSIT': 'Aporte',
            'WITHDRAWAL': 'Resgate',
            'DIVIDEND': 'Bônus de Resultado',
            'QUOTA_PURCHASE': 'Aquisição de Participação',
            'QUOTA_SELL': 'Cessão de Participação',
            'LOAN_RECEIVED': 'Apoio Mútuo Recebido',
            'LOAN_PAYMENT': 'Reposição de Apoio',
            'LOAN_INSTALLMENT': 'Reposição de Parcela',
            'REFERRAL_BONUS': 'Bônus de Indicação',
            'EDUCATION_REWARD': 'Recompensa Educacional',
            'GAME_WIN': 'Prêmio de Jogo',
            'GAME_BET': 'Aposta em Jogo',
        };
        return map[type] || type;
    };

    // Traduzir status
    const translateStatus = (status: string) => {
        const map: Record<string, string> = {
            'APPROVED': 'Aprovado',
            'PENDING': 'Pendente',
            'REJECTED': 'Rejeitado',
            'PAYMENT_PENDING': 'Aguardando Pagamento',
            'COMPLETED': 'Concluído',
        };
        return map[status] || status;
    };

    // Filtrar transações
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            // Filtro de busca
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const matchDesc = t.description?.toLowerCase().includes(search);
                const matchType = translateType(t.type).toLowerCase().includes(search);
                const matchAmount = t.amount.toString().includes(search);
                if (!matchDesc && !matchType && !matchAmount) return false;
            }

            // Filtro de tipo
            if (typeFilter === 'IN' && !isIncoming(t.type)) return false;
            if (typeFilter === 'OUT' && !isOutgoing(t.type)) return false;

            // Filtro de status
            if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

            return true;
        });
    }, [transactions, searchTerm, typeFilter, statusFilter]);

    // Calcular totais
    const totals = useMemo(() => {
        const incoming = filteredTransactions.filter(t => isIncoming(t.type)).reduce((sum, t) => sum + t.amount, 0);
        const outgoing = filteredTransactions.filter(t => isOutgoing(t.type)).reduce((sum, t) => sum + t.amount, 0);
        return { incoming, outgoing, net: incoming - outgoing };
    }, [filteredTransactions]);

    // Agrupar por data
    const groupedTransactions = useMemo(() => {
        const groups: Record<string, Transaction[]> = {};
        filteredTransactions.forEach(t => {
            const date = new Date(t.date).toLocaleDateString('pt-BR');
            if (!groups[date]) groups[date] = [];
            groups[date].push(t);
        });
        return groups;
    }, [filteredTransactions]);

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="space-y-6 pb-32">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">Extrato Completo</h1>
                    <p className="text-zinc-400 text-sm mt-1">{filteredTransactions.length} transações encontradas</p>
                </div>
            </div>

            {/* Cards de resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-surface border border-surfaceHighlight rounded-xl sm:rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={16} className="text-emerald-400" />
                        <span className="text-xs text-zinc-400">Entradas</span>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-emerald-400">{formatCurrency(totals.incoming)}</p>
                </div>
                <div className="bg-surface border border-surfaceHighlight rounded-xl sm:rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingDown size={16} className="text-red-400" />
                        <span className="text-xs text-zinc-400">Saídas</span>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-red-400">{formatCurrency(totals.outgoing)}</p>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-surface border border-surfaceHighlight rounded-xl sm:rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={16} className="text-primary-400" />
                        <span className="text-xs text-zinc-400">Saldo do Período</span>
                    </div>
                    <p className={`text-lg sm:text-xl font-bold ${totals.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(totals.net)}
                    </p>
                </div>
            </div>

            {/* Barra de busca e filtros */}
            <div className="space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar transação..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface border border-surfaceHighlight rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-primary-500 outline-none transition"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition ${showFilters ? 'bg-primary-500/10 border-primary-500/30 text-primary-400' : 'bg-surface border-surfaceHighlight text-zinc-400 hover:text-white'}`}
                    >
                        <Filter size={18} />
                        <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Filtros expandidos */}
                {showFilters && (
                    <div className="bg-surface border border-surfaceHighlight rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <label className="text-xs text-zinc-400 mb-2 block">Tipo de Transação</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: 'ALL', label: 'Todas' },
                                    { value: 'IN', label: 'Entradas' },
                                    { value: 'OUT', label: 'Saídas' },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setTypeFilter(opt.value as FilterType)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${typeFilter === opt.value ? 'bg-primary-500 text-black' : 'bg-surfaceHighlight text-zinc-400 hover:text-white'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 mb-2 block">Status</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: 'ALL', label: 'Todos' },
                                    { value: 'APPROVED', label: 'Aprovado' },
                                    { value: 'PENDING', label: 'Pendente' },
                                    { value: 'REJECTED', label: 'Rejeitado' },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setStatusFilter(opt.value as StatusFilter)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${statusFilter === opt.value ? 'bg-primary-500 text-black' : 'bg-surfaceHighlight text-zinc-400 hover:text-white'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Lista de transações agrupadas por data */}
            {Object.keys(groupedTransactions).length === 0 ? (
                <div className="text-center py-16 bg-surface/50 rounded-2xl border border-surfaceHighlight border-dashed">
                    <Receipt size={48} className="mx-auto text-zinc-600 mb-4" />
                    <p className="text-zinc-500">Nenhuma transação encontrada.</p>
                    {(searchTerm || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
                        <button
                            onClick={() => { setSearchTerm(''); setTypeFilter('ALL'); setStatusFilter('ALL'); }}
                            className="mt-4 text-primary-400 text-sm hover:underline"
                        >
                            Limpar filtros
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
                        <div key={date} className="space-y-2">
                            {/* Cabeçalho do dia */}
                            <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium px-1">
                                <Calendar size={14} />
                                <span>{date}</span>
                                <span className="text-zinc-600">•</span>
                                <span>{dayTransactions.length} transações</span>
                            </div>

                            {/* Transações do dia */}
                            <div className="bg-surface border border-surfaceHighlight rounded-xl sm:rounded-2xl divide-y divide-surfaceHighlight overflow-hidden">
                                {dayTransactions.map((t) => {
                                    const incoming = isIncoming(t.type);
                                    const statusColor = t.status === 'APPROVED' || t.status === 'COMPLETED'
                                        ? 'text-emerald-400'
                                        : t.status === 'PENDING' || t.status === 'PAYMENT_PENDING'
                                            ? 'text-yellow-400'
                                            : 'text-red-400';
                                    const StatusIcon = t.status === 'APPROVED' || t.status === 'COMPLETED'
                                        ? CheckCircle2
                                        : t.status === 'PENDING' || t.status === 'PAYMENT_PENDING'
                                            ? Clock
                                            : XCircle;

                                    return (
                                        <div key={t.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-surfaceHighlight/30 transition">
                                            {/* Ícone */}
                                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 ${incoming ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                                {incoming ? (
                                                    <ArrowDownLeft className="text-emerald-400" size={20} />
                                                ) : (
                                                    <ArrowUpRight className="text-red-400" size={20} />
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm sm:text-base font-medium text-white truncate">{translateType(t.type)}</p>
                                                <p className="text-[10px] sm:text-xs text-zinc-500 truncate">{t.description || `ID: ${t.id}`}</p>
                                            </div>

                                            {/* Valor e Status */}
                                            <div className="text-right shrink-0">
                                                <p className={`text-sm sm:text-base font-bold ${incoming ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {incoming ? '+' : '-'}{formatCurrency(t.amount)}
                                                </p>
                                                <div className={`flex items-center gap-1 justify-end ${statusColor}`}>
                                                    <StatusIcon size={12} />
                                                    <span className="text-[10px] sm:text-xs">{translateStatus(t.status)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="pt-4">
                        <AdBanner
                            type="BANNER"
                            title="Aumente seu Score Hoje"
                            description="Nossos parceiros ajudam você a limpar seu nome e conseguir mais crédito."
                            actionText="ABRIR OFERTA"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
