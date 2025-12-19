import React from 'react';
import { Star, Copy, Lock, ChevronRight, LogOut, Trash2, X as XIcon, ShieldCheck, QrCode, Repeat } from 'lucide-react';
import { User } from '../../../domain/types/common.types';
import { ConfirmModal } from '../ui/ConfirmModal';
import { get2FASetup, verify2FA } from '../../../application/services/storage.service';

export const SettingsView = ({ user, onSimulateTime, onLogout, onDeleteAccount, onChangePassword }: {
    user: User,
    onSimulateTime: () => void,
    onLogout: () => void,
    onDeleteAccount: () => void,
    onChangePassword: (oldPass: string, newPass: string) => Promise<void>
}) => {
    const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);
    const [showChangePassword, setShowChangePassword] = React.useState(false);
    const [oldPassword, setOldPassword] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState('');

    // 2FA Setup
    const [show2FASetup, setShow2FASetup] = React.useState(false);
    const [twoFactorData, setTwoFactorData] = React.useState<{ secret: string, qrCode: string, otpUri: string } | null>(null);
    const [verifyCode, setVerifyCode] = React.useState('');
    const [successMessage, setSuccessMessage] = React.useState('');

    const handle2FASetup = async () => {
        try {
            const data = await get2FASetup();
            setTwoFactorData(data);
            setShow2FASetup(true);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar dados 2FA');
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            const res = await verify2FA(user.email, verifyCode);
            if (res.success) {
                setSuccessMessage('2FA ativado com sucesso!');
                setTimeout(() => {
                    setShow2FASetup(false);
                    setSuccessMessage('');
                    window.location.reload(); // Recarregar para atualizar status do 2FA
                }, 1500);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao verificar código');
        } finally {
            setIsSubmitting(false);
        }
    };

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

            <div className="pt-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-4">Segurança</h3>
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

                    <button
                        onClick={handle2FASetup}
                        className="w-full bg-surfaceHighlight hover:bg-zinc-800 text-white border border-white/5 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group"
                    >
                        <span className="flex items-center gap-3">
                            <ShieldCheck size={18} className={`${user.twoFactorEnabled ? 'text-emerald-400' : 'text-zinc-400'} group-hover:text-primary-400 transition-colors`} />
                            Autenticação 2FA
                        </span>
                        <div className="flex items-center gap-2">
                            {!user.twoFactorEnabled ? (
                                <span className="text-[10px] bg-primary-500 text-black px-2 py-1 rounded-full font-extrabold animate-pulse">
                                    ATIVAR AGORA
                                </span>
                            ) : (
                                <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Ativo</span>
                            )}
                            <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                        </div>
                    </button>
                </div>
            </div>

            <div className="pt-8">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-4">Conta</h3>
                <div className="space-y-3">

                    <button onClick={onLogout} className="w-full bg-surfaceHighlight hover:bg-zinc-800 text-white border border-white/5 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group">
                        <span className="flex items-center gap-3">
                            <LogOut size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
                            Sair do App
                        </span>
                        <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                    </button>

                    <button onClick={() => setShowConfirmDelete(true)} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-4 rounded-xl font-bold transition flex items-center justify-between px-4 group">
                        <span className="flex items-center gap-3">
                            <Trash2 size={18} className="text-red-500/60 group-hover:text-red-500 transition-colors" />
                            Encerrar Conta
                        </span>
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={showConfirmDelete}
                onClose={() => setShowConfirmDelete(false)}
                onConfirm={onDeleteAccount}
                title="Encerrar Conta"
                message="Tem certeza? Essa ação não pode ser desfeita e todos os seus dados serão anonimizados."
                confirmText="Sim, Encerrar Conta"
                type="danger"
            />

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

            {/* 2FA Setup Modal */}
            {show2FASetup && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300 backdrop-blur-md">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-6 md:p-8 w-full max-w-md relative shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setShow2FASetup(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors z-10"><XIcon size={24} /></button>

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck size={32} className="text-primary-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Segurança 2FA</h3>
                            <p className="text-zinc-400 text-sm">Escaneie o QR Code abaixo no seu app de autenticação.</p>
                        </div>

                        {twoFactorData?.qrCode && (
                            <div className="space-y-4 mb-6">
                                <div className="bg-white p-3 rounded-2xl mx-auto w-fit shadow-lg">
                                    <img src={twoFactorData.qrCode} alt="2FA QR Code" className="w-40 h-40" />
                                </div>
                                {twoFactorData?.otpUri && (
                                    <a
                                        href={twoFactorData.otpUri}
                                        className="w-full bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all group"
                                    >
                                        <QrCode size={16} className="group-hover:rotate-12 transition-transform" />
                                        Configurar no Navegador
                                    </a>
                                )}
                            </div>
                        )}

                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 mb-6 space-y-4">
                            <div className="flex justify-between items-start border-b border-white/5 pb-3">
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Emissor</p>
                                    <p className="text-white font-medium">Cred30</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Conta</p>
                                    <p className="text-white font-medium truncate max-w-[120px]">{user.email}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2">Chave Secreta</p>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 font-mono text-primary-400 text-sm font-bold tracking-wider overflow-x-auto whitespace-nowrap hide-scrollbar">
                                        {twoFactorData?.secret}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(twoFactorData?.secret || '');
                                            setSuccessMessage('Copiado!');
                                            setTimeout(() => setSuccessMessage(''), 2000);
                                        }}
                                        className="h-10 w-10 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-xl flex items-center justify-center transition-all active:scale-90"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && <div className="mb-4 text-red-500 text-center text-xs">{error}</div>}
                        {successMessage && <div className="mb-4 text-emerald-500 text-center text-xs font-bold animate-pulse">{successMessage}</div>}

                        <form onSubmit={handleVerify2FA} className="space-y-4">
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="000000"
                                value={verifyCode}
                                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-4 text-center text-white text-3xl tracking-[0.3em] font-mono focus:border-primary-500 outline-none"
                                required
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-4 rounded-xl transition shadow-lg shadow-primary-500/20"
                            >
                                {isSubmitting ? 'Verificando...' : 'Ativar 2FA Agora'}
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
