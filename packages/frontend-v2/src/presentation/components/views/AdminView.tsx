import React, { useState, useEffect, useCallback } from 'react';
import packageJson from '../../../../package.json';
import {
    ShieldCheck, RefreshCw, LogOut, ArrowUpRight, Send, MessageSquare, PieChart, Activity, Settings as SettingsIcon, UserPlus, ShoppingBag as ShoppingBagIcon, Vote
} from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { AppState } from '../../../domain/types/common.types';
import { clearAllCache } from '../../../application/services/storage.service';
import { apiService } from '../../../application/services/api.service';

// Tab Components
import { AdminOverview } from '../features/admin/tabs/AdminOverview';
import { AdminPayouts } from '../features/admin/tabs/AdminPayouts';
import { AdminMetrics } from '../features/admin/tabs/AdminMetrics';
import { AdminSystem } from '../features/admin/tabs/AdminSystem';
import { AdminReferrals } from '../features/admin/tabs/AdminReferrals';
import { AdminUsers } from '../features/admin/tabs/AdminUsers';
import { AdminGovernance } from '../features/admin/tabs/AdminGovernance';
import { AdminReviews } from '../features/admin/tabs/AdminReviews';

// Existing Shared Components
import { AdminStoreManager } from '../features/store/admin-store.component';
import { SupportAdminView } from './SupportAdminView';

interface AdminViewProps {
    state: AppState;
    onRefresh: () => void;
    onLogout: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

type TabType = 'overview' | 'payouts' | 'system' | 'store' | 'referrals' | 'support' | 'users' | 'metrics' | 'governance' | 'reviews';

export const AdminView = ({ state, onRefresh, onLogout, onSuccess, onError }: AdminViewProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [confirmMP, setConfirmMP] = useState<{ id: string, tid: string } | null>(null);

    const userRole = state.currentUser?.role || (state.currentUser?.isAdmin ? 'ADMIN' : 'MEMBER');
    const [activeTab, setActiveTab] = useState<TabType>(
        userRole === 'ATTENDANT' ? 'support' : 'overview'
    );

    const [pendingChatsCount, setPendingChatsCount] = useState(0);
    const [pendingPayoutsCount, setPendingPayoutsCount] = useState(0);
    const [pendingReviewsCount, setPendingReviewsCount] = useState(0);

    const fetchCounts = useCallback(async () => {
        try {
            // Fetch multiple counts in parallel
            const [supportRes, payoutRes, reviewsRes] = await Promise.all([
                apiService.getPendingSupportChats(),
                apiService.getPayoutQueue(),
                apiService.getAdminReviews()
            ]);

            setPendingChatsCount(supportRes.chats?.filter((c: any) => c.status === 'PENDING_HUMAN').length || 0);
            setPendingPayoutsCount(payoutRes.transactions?.length || 0);
            setPendingReviewsCount(reviewsRes.data?.filter((r: any) => r.is_public && !r.is_approved).length || 0);
        } catch (e) {
            console.error('Error fetching admin counts:', e);
        }
    }, []);

    useEffect(() => {
        fetchCounts();
        const interval = setInterval(fetchCounts, 30000);
        return () => clearInterval(interval);
    }, [fetchCounts]);

    const handleRefresh = async () => {
        setIsLoading(true);
        clearAllCache();
        await onRefresh();
        await fetchCounts();
        setIsLoading(false);
        onSuccess("Atualizado", "Dados sincronizados com o servidor.");
    };

    const confirmSimulateMpPayment = async () => {
        if (!confirmMP) return;
        const { id: paymentId, tid: transactionId } = confirmMP;
        try {
            const response = await apiService.post<any>('/admin/simulate-mp-payment', { paymentId, transactionId });
            if (response.success) {
                onSuccess('Simulação Sucesso', 'Pagamento aprovado no Sandbox.');
                await onRefresh();
            } else {
                onError('Erro na Simulação', response.message);
            }
        } catch (error: any) {
            onError('Erro ao Simular', error.message);
        }
    };

    const tabs = [
        { id: 'overview', name: 'Resumo', icon: PieChart, roles: ['ADMIN'] },
        { id: 'payouts', name: 'Resgates', icon: Send, count: pendingPayoutsCount, roles: ['ADMIN'] },
        { id: 'metrics', name: 'Monitoramento', icon: Activity, roles: ['ADMIN', 'ATTENDANT'] },
        { id: 'system', name: 'Financeiro', icon: SettingsIcon, roles: ['ADMIN'] },
        { id: 'referrals', name: 'Indicações', icon: UserPlus, roles: ['ADMIN'] },
        { id: 'users', name: 'Usuários', icon: ShieldCheck, roles: ['ADMIN'] },
        { id: 'store', name: 'Loja', icon: ShoppingBagIcon, roles: ['ADMIN'] },
        { id: 'governance', name: 'Governança', icon: Vote, roles: ['ADMIN'] },
        { id: 'reviews', name: 'Depoimentos', icon: MessageSquare, count: pendingReviewsCount, roles: ['ADMIN'] },
        { id: 'support', name: 'Suporte', icon: MessageSquare, count: pendingChatsCount, roles: ['ADMIN', 'ATTENDANT'] },
    ].filter(tab => tab.roles.includes(userRole));

    return (
        <div className="space-y-8 pb-20 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header Modernizado */}
            <div className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-8 border border-zinc-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

                <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center border border-primary-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)] group-hover:scale-105 transition-transform duration-500">
                            <ShieldCheck size={40} className="text-primary-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold text-white tracking-tight">Painel de Controle</h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="flex h-2.5 w-2.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                                <p className="text-xs text-zinc-400 font-bold uppercase tracking-[0.2em]">Servidor Ativo • v{packageJson.version}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button
                            onClick={handleRefresh}
                            className="group bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-primary-500/50 px-6 py-3.5 rounded-2xl flex items-center gap-3 transition-all duration-300 text-sm font-bold text-zinc-300 shadow-lg"
                        >
                            <RefreshCw size={18} className={isLoading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
                            {isLoading ? "Sincronizando" : "Atualizar Sistema"}
                        </button>
                        <button
                            onClick={onLogout}
                            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 px-6 py-3.5 rounded-2xl flex items-center gap-3 transition-all duration-300 text-sm font-bold text-red-500 shadow-lg"
                        >
                            <LogOut size={18} /> Sair
                        </button>
                    </div>
                </div>
            </div>

            {/* Abas */}
            <div className="flex items-center gap-1.5 p-1.5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-[2rem] overflow-x-auto no-scrollbar shadow-xl sticky top-4 z-50">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`
                            relative flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-sm font-bold transition-all duration-500 whitespace-nowrap
                            ${activeTab === tab.id
                                ? 'bg-zinc-800 text-white shadow-2xl border border-zinc-700/50 scale-[1.02]'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}
                        `}
                    >
                        <tab.icon size={20} className={activeTab === tab.id ? "text-primary-400" : ""} />
                        {tab.name}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="flex h-5 w-5 items-center justify-center bg-primary-500 text-zinc-900 text-[10px] font-black rounded-full shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[600px]">
                {activeTab === 'overview' && <AdminOverview state={state} />}
                {activeTab === 'payouts' && <AdminPayouts onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'metrics' && <AdminMetrics />}
                {activeTab === 'system' && <AdminSystem state={state} onRefresh={onRefresh} onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'referrals' && <AdminReferrals onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'users' && <AdminUsers onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'store' && <AdminStoreManager onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'governance' && <AdminGovernance onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'reviews' && <AdminReviews onSuccess={onSuccess} onError={onError} />}
                {activeTab === 'support' && <SupportAdminView />}
            </div>

            {confirmMP && (
                <ConfirmModal
                    isOpen={true}
                    title="Simular Pagamento"
                    message="Deseja aprovar este pagamento no Sandbox?"
                    onConfirm={confirmSimulateMpPayment}
                    onClose={() => setConfirmMP(null)}
                />
            )}
        </div>
    );
};
