import React from 'react';
import { Star, Copy, Lock, ChevronRight, LogOut, Trash2, X as XIcon } from 'lucide-react';
import { User } from '../../../domain/types/common.types';

export const SettingsView = ({ user, onSimulateTime, onLogout, onDeleteAccount, onChangePassword }: {
    user: User,
    onSimulateTime: () => void,
    onLogout: () => void,
    onDeleteAccount: () => void,
    onChangePassword: (oldPass: string, newPass: string) => Promise<void>
}) => {
    const [showChangePassword, setShowChangePassword] = React.useState(false);
    const [oldPassword, setOldPassword] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState('');

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        if (newPassword.length < 6) {
            setError('A nova senha deve ter pelo menos 6 caracteres');
            return;
        }

        setIsSubmitting(true);
        try {
            await onChangePassword(oldPassword, newPassword);
            setShowChangePassword(false);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setError(err.message || 'Erro ao alterar senha');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">

            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Perfil</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-zinc-500">Nome</label>
                        <p className="text-white border-b border-surfaceHighlight pb-2">{user.name}</p>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500">Email</label>
                        <p className="text-white border-b border-surfaceHighlight pb-2">{user.email}</p>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500">Chave PIX</label>
                        <p className="text-white border-b border-surfaceHighlight pb-2">{user.pixKey}</p>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500">Score de Crédito</label>
                        <div className="flex items-center gap-2 border-b border-surfaceHighlight pb-2">
                            <Star size={16} className="text-primary-400" fill="currentColor" />
                            <p className="text-white font-bold">{user.score || 0}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-surfaceHighlight text-zinc-400">
                                {(user.score || 0) > 700 ? 'Excelente' : (user.score || 0) > 400 ? 'Bom' : 'Regular'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500">Código de Indicação</label>
                        <div className="flex items-center gap-2">
                            <p className="text-primary-400 font-bold text-xl">{user.referralCode}</p>
                            <button title="Copiar" className="text-zinc-500 hover:text-white" onClick={() => {
                                navigator.clipboard.writeText(user.referralCode);
                            }}><Copy size={16} /></button>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Compartilhe e ganhe R$ 5,00 por amigo.</p>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <button
                    onClick={() => setShowChangePassword(true)}
                    className="w-full bg-surfaceHighlight hover:bg-zinc-800 text-white border border-white/5 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group"
                >
                    <span className="flex items-center gap-3">
                        <Lock size={18} className="text-zinc-400 group-hover:text-primary-400 transition-colors" />
                        Alterar Senha
                    </span>
                    <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                </button>

                <button onClick={onLogout} className="w-full bg-surfaceHighlight hover:bg-zinc-800 text-white border border-white/5 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group">
                    <span className="flex items-center gap-3">
                        <LogOut size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
                        Sair do App
                    </span>
                    <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                </button>

                <button onClick={() => {
                    if (confirm('Tem certeza? Essa ação não pode ser desfeita.')) {
                        onDeleteAccount();
                    }
                }} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group">
                    <span className="flex items-center gap-3">
                        <Trash2 size={18} className="text-red-500/60 group-hover:text-red-500 transition-colors" />
                        Encerrar Conta
                    </span>
                </button>
            </div>

            {/* Change Password Modal */}
            {showChangePassword && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowChangePassword(false); }}>
                    <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-fade-in shadow-2xl">
                        <button title="Fechar" onClick={() => setShowChangePassword(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-full z-10"><XIcon size={24} /></button>

                        <h3 className="text-xl font-bold text-white mb-4">Alterar Senha</h3>

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Senha Atual</label>
                                <input
                                    type="password"
                                    required
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Nova Senha</label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Confirmar Nova Senha</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition"
                                />
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl mt-2 transition"
                            >
                                {isSubmitting ? 'Alterando...' : 'Alterar Senha'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="pt-8 text-center">
                <p className="text-zinc-600 text-xs font-mono">Versão 2.1.0 • Cred30</p>
            </div>
        </div >
    );
};
