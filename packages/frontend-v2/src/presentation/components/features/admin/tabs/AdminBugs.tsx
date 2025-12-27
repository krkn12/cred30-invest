import React, { useState, useEffect } from 'react';
import { Bug, CheckCircle2, Clock, AlertTriangle, Trash2, MessageSquare, RefreshCw } from 'lucide-react';
import { apiService } from '../../../../../application/services/api.service';

interface AdminBugsProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

interface BugReport {
    id: number;
    user_id: number;
    user_email: string;
    user_name: string;
    title: string;
    description: string;
    category: string;
    severity: string;
    status: string;
    device_info: string;
    admin_notes: string;
    created_at: string;
    resolved_at: string | null;
}

export const AdminBugs: React.FC<AdminBugsProps> = ({ onSuccess, onError }) => {
    const [bugs, setBugs] = useState<BugReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('open');
    const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [counts, setCounts] = useState({ open: 0, inProgress: 0 });

    const fetchBugs = async () => {
        setIsLoading(true);
        try {
            const res = await apiService.get<any>(`/bugs/admin?status=${statusFilter}`) as any;
            if (res.success) {
                setBugs(res.data || []);
                setCounts(res.counts || { open: 0, inProgress: 0 });
            }
        } catch (error) {
            console.error('Erro ao buscar bugs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBugs();
    }, [statusFilter]);

    const handleUpdateStatus = async (bugId: number, newStatus: string) => {
        try {
            const res = await apiService.patch<any>(`/bugs/admin/${bugId}`, {
                status: newStatus,
                adminNotes: adminNotes || undefined
            });
            if (res.success) {
                onSuccess('Atualizado', 'Status do bug atualizado.');
                setSelectedBug(null);
                setAdminNotes('');
                fetchBugs();
            } else {
                onError('Erro', res.message);
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    const handleDelete = async (bugId: number) => {
        if (!window.confirm('Excluir este bug definitivamente?')) return;
        try {
            const res = await apiService.delete<any>(`/bugs/admin/${bugId}`);
            if (res.success) {
                onSuccess('Excluído', 'Bug removido com sucesso.');
                fetchBugs();
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-500 text-white';
            case 'high': return 'bg-orange-500 text-black';
            case 'medium': return 'bg-yellow-500 text-black';
            default: return 'bg-zinc-600 text-white';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'resolved': return <CheckCircle2 size={14} className="text-emerald-400" />;
            case 'in_progress': return <Clock size={14} className="text-yellow-400" />;
            case 'closed': return <CheckCircle2 size={14} className="text-zinc-500" />;
            default: return <AlertTriangle size={14} className="text-red-400" />;
        }
    };

    const translateCategory = (category: string) => {
        const map: Record<string, string> = {
            'general': 'Geral',
            'payment': 'Pagamentos',
            'ui': 'Interface',
            'performance': 'Lentidão',
            'other': 'Outro'
        };
        return map[category] || category;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-2xl">
                        <Bug className="text-red-400" size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Central de Bugs</h2>
                        <p className="text-zinc-500 text-sm">Gerencie os problemas reportados pelos membros</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-full">
                        <span className="text-red-400 font-bold text-sm">{counts.open}</span>
                        <span className="text-zinc-500 text-xs">Abertos</span>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-full">
                        <span className="text-yellow-400 font-bold text-sm">{counts.inProgress}</span>
                        <span className="text-zinc-500 text-xs">Em Progresso</span>
                    </div>
                    <button onClick={fetchBugs} className="p-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition">
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {['open', 'in_progress', 'resolved', 'closed', 'all'].map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${statusFilter === status
                            ? 'bg-primary-500 text-black'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                    >
                        {status === 'open' ? 'Abertos' :
                            status === 'in_progress' ? 'Em Progresso' :
                                status === 'resolved' ? 'Resolvidos' :
                                    status === 'closed' ? 'Fechados' : 'Todos'}
                    </button>
                ))}
            </div>

            {/* Bug List */}
            <div className="space-y-4">
                {isLoading && (
                    <div className="text-center py-12 text-zinc-500 animate-pulse">Carregando bugs...</div>
                )}

                {!isLoading && bugs.length === 0 && (
                    <div className="text-center py-20 opacity-50">
                        <Bug size={48} className="mx-auto mb-4" />
                        <p className="text-sm font-bold uppercase">Nenhum bug encontrado</p>
                    </div>
                )}

                {bugs.map(bug => (
                    <div
                        key={bug.id}
                        className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition cursor-pointer"
                        onClick={() => setSelectedBug(bug)}
                    >
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    {getStatusIcon(bug.status)}
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${getSeverityColor(bug.severity)}`}>
                                        {bug.severity}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase">
                                        {translateCategory(bug.category)}
                                    </span>
                                </div>
                                <h4 className="text-white font-bold text-lg">{bug.title}</h4>
                                <p className="text-zinc-500 text-sm mt-1 line-clamp-2">{bug.description}</p>
                            </div>

                            <div className="text-right shrink-0">
                                <p className="text-xs text-zinc-500">{bug.user_name || bug.user_email}</p>
                                <p className="text-[10px] text-zinc-600">{new Date(bug.created_at).toLocaleString('pt-BR')}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bug Detail Modal */}
            {selectedBug && (
                <div
                    className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setSelectedBug(null); }}
                >
                    <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-full ${getSeverityColor(selectedBug.severity)}`}>
                                        {selectedBug.severity}
                                    </span>
                                    <span className="text-xs text-zinc-500 font-bold">#{selectedBug.id}</span>
                                </div>
                                <h3 className="text-xl font-bold text-white">{selectedBug.title}</h3>
                            </div>
                            <button onClick={() => setSelectedBug(null)} className="text-zinc-500 hover:text-white">✕</button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <p className="text-xs text-zinc-500 font-bold uppercase mb-2">Descrição</p>
                                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{selectedBug.description}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Reportado Por</p>
                                    <p className="text-white">{selectedBug.user_name || 'N/A'}</p>
                                    <p className="text-zinc-500 text-xs">{selectedBug.user_email}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Data</p>
                                    <p className="text-white">{new Date(selectedBug.created_at).toLocaleString('pt-BR')}</p>
                                </div>
                            </div>

                            {selectedBug.device_info && (
                                <div>
                                    <p className="text-xs text-zinc-500 font-bold uppercase mb-2">Informações do Dispositivo</p>
                                    <pre className="text-xs text-zinc-400 bg-black/30 p-3 rounded-xl overflow-x-auto">
                                        {JSON.stringify(JSON.parse(selectedBug.device_info), null, 2)}
                                    </pre>
                                </div>
                            )}

                            <div>
                                <p className="text-xs text-zinc-500 font-bold uppercase mb-2">Notas Administrativas</p>
                                <textarea
                                    value={adminNotes || selectedBug.admin_notes || ''}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    placeholder="Adicione observações sobre este bug..."
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm resize-none focus:border-primary-500 outline-none"
                                    rows={3}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2 pt-4 border-t border-zinc-800">
                                {selectedBug.status !== 'in_progress' && (
                                    <button
                                        onClick={() => handleUpdateStatus(selectedBug.id, 'in_progress')}
                                        className="px-4 py-2 bg-yellow-500/10 text-yellow-400 rounded-xl text-sm font-bold hover:bg-yellow-500/20 transition"
                                    >
                                        <Clock size={14} className="inline mr-2" />
                                        Em Progresso
                                    </button>
                                )}
                                {selectedBug.status !== 'resolved' && (
                                    <button
                                        onClick={() => handleUpdateStatus(selectedBug.id, 'resolved')}
                                        className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-bold hover:bg-emerald-500/20 transition"
                                    >
                                        <CheckCircle2 size={14} className="inline mr-2" />
                                        Resolvido
                                    </button>
                                )}
                                {selectedBug.status !== 'closed' && (
                                    <button
                                        onClick={() => handleUpdateStatus(selectedBug.id, 'closed')}
                                        className="px-4 py-2 bg-zinc-700/50 text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-700 transition"
                                    >
                                        Fechar
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(selectedBug.id)}
                                    className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm font-bold hover:bg-red-500/20 transition ml-auto"
                                >
                                    <Trash2 size={14} className="inline mr-2" />
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
