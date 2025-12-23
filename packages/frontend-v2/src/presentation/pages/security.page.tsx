import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Key, Server, Cpu, Activity, Globe } from 'lucide-react';

const SecurityPage = () => {
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
                    <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full text-emerald-400 text-sm font-bold mb-6">
                        <ShieldCheck size={16} /> Segurança de Nível Corporativo
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">Segurança do Sistema</h1>
                    <p className="text-zinc-400 text-lg">Tecnologia avançada para proteger seu patrimônio.</p>
                </div>

                <div className="space-y-10">
                    <div className="grid md:grid-cols-2 gap-8">
                        <section className="bg-zinc-900/30 border border-white/5 p-8 rounded-3xl hover:bg-zinc-900/50 transition-colors group">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mb-6 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                                <Key size={24} />
                            </div>
                            <h2 className="text-xl font-bold mb-3">Frase Secreta (2FA)</h2>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                Além da sua senha, cada transação importante exige sua frase secreta única. Isso garante que, mesmo em caso de perda da senha, seu dinheiro permaneça inatingível por terceiros.
                            </p>
                        </section>

                        <section className="bg-zinc-900/30 border border-white/5 p-8 rounded-3xl hover:bg-zinc-900/50 transition-colors group">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 mb-6 group-hover:bg-blue-500 group-hover:text-black transition-all">
                                <Globe size={24} />
                            </div>
                            <h2 className="text-xl font-bold mb-3">Criptografia SSL</h2>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                Todos os dados que trafegam entre seu dispositivo e nossos servidores são protegidos por criptografia SSL de 256 bits, o mesmo padrão utilizado pelos maiores bancos do mundo.
                            </p>
                        </section>
                    </div>

                    <section className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/5 p-10 rounded-[3rem] relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                <Server size={24} className="text-emerald-400" /> Infraestrutura Resiliente
                            </h2>
                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <Cpu className="text-zinc-500 flex-shrink-0" size={20} />
                                    <div>
                                        <h3 className="font-bold">Backup em Tempo Real</h3>
                                        <p className="text-zinc-400 text-sm italic">O registro de cada cota e transação é replicado em múltiplos servidores simultaneamente, evitando qualquer perda de dados.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <Activity className="text-zinc-500 flex-shrink-0" size={20} />
                                    <div>
                                        <h3 className="font-bold">Monitoramento Anti-Fraude</h3>
                                        <p className="text-zinc-400 text-sm italic">Algoritmos de IA analisam padrões de movimentação 24/7 para detectar e bloquear tentativas de acesso suspeitas.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Background Glow */}
                        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px]"></div>
                    </section>

                    <section className="text-center py-10">
                        <p className="text-zinc-500 text-sm max-w-2xl mx-auto">
                            Nossa segurança baseia-se no tripé:
                            <span className="text-emerald-400 font-bold"> Criptografia Robusta</span>,
                            <span className="text-emerald-400 font-bold"> Lastro Real</span> e
                            <span className="text-emerald-400 font-bold"> Verificação de Identidade</span>.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default SecurityPage;
