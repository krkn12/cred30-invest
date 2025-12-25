import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, KeyRound, Lock, QrCode, Repeat, ArrowLeft, Mail, ShieldCheck, XCircle, ChevronRight, Check, Copy } from 'lucide-react';
import { loginUser, registerUser, resetPassword, verify2FA, apiService } from '../../../application/services/storage.service';
import { TermsAcceptanceModal } from '../ui/TermsAcceptanceModal';
import { User } from '../../../domain/types/common.types';

export const AuthScreen = ({ onLogin }: { onLogin: (u: User) => void }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [isForgot, setIsForgot] = useState(false);
    const [isRecover2FA, setIsRecover2FA] = useState(false); // Recuperar autenticador perdido

    // Verification Modal State
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [verifyEmailAddr, setVerifyEmailAddr] = useState('');
    const [verifyCode, setVerifyCode] = useState('');

    // Form States
    const [name, setName] = useState('');
    const [cpf, setCpf] = useState('');
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
    const [pendingUser, setPendingUser] = useState<User | null>(null);

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Capturar código de indicação da URL se existir
    React.useEffect(() => {
        const ref = searchParams.get('ref');
        if (ref) {
            setReferralCode(ref.toUpperCase());
            setIsRegister(true); // Se tem link de indicação, provavelmente quer cadastrar
        }
    }, [searchParams]);

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

    // Função para recuperar 2FA usando email + senha + frase secreta
    const handleRecover2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!email || !password || !secretPhrase) {
            setError('Preencha email, senha e frase secreta.');
            return;
        }

        try {
            const res = await apiService.recover2FA(email, password, secretPhrase);
            if (res.success && res.data?.twoFactor) {
                setTwoFactorData(res.data.twoFactor);
                setVerifyEmailAddr(email);
                setIs2FASetup(true);
                setShowVerifyModal(true);
                setSuccess('2FA recuperado! Configure novamente seu autenticador.');
            } else {
                setError(res.message || 'Erro ao recuperar 2FA');
            }
        } catch (error: any) {
            setError(error.message || 'Erro ao recuperar 2FA');
        }
    };

    const handleConfirmRegistration = async () => {
        setShowTerms(false);
        setError(null);
        try {
            const res = await registerUser(name, email, password, pixKey, secretPhrase, referralCode, cpf);
            if (res.twoFactor) {
                setTwoFactorData(res.twoFactor);
                setVerifyEmailAddr(email);
                setPendingUser(res.user);
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
                setSuccess('Conta ativada com sucesso! Entrando...');
                setTimeout(() => {
                    setShowVerifyModal(false);
                    if (pendingUser) {
                        onLogin(pendingUser);
                    } else {
                        setIsRegister(false);
                        setIs2FASetup(false);
                    }
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
        <main className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-6 md:p-8 relative">
            <div className="w-full max-w-[98vw] sm:max-w-md bg-surface border border-surfaceHighlight p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl relative overflow-hidden max-h-[95vh] overflow-y-auto">
                <div className="absolute top-0 left-0 w-full h-1.5 sm:h-2 bg-gradient-to-r from-primary-400 to-primary-600"></div>

                {/* Botão Voltar - Dentro do card */}
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-xs font-medium group mb-4 sm:mb-6 mt-1"
                >
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    Voltar
                </button>

                <div className="text-center mb-4 sm:mb-8">
                    <img src="/pwa-192x192.png" alt="Cred30 Logo" width="80" height="80" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.4)] mx-auto mb-4" />
                    <h1 className="text-xl sm:text-3xl font-bold text-white tracking-tighter">Cred<span className="text-primary-400">30</span></h1>
                    <p className="text-zinc-400 mt-1 text-[10px] sm:text-sm">Sua liberdade financeira começa aqui.</p>
                </div>

                {/* Custom Error Alert */}
                {error && (
                    <div className="mb-4 sm:mb-6 bg-red-500/10 border border-red-500/20 text-red-500 p-3 sm:p-4 rounded-xl flex items-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2">
                        <XCircle size={18} className="shrink-0" />
                        <p className="text-xs sm:text-sm font-medium flex-1">{error}</p>
                        <button onClick={() => setError(null)} className="hover:text-white" aria-label="Fechar erro"><XCircle size={14} /></button>
                    </div>
                )}

                {/* Custom Success Alert */}
                {success && (
                    <div className="mb-4 sm:mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-3 sm:p-4 rounded-xl flex items-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2">
                        <Check size={18} className="shrink-0" />
                        <p className="text-xs sm:text-sm font-medium">{success}</p>
                    </div>
                )}

                <form
                    onSubmit={handleLogin}
                    method="POST"
                    action="/login"
                    className="space-y-3 sm:space-y-4"
                >
                    {isForgot ? (
                        <>
                            <h2 className="text-white text-lg font-medium text-center mb-4">Recuperar Senha</h2>
                            <div className="space-y-4">
                                <div className="relative">
                                    <Users className="absolute left-3 top-3 text-zinc-500" size={20} />
                                    <input
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        placeholder="Email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition"
                                        required
                                    />
                                </div>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-3 text-zinc-500" size={20} />
                                    <input
                                        type="text"
                                        name="secretPhrase"
                                        autoComplete="off"
                                        placeholder="Frase Secreta"
                                        value={secretPhrase}
                                        onChange={e => setSecretPhrase(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition"
                                        required
                                    />
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-zinc-500" size={20} />
                                    <input
                                        type="password"
                                        name="new-password"
                                        autoComplete="new-password"
                                        placeholder="Nova Senha"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition"
                                        required
                                    />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] mt-4">Redefinir Senha</button>
                            <button type="button" onClick={() => setIsForgot(false)} className="w-full text-zinc-400 text-sm hover:text-white mt-2">Voltar para Login</button>

                            <div className="mt-8 p-4 bg-primary-500/5 rounded-xl border border-primary-500/10 text-center">
                                <p className="text-zinc-400 text-xs mb-2 text-balance leading-relaxed">Esqueceu a senha E a frase secreta? Por segurança, sua conta foi bloqueada para auto-recuperação.</p>
                                <a
                                    href="https://wa.me/550000000000?text=Olá, perdi minha senha e frase secreta da Cred30 e preciso de ajuda com a recuperação de identidade."
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-400 hover:text-primary-300 text-xs font-bold underline decoration-primary-500/30"
                                >
                                    Falar com Suporte Humano
                                </a>
                            </div>
                        </>
                    ) : isRecover2FA ? (
                        <>
                            <h2 className="text-white text-lg font-medium text-center mb-4">Recuperar Autenticador 2FA</h2>
                            <p className="text-zinc-400 text-sm text-center mb-4 text-balance">
                                Perdeu acesso ao seu app autenticador? Use seu email, senha e frase secreta para gerar um novo QR Code.
                            </p>
                            <div className="space-y-4">
                                <div className="relative">
                                    <Users className="absolute left-3 top-3 text-zinc-500" size={20} />
                                    <input
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        placeholder="Email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition"
                                        required
                                    />
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-zinc-500" size={20} />
                                    <input
                                        type="password"
                                        name="password"
                                        autoComplete="current-password"
                                        placeholder="Senha"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition"
                                        required
                                    />
                                </div>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-3 text-zinc-500" size={20} />
                                    <input
                                        type="text"
                                        name="secretPhrase"
                                        autoComplete="off"
                                        placeholder="Frase Secreta"
                                        value={secretPhrase}
                                        onChange={e => setSecretPhrase(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 pl-10 text-white focus:border-primary-500 outline-none transition"
                                        required
                                    />
                                </div>
                            </div>
                            <button type="button" onClick={handleRecover2FA} className="w-full bg-primary-500 hover:bg-primary-400 text-black font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] mt-4">Recuperar 2FA</button>
                            <button type="button" onClick={() => setIsRecover2FA(false)} className="w-full text-zinc-400 text-sm hover:text-white mt-2">Voltar para Login</button>

                            <div className="mt-8 p-4 bg-primary-500/5 rounded-xl border border-primary-500/10 text-center">
                                <p className="text-zinc-400 text-xs mb-2 text-balance leading-relaxed">Não lembra a frase secreta? O suporte pode desativar seu 2FA após confirmar sua identidade.</p>
                                <a
                                    href="https://wa.me/550000000000?text=Olá, perdi meu autenticador e não lembro minha frase secreta. Preciso de ajuda administrativa."
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-400 hover:text-primary-300 text-xs font-bold underline decoration-primary-500/30"
                                >
                                    Falar com Suporte Humano
                                </a>
                            </div>
                        </>
                    ) : (
                        <>
                            {isRegister && (
                                <div className="relative">
                                    <Users className="absolute left-3 top-2.5 sm:top-3 text-zinc-500" size={18} />
                                    <input
                                        type="text"
                                        name="name"
                                        autoComplete="name"
                                        placeholder="Nome Completo"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-background border border-surfaceHighlight rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-10 text-sm sm:text-base text-white focus:border-primary-500 outline-none transition"
                                        required
                                    />
                                </div>
                            )}
                            <div className="relative">
                                <Users className="absolute left-3 top-2.5 sm:top-3 text-zinc-500" size={18} />
                                <input
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-10 text-sm sm:text-base text-white focus:border-primary-500 outline-none transition"
                                    required
                                />
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 sm:top-3 text-zinc-500" size={18} />
                                <input
                                    type="password"
                                    name="password"
                                    autoComplete={isRegister ? "new-password" : "current-password"}
                                    placeholder="Senha"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-10 text-sm sm:text-base text-white focus:border-primary-500 outline-none transition"
                                    required
                                />
                            </div>

                            <div className="relative">
                                <KeyRound className="absolute left-3 top-2.5 sm:top-3 text-zinc-500" size={18} />
                                <input
                                    type="password"
                                    name="secretPhrase"
                                    autoComplete="off"
                                    placeholder={isRegister ? "Crie sua Frase Secreta" : "Frase Secreta"}
                                    value={secretPhrase}
                                    onChange={e => setSecretPhrase(e.target.value)}
                                    className="w-full bg-background border border-surfaceHighlight rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-10 text-sm sm:text-base text-white focus:border-primary-500 outline-none transition"
                                    required
                                />
                            </div>

                            {isRegister && (
                                <>
                                    <div className="relative animate-in fade-in slide-in-from-left-2">
                                        <ShieldCheck className="absolute left-3 top-2.5 sm:top-3 text-zinc-500" size={18} />
                                        <input
                                            type="text"
                                            name="cpf"
                                            autoComplete="off"
                                            placeholder="Seu CPF (11 dígitos)"
                                            value={cpf}
                                            onChange={e => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                            className="w-full bg-background border border-surfaceHighlight rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-10 text-sm sm:text-base text-white focus:border-primary-500 outline-none transition"
                                            required
                                        />
                                    </div>

                                    <div className="relative">
                                        <QrCode className="absolute left-3 top-2.5 sm:top-3 text-zinc-500" size={18} />
                                        <input
                                            type="text"
                                            name="pixKey"
                                            autoComplete="off"
                                            placeholder="Sua Chave PIX"
                                            value={pixKey}
                                            onChange={e => setPixKey(e.target.value)}
                                            className="w-full bg-background border border-surfaceHighlight rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-10 text-sm sm:text-base text-white focus:border-primary-500 outline-none transition"
                                            required
                                        />
                                    </div>
                                    <div className="relative">
                                        <Repeat className="absolute left-3 top-2.5 sm:top-3 text-zinc-500" size={18} />
                                        <input
                                            type="text"
                                            name="referralCode"
                                            autoComplete="off"
                                            placeholder="Código de Indicação (Obrigatorio)"
                                            value={referralCode}
                                            onChange={e => setReferralCode(e.target.value)}
                                            className="w-full bg-background border border-primary-500/30 rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-10 text-sm sm:text-base text-white focus:border-primary-500 outline-none transition"
                                            required
                                        />
                                    </div>
                                    <p className="text-[10px] text-zinc-400 px-1 italic">O Cred30 é exclusivo. Registros exigem um convite.</p>
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
                                            name="twoFactorCode"
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

                {!isForgot && !isRecover2FA && (
                    <div className="mt-4 sm:mt-6 text-center space-y-2">
                        <p className="text-zinc-400 text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0">
                            <span>{isRegister ? 'Já tem uma conta?' : 'Não tem uma conta?'}</span>
                            <button onClick={() => setIsRegister(!isRegister)} className="sm:ml-2 text-primary-400 hover:text-primary-300 font-bold py-1.5 sm:py-0 underline sm:no-underline">
                                {isRegister ? 'Fazer Login' : 'Criar Agora'}
                            </button>
                        </p>
                        {!isRegister && (
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                                <button type="button" onClick={() => setIsForgot(true)} className="text-zinc-500 text-xs sm:text-sm hover:text-zinc-300 py-1">
                                    Esqueci minha senha
                                </button>
                                <button type="button" onClick={() => setIsRecover2FA(true)} className="text-zinc-500 text-xs sm:text-sm hover:text-primary-400 py-1">
                                    Perdi meu autenticador 2FA
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <footer className="mt-8 pt-6 border-t border-white/5 text-center text-[10px] text-zinc-500 space-y-2">
                    <div className="flex justify-center gap-4">
                        <a href="/terms" target="_blank" className="hover:text-zinc-300 underline transition-colors">Termos de Uso</a>
                        <button type="button" onClick={() => setShowTerms(true)} className="hover:text-zinc-300 underline transition-colors">Política de Privacidade</button>
                    </div>
                    <p className="font-medium">Cred30 Associativo • © 2025 Comunidade Segura</p>
                </footer>
            </div>

            {/* Email Verification Modal */}
            {showVerifyModal && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300 backdrop-blur-md">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-6 md:p-10 w-full max-w-md relative shadow-[0_0_80px_rgba(6,182,212,0.15)] max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setShowVerifyModal(false)} className="absolute top-4 right-4 md:top-6 md:right-6 text-zinc-500 hover:text-white transition-colors z-10" aria-label="Fechar modal">
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

                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 mb-8 space-y-4">
                            <div className="flex justify-between items-start border-b border-white/5 pb-3">
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Emissor</p>
                                    <p className="text-white font-medium">Cred30</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Conta</p>
                                    <p className="text-white font-medium truncate max-w-[120px]">{verifyEmailAddr}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Chave Secreta</p>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-primary-400 text-lg font-bold tracking-wider overflow-x-auto whitespace-nowrap hide-scrollbar">
                                        {twoFactorData?.secret}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(twoFactorData?.secret || '');
                                            setSuccess('Chave copiada!');
                                            setTimeout(() => setSuccess(null), 2000);
                                        }}
                                        className="h-12 w-12 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-xl flex items-center justify-center transition-all active:scale-90"
                                        title="Copiar Chave"
                                    >
                                        <Copy size={20} />
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
                                    name="verifyCode"
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
            )
            }

            <TermsAcceptanceModal
                isOpen={showTerms}
                onClose={() => setShowTerms(false)}
                onAccept={handleConfirmRegistration}
            />
        </main >
    );
};
