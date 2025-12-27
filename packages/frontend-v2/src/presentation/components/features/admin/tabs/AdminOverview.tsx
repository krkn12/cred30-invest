import React, { memo } from 'react';
import { PieChart, TrendingUp, DollarSign, Vote, Users } from 'lucide-react';
import { AppState } from '../../../../../domain/types/common.types';

interface AdminOverviewProps {
    state: AppState;
}

const MetricCard = memo(({ title, value, subtitle, icon: Icon, color }: any) => {
    const colorClasses: any = {
        blue: "from-blue-600 to-blue-700 border-blue-500/30 shadow-blue-500/10",
        cyan: "from-primary-600 to-primary-700 border-primary-500/30 shadow-primary-500/10",
        emerald: "from-emerald-600 to-emerald-700 border-emerald-500/30 shadow-emerald-500/10",
        yellow: "from-amber-600 to-amber-700 border-amber-500/30 shadow-amber-500/10",
        red: "from-red-600 to-red-700 border-red-500/30 shadow-red-500/10",
        orange: "from-orange-600 to-orange-700 border-orange-500/30 shadow-orange-500/10",
        purple: "from-purple-600 to-purple-700 border-purple-500/30 shadow-purple-500/10",
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-6 text-white border shadow-lg transition-transform hover:scale-[1.02] duration-300`}>
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon size={20} className="text-white" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">{title}</span>
            </div>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className="text-[10px] opacity-90 mt-1 font-medium uppercase">{subtitle}</p>
        </div>
    );
});

MetricCard.displayName = 'MetricCard';

export const AdminOverview: React.FC<AdminOverviewProps> = ({ state }) => {
    const formatCurrency = (val: number | string) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (typeof numVal !== 'number' || isNaN(numVal)) return 'R$ 0,00';
        return numVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="Membros" value={state.users.length} subtitle="Usuários Totais" icon={Users} color="blue" />
                <MetricCard title="Participações" value={state.stats?.quotasCount ?? 0} subtitle="Licenças em Operação" icon={PieChart} color="cyan" />
                <MetricCard title="Custo Fixo Mensal" value={formatCurrency(state.stats?.systemConfig?.monthly_fixed_costs || 0)} subtitle="Despesas Recorrentes" icon={TrendingUp} color="orange" />
                <MetricCard title="Liquidez Real" value={formatCurrency(state.stats?.systemConfig?.real_liquidity ?? state.systemBalance)} subtitle="Disponível p/ Saque/Apoio" icon={DollarSign} color="emerald" />
                <MetricCard title="Votações Ativas" value={state.stats?.activeProposalsCount ?? 0} subtitle="Governança em Aberto" icon={Vote} color="purple" />
            </div>
        </div>
    );
};
