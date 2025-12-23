import React, { useState, useEffect } from 'react';
import { Search, Shield, UserX, UserCheck, ShieldCheck, Mail, Calendar, DollarSign, Award, Plus, X as XIcon, UserPlus } from 'lucide-react';
import { apiService } from '../../../../application/services/api.service';

interface User {
    id: number;
    name: string;
    email: string;
    role: 'MEMBER' | 'ATTENDANT' | 'ADMIN';
    status: 'ACTIVE' | 'BLOCKED';
    balance: number;
    score: number;
    created_at: string;
    pix_key: string;
}

export const AdminUserManagement = ({ onSuccess, onError }: { onSuccess: any, onError: any }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newAttendant, setNewAttendant] = useState({
        name: '',
        email: '',
        password: '',
        secretPhrase: '',
        pixKey: ''
    });

    useEffect(() => {
        fetchUsers();
    }, [roleFilter, statusFilter]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await apiService.adminGetUsers({ search, role: roleFilter, status: statusFilter });
            if (res.success) {
                setUsers(res.data);
            }
        } catch (error: any) {
            onError('Erro', 'Falha ao buscar membros');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateAccess = async (userId: number, role?: string, status?: string) => {
        try {
            const res = await apiService.adminUpdateUserAccess({ userId, role, status });
            if (res.success) {
                onSuccess('Sucesso', 'Permissões atualizadas!');
                fetchUsers();
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    const handleCreateAttendant = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await apiService.adminCreateAttendant(newAttendant);
            if (res.success) {
                onSuccess('Sucesso', 'Atendente criado com sucesso!');
                setShowCreateModal(false);
                setNewAttendant({ name: '', email: '', password: '', secretPhrase: '', pixKey: '' });
                fetchUsers();
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    const roleBadge = (role: string) => {
        switch (role) {
            case 'ADMIN': return <span className="flex items-center gap-1 text-[10px] font-black bg-red-500/10 text-red-400 px-2 py-1 rounded-full border border-red-500/20"><Shield size={10} /> ADMIN</span>;
            case 'ATTENDANT': return <span className="flex items-center gap-1 text-[10px] font-black bg-blue-500/10 text-blue-400 px-2 py-1 rounded-full border border-blue-500/20"><ShieldCheck size={10} /> ATENDENTE</span>;
            default: return <span className="text-[10px] font-black bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full border border-zinc-700/50">MEMBRO</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 shadow-xl">
                <div className="flex-1 w-full md:max-w-md relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Pesquisar por nome ou email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                        className="w-full bg-black/40 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-primary-500/50 transition-all font-medium"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold rounded-xl px-4 py-3.5 outline-none focus:border-primary-500/50 cursor-pointer"
                        aria-label="Filtrar por cargo"
                    >
                        <option value="">Todos Cargos</option>
                        <option value="MEMBER">Membros</option>
                        <option value="ATTENDANT">Atendentes</option>
                        <option value="ADMIN">Admins</option>
                    </select>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex-1 md:flex-none bg-primary-500 hover:bg-primary-400 text-black font-black px-6 py-3.5 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={20} /> ADICIONAR EQUIPE
                    </button>
                </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-black/40 border-b border-zinc-800">
                                <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Membro</th>
                                <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status/Cargo</th>
                                <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Saldo/Score</th>
                                <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center">
                                        <div className="w-10 h-10 border-2 border-primary-500/20 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center text-zinc-500 font-bold uppercase text-xs tracking-widest">Nenhum membro encontrado</td>
                                </tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 font-black text-xs shadow-inner uppercase tracking-tighter">
                                                    {user.name.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-white group-hover:text-primary-400 transition-colors uppercase tracking-tight">{user.name}</p>
                                                    <p className="text-[11px] text-zinc-500 font-medium flex items-center gap-1"><Mail size={10} /> {user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-2 scale-90 origin-left">
                                                <div className="flex gap-2">
                                                    {roleBadge(user.role)}
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${user.status === 'ACTIVE'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                        }`}>
                                                        {user.status === 'ACTIVE' ? 'ATIVO' : 'BLOQUEADO'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-zinc-600 flex items-center gap-1 font-bold uppercase"><Calendar size={10} /> Desde {new Date(user.created_at).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-white tracking-tight flex items-center justify-end gap-1"><DollarSign size={14} className="text-emerald-400" /> {user.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                <p className="text-[11px] text-primary-400 font-black flex items-center justify-end gap-1"><Award size={12} /> {user.score} pts</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-center gap-2">
                                                {user.status === 'ACTIVE' ? (
                                                    <button
                                                        title="Bloquear Conta"
                                                        onClick={() => handleUpdateAccess(user.id, undefined, 'BLOCKED')}
                                                        className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border border-red-500/20"
                                                    >
                                                        <UserX size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        title="Desbloquear Conta"
                                                        onClick={() => handleUpdateAccess(user.id, undefined, 'ACTIVE')}
                                                        className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center border border-emerald-500/20"
                                                    >
                                                        <UserCheck size={18} />
                                                    </button>
                                                )}

                                                {user.role === 'MEMBER' && (
                                                    <button
                                                        title="Promover a Atendente"
                                                        onClick={() => handleUpdateAccess(user.id, 'ATTENDANT', undefined)}
                                                        className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center border border-blue-500/20"
                                                    >
                                                        <UserPlus size={18} />
                                                    </button>
                                                )}

                                                {user.role === 'ATTENDANT' && (
                                                    <button
                                                        title="Remover Permissões de Equipe"
                                                        onClick={() => handleUpdateAccess(user.id, 'MEMBER', undefined)}
                                                        className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center border border-amber-500/20"
                                                    >
                                                        <Shield size={18} className="rotate-180" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-md relative animate-in zoom-in-95 duration-300">
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="absolute top-6 right-6 text-zinc-500 hover:text-white"
                            aria-label="Fechar modal"
                            title="Fechar modal"
                        >
                            <XIcon size={24} />
                        </button>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-primary-500/10 rounded-2xl border border-primary-500/20">
                                <ShieldCheck size={28} className="text-primary-400" />
                            </div>
                            <div>
                                <h4 className="text-xl font-black text-white uppercase tracking-tight">Criar Atendente</h4>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Equipe Operacional</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateAttendant} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Nome Completo</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ex: João Ferreira"
                                    value={newAttendant.name}
                                    onChange={(e) => setNewAttendant({ ...newAttendant, name: e.target.value })}
                                    className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-medium"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Email de Acesso</label>
                                <input
                                    required
                                    type="email"
                                    placeholder="joao@suporte.com"
                                    value={newAttendant.email}
                                    onChange={(e) => setNewAttendant({ ...newAttendant, email: e.target.value })}
                                    className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-medium"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Senha</label>
                                    <input
                                        required
                                        type="password"
                                        placeholder="******"
                                        value={newAttendant.password}
                                        onChange={(e) => setNewAttendant({ ...newAttendant, password: e.target.value })}
                                        className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-medium"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Pix (Auxílio)</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Chave PIX"
                                        value={newAttendant.pixKey}
                                        onChange={(e) => setNewAttendant({ ...newAttendant, pixKey: e.target.value })}
                                        className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-medium"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Frase Secreta (2FA)</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Palavras de segurança"
                                    value={newAttendant.secretPhrase}
                                    onChange={(e) => setNewAttendant({ ...newAttendant, secretPhrase: e.target.value })}
                                    className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-primary-500/50 font-medium"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-5 rounded-2xl transition-all shadow-xl mt-4"
                            >
                                CADASTRAR EQUIPE
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
