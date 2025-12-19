import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, EyeOff, ShieldCheck, Database, Fingerprint } from 'lucide-react';

const PrivacyPage = () => {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-500/30">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 w-full z-50 bg-zinc-950/50 backdrop-blur-xl border-b border-white/5 px-6 py-4">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <button
                        onClick={() => navigate('/')}
                        className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        Voltar
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-white font-bold text-sm border border-white/10">
                            C
                        </div>
                        <span className="text-lg font-bold tracking-tight">Cred<span className="text-cyan-400">30</span></span>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-6 pt-32 pb-20">
                <div className="mb-12">
                    <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-full text-purple-400 text-sm font-bold mb-6">
                        <Lock size={16} /> Privacidade Blindada
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">Política de Privacidade</h1>
                    <p className="text-zinc-400 text-lg">Sua privacidade é nossa prioridade absoluta.</p>
                </div>

                <div className="space-y-12">
                    <section className="bg-zinc-900/30 border border-white/5 p-8 rounded-3xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 text-purple-400">
                            <EyeOff size={24} /> 1. Coleta Mínima de Dados
                        </h2>
                        <p className="text-zinc-300 leading-relaxed">
                            Coletamos apenas o estritamente necessário para o funcionamento da cooperativa e segurança da sua conta: Nome, E-mail, Chave PIX e dados de transações internas. Nunca solicitamos acesso aos seus contatos, galeria de fotos ou localização.
                        </p>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                            <Database size={24} className="text-purple-400" /> 2. Armazenamento e Segurança
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2">Criptografia de Ponta</h3>
                                <p className="text-zinc-400 text-sm">Suas senhas e frases secretas são armazenadas utilizando algoritmos de hashing impossíveis de serem revertidos.</p>
                            </div>
                            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2">Não Compartilhamento</h3>
                                <p className="text-zinc-400 text-sm">A Cred30 jamais vende ou compartilha seus dados com empresas de marketing ou terceiros.</p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-8 rounded-3xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 text-purple-400">
                            <Fingerprint size={24} /> 3. Identidade Digital
                        </h2>
                        <p className="text-zinc-300 leading-relaxed mb-4">
                            Cada membro possui um score interno baseado em seu comportamento na plataforma. Estes dados são privados e servem apenas para:
                        </p>
                        <ul className="list-disc list-inside text-zinc-400 space-y-2 ml-4 text-sm">
                            <li>Determinar limites de crédito.</li>
                            <li>Definir prioridades na fila de resgate.</li>
                            <li>Prevenir atividades fraudulentas.</li>
                        </ul>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                            <ShieldCheck size={24} className="text-purple-400" /> 4. Seus Direitos
                        </h2>
                        <p className="text-zinc-300 leading-relaxed">
                            Você tem total controle sobre seus dados. A qualquer momento, você pode solicitar a exclusão definitiva da sua conta e de todos os dados associados a ela através das configurações do seu perfil.
                        </p>
                    </section>
                </div>

                <footer className="mt-20 pt-10 border-t border-white/5 text-center">
                    <p className="text-zinc-500 text-sm">
                        Dúvidas sobre seus dados? Entre em contato com nossa equipe de suporte.
                    </p>
                </footer>
            </main>
        </div>
    );
};

export default PrivacyPage;
