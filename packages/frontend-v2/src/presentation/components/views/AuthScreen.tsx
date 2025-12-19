import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, KeyRound, Lock, QrCode, Repeat, ArrowLeft, Mail, ShieldCheck, XCircle, ChevronRight, Check } from 'lucide-react';
import { loginUser, registerUser, resetPassword, verify2FA, apiService } from '../../../application/services/storage.service';
import { TermsAcceptanceModal } from '../ui/TermsAcceptanceModal';
import { User } from '../../../domain/types/common.types';

export const AuthScreen = ({ onLogin }: { onLogin: (u: User) => void }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [isForgot, setIsForgot] = useState(false);

    // Verification Modal State
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [verifyEmailAddr, setVerifyEmailAddr] = useState('');
    const [verifyCode, setVerifyCode] = useState('');

    // Form States
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [secretPhrase, setSecretPhrase] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // 2FA Setup State
    const [twoFactorData, setTwoFactorData] = useState<{ secret: string, qrCode: string, otpUri: string } | null>(null);
    const [is2FASetup, setIs2FASetup] = useState(false);
    const [requires2FA, setRequires2FA] = useState(false);
    const [twoFactorCode, setTwoFactorCode] = useState('');

    // Error/Success States for Custom Alerts
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showTerms, setShowTerms] = useState(false);

    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (isForgot) {
            try {
                await resetPassword(email, secretPhrase, newPassword);
                setSuccess('Senha redefinida com sucesso! Faça login.');
                setTimeout(() => {
                    setIsForgot(false);
                    setNewPassword('');
                    setSuccess(null);
                }, 2000);
            } catch (error: any) {
                setError(error.message);
            }
            return;
        }

        if (isRegister) {
            // Validar campos básicos antes de mostrar os termos
            if (!name || !email || !password || !pixKey || !secretPhrase) {
                setError("Por favor, preencha todos os campos obrigatórios.");
                return;
            }
            setShowTerms(true);
            return;
        }

        try {
            const res = await loginUser(email, password, secretPhrase, twoFactorCode);

            if (res.requires2FA) {
                setRequires2FA(true);
                setError(null);
                setSuccess('Código 2FA necessário');
                return;
            }

            onLogin(res);
        } catch (error: any) {
            // Se o backend indicar que o email não está verificado
            if (error.requiresVerification) {
                setVerifyEmailAddr(error.email || email);
                setShowVerifyModal(true);
                setError(error.message);
            } else {
                setError(error.message);
            }
        }
    };

    const handleConfirmRegistration = async () => {
        setShowTerms(false);
        setError(null);
        try {
            const res = await registerUser(name, email, password, pixKey, secretPhrase, referralCode);
            if (res.twoFactor) {
                setTwoFactorData(res.twoFactor);
                setVerifyEmailAddr(email);
                setIs2FASetup(true);
                setShowVerifyModal(true);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };


    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const res = await verify2FA(verifyEmailAddr, verifyCode);
            if (res.success) {
                setSuccess('2FA ativado com sucesso!');
                setTimeout(() => {
                    setShowVerifyModal(false);
                    setIsRegister(false);
                    setIs2FASetup(false);
                    setSuccess(null);
                }, 1500);
            } else {
                setError(res.message);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
            <button
                onClick={() => navigate('/')}
                className="fixed top-8 left-8 text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold group z-50 bg-surface/50 backdrop-blur-md px-4 py-2 rounded-full border border-surfaceHighlight"
            >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                Voltar para o Início
            </button>

            <div className="w-full max-w-md bg-surface border border-surfaceHighlight p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-400 to-primary-600"></div>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-tr from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center text-black font-bold text-3xl shadow-[0_0_20px_rgba(34,211,238,0.4)] mx-auto mb-4">
                        C
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Cred<span className="text-primary-400">30</span></h1>
                    <p className="text-zinc-500 mt-2 text-sm">Sua liberdade financeira começa aqui.</p>
                </div>

                {/* Custom Error Alert */}
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <XCircle size={20} className="shrink-0" />
                        <p className="text-sm font-medium">{error}</p>
                        <button onClick={() => setError(null)} className="ml-auto hover:text-white"><XCircle size={16} /></button>
                    </div>
                )}

                {/* Custom Success Alert */}
                {success && (
                    <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <Check size={20} className="shrink-0" />
                        <p className="text-sm font-medium">{success}</p>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    {isForgot ? (
                        <>
                            <h2 className="text-white text-lg font-medium text-center mb-4">Recuperar Senha</h2>
                            <div className="space-y-4">
                                <div className="relative">
                                    <Users className="absolute left-3 top-3 text-zinc-500" size={20} />
                                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                                </div>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-3 text-zinc-500" size={20} />
                                    <input type="text" placeholder="Frase Secreta" value={secretPhrase} onChange={e => setSecretPhrase(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-zinc-500" size={20} />
                                    <input type="password" placeholder="Nova Senha" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] mt-4">Redefinir Senha</button>
                            <button type="button" onClick={() => setIsForgot(false)} className="w-full text-zinc-400 text-sm hover:text-white mt-2">Voltar para Login</button>
                        </>
                    ) : (
                        <>
                            {isRegister && (
                                <div className="relative">
                                    <Users className="absolute left-3 top-3 text-zinc-500" size={20} />
                                    <input type="text" placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                                </div>
                            )}
                            <div className="relative">
                                <Users className="absolute left-3 top-3 text-zinc-500" size={20} />
                                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-zinc-500" size={20} />
                                <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                            </div>

                            <div className="relative">
                                <KeyRound className="absolute left-3 top-3 text-zinc-500" size={20} />
                                <input type="text" placeholder={isRegister ? "Crie sua Frase Secreta" : "Frase Secreta"} value={secretPhrase} onChange={e => setSecretPhrase(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                            </div>

                            {isRegister && (
                                <>
                                    <div className="relative">
                                        <QrCode className="absolute left-3 top-3 text-zinc-500" size={20} />
                                        <input type="text" placeholder="Sua Chave PIX" value={pixKey} onChange={e => setPixKey(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" required />
                                    </div>
                                    <div className="relative">
                                        <Repeat className="absolute left-3 top-3 text-zinc-500" size={20} />
                                        <input type="text" placeholder="Código de Indicação (Opcional)" value={referralCode} onChange={e => setReferralCode(e.target.value)} className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition" />
                                    </div>
                                </>
                            )}

                            {requires2FA && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="bg-primary-500/10 border border-primary-500/20 p-4 rounded-2xl flex items-center gap-4">
                                        <ShieldCheck className="text-primary-400 shrink-0" size={24} />
                                        <div>
                                            <p className="text-white font-bold text-sm">Autenticação 2FA</p>
                                            <p className="text-zinc-400 text-xs">Insira o código do seu app autenticador.</p>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <ShieldCheck className="absolute left-3 top-3 text-zinc-500" size={20} />
                                        <input
                                            type="text"
                                            placeholder="Código 6 dígitos"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            value={twoFactorCode}
                                            onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="w-full bg-background border border-primary-500/50 rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition text-center tracking-[0.5em] font-mono"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] mt-4">
                                {isRegister ? 'Criar Conta' : (requires2FA ? 'Verificar e Entrar' : 'Entrar')}
                            </button>
                        </>
                    )}
                </form>

                {!isForgot && (
                    <div className="mt-6 text-center space-y-2">
                        <p className="text-zinc-400 text-sm">
                            {isRegister ? 'Já tem uma conta?' : 'Não tem uma conta?'}
                            <button onClick={() => setIsRegister(!isRegister)} className="ml-2 text-primary-400 hover:text-primary-300 font-medium">
                                {isRegister ? 'Fazer Login' : 'Criar Agora'}
                            </button>
                        </p>
                        {!isRegister && (
                            <button onClick={() => setIsForgot(true)} className="text-zinc-500 text-sm hover:text-zinc-300">
                                Esqueci minha senha
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Email Verification Modal */}
            {showVerifyModal && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300 backdrop-blur-md">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 md:p-10 w-full max-w-md relative shadow-[0_0_80px_rgba(6,182,212,0.15)]">
                        <button onClick={() => setShowVerifyModal(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors">
                            <XCircle size={24} />
                        </button>

                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-primary-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3 shadow-inner">
                                <ShieldCheck size={40} className="text-primary-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Configurar Autenticador</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                Escaneie o QR Code abaixo com o <strong>Google Authenticator</strong> ou <strong>Authy</strong>.
                            </p>
                        </div>

                        {twoFactorData?.qrCode && (
                            <div className="space-y-6 mb-8">
                                <div className="bg-white p-4 rounded-3xl mx-auto w-fit shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-transform hover:scale-105">
                                    <img src={twoFactorData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                                </div>

                                {twoFactorData?.otpUri && (
                                    <a
                                        href={twoFactorData.otpUri}
                                        className="w-full bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold transition-all group"
                                    >
                                        <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />
                                        Configurar no Navegador (Extensão)
                                    </a>
                                )}
                            </div>
                        )}

                        <div className="bg-surfaceHighlight/30 border border-surfaceHighlight rounded-2xl p-4 mb-8 space-y-4">
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Emissor</p>
                                <p className="text-white font-medium">Cred30</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Conta (Usuário)</p>
                                <p className="text-white font-medium truncate">{verifyEmailAddr}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Chave Secreta</p>
                                <div className="flex items-center justify-between gap-3">
                                    <code className="text-primary-400 font-mono text-lg font-bold">{twoFactorData?.secret}</code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(twoFactorData?.secret || '');
                                            setSuccess('Chave copiada!');
                                            setTimeout(() => setSuccess(null), 2000);
                                        }}
                                        className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all"
                                    >
                                        <Repeat size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm flex items-center gap-3">
                                <XCircle size={18} />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleVerifySubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Código de Confirmação</label>
                                <input
                                    type="text"
                                    placeholder="000000"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    value={verifyCode}
                                    onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full bg-background border border-surfaceHighlight rounded-2xl py-5 text-center text-white text-3xl tracking-[0.4em] font-mono focus:border-primary-500 outline-none transition shadow-inner"
                                    autoFocus
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-5 rounded-2xl transition-all shadow-[0_10px_30px_rgba(6,182,212,0.3)] flex items-center justify-center gap-3 text-lg mt-4 group"
                            >
                                <ShieldCheck size={22} className="group-hover:scale-110 transition-transform" />
                                Ativar 2FA e Entrar
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <TermsAcceptanceModal
                isOpen={showTerms}
                onClose={() => setShowTerms(false)}
                onAccept={handleConfirmRegistration}
            />
        </div>
    );
};
