import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, KeyRound, Lock, QrCode, Repeat, ArrowLeft, Mail, ShieldCheck, XCircle, ChevronRight, Check } from 'lucide-react';
import { loginUser, registerUser, resetPassword, verifyEmail } from '../../../application/services/storage.service';
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

    // Error/Success States for Custom Alerts
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        try {
            if (isForgot) {
                await resetPassword(email, secretPhrase, newPassword);
                setSuccess('Senha redefinida com sucesso! Faça login.');
                setTimeout(() => {
                    setIsForgot(false);
                    setNewPassword('');
                    setSuccess(null);
                }, 2000);
                return;
            }

            if (isRegister) {
                try {
                    await registerUser(name, email, password, pixKey, secretPhrase, referralCode);
                    setVerifyEmailAddr(email);
                    setShowVerifyModal(true);
                } catch (e: any) {
                    setError(e.message);
                }
            } else {
                const user = await loginUser(email, password, secretPhrase);
                onLogin(user);
            }
        } catch (error: any) {
            setError(error.message);
        }
    };

    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const res = await verifyEmail(verifyEmailAddr, verifyCode);
            if (res.success) {
                setSuccess('Email verificado com sucesso!');
                setTimeout(() => {
                    setShowVerifyModal(false);
                    setIsRegister(false);
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

                            <button type="submit" className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] mt-4">
                                {isRegister ? 'Criar Conta' : 'Entrar'}
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
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="bg-surface rounded-3xl p-6 w-full max-w-sm relative border border-surfaceHighlight shadow-2xl">
                        <button onClick={() => setShowVerifyModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">✕</button>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                <Mail size={32} className="text-primary-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Verifique seu Email</h3>
                            <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                                Enviamos um código de verificação para <strong className="text-white">{verifyEmailAddr}</strong>.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm text-center">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-3 rounded-lg text-sm text-center">
                                {success}
                            </div>
                        )}

                        <form onSubmit={handleVerifySubmit} className="space-y-4">
                            <input
                                type="text"
                                placeholder="Código de Verificação"
                                value={verifyCode}
                                onChange={e => setVerifyCode(e.target.value.toUpperCase().slice(0, 10))}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-4 text-center text-white text-lg tracking-widest font-mono focus:border-primary-500 outline-none uppercase transition"
                                autoFocus
                                required
                            />
                            <button
                                type="submit"
                                className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2"
                            >
                                <ShieldCheck size={18} />
                                Verificar e Entrar
                            </button>
                        </form>
                        <p className="text-center mt-4">
                            <button onClick={() => setSuccess("Código reenviado (simulação).")} className="text-xs text-primary-400 hover:underline">Reenviar Código</button>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
