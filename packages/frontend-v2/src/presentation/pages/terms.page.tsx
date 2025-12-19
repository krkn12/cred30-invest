import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ScrollText, ShieldCheck, Scale, Users, Gavel } from 'lucide-react';

const TermsPage = () => {
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
                    <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 px-4 py-2 rounded-full text-cyan-400 text-sm font-bold mb-6">
                        <ScrollText size={16} /> Documento Oficial
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">Termos de Uso</h1>
                    <p className="text-zinc-400 text-lg">Atualizado em 18 de Dezembro de 2024</p>
                </div>

                <div className="space-y-12">
                    <section className="bg-zinc-900/30 border border-white/5 p-8 rounded-3xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 text-cyan-400">
                            <Users size={24} /> 1. Natureza da Cooperativa
                        </h2>
                        <p className="text-zinc-300 leading-relaxed mb-4">
                            O Cred30 é um sistema de cooperação financeira mútua. Ao se cadastrar, você não está apenas abrindo uma conta, mas tornando-se um membro participante de uma comunidade de crédito cooperativo.
                        </p>
                        <ul className="list-disc list-inside text-zinc-400 space-y-2 ml-4">
                            <li>A participação é voluntária e baseada na confiança mútua.</li>
                            <li>O capital da cooperativa é formado pelo aporte dos seus membros.</li>
                            <li>Todas as operações são transparentes e auditáveis pelo sistema.</li>
                        </ul>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                            <Scale size={24} className="text-cyan-400" /> 2. Regras de Investimento (Cotas)
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2">Valor da Cota</h3>
                                <p className="text-zinc-400 text-sm">Cada cota de participação possui o valor nominal fixado em R$ 50,00, podendo ser reajustado conforme deliberação do sistema.</p>
                            </div>
                            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2">Distribuição de Lucros</h3>
                                <p className="text-zinc-400 text-sm">85% de todo o lucro gerado pela cooperativa é distribuído proporcionalmente entre os detentores de cotas ativas.</p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-8 rounded-3xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 text-cyan-400">
                            <ShieldCheck size={24} /> 3. Resgates e Saques
                        </h2>
                        <p className="text-zinc-300 leading-relaxed mb-4">
                            Os membros podem solicitar o resgate de seus lucros e capitais via PIX, respeitando as seguintes condições:
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 flex-shrink-0 mt-1">1</div>
                                <p className="text-zinc-400 text-sm">Saques são processados por ordem de prioridade (membros com mais cotas possuem preferência na fila).</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 flex-shrink-0 mt-1">2</div>
                                <p className="text-zinc-400 text-sm">Resgates antecipados de cotas antes do período de carência podem estar sujeitos a taxas de manutenção da cooperativa.</p>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                            <Gavel size={24} className="text-cyan-400" /> 4. Conduta e Responsabilidades
                        </h2>
                        <p className="text-zinc-300 leading-relaxed">
                            É estritamente proibido o uso da plataforma para lavagem de dinheiro ou qualquer atividade ilícita. A cooperativa reserva-se o direito de banir membros que violarem as regras de boa convivência ou tentarem fraudar o sistema de score.
                        </p>
                    </section>
                </div>

                <footer className="mt-20 pt-10 border-t border-white/5 text-center">
                    <p className="text-zinc-500 text-sm italic">
                        Ao utilizar o Cred30, você declara estar ciente e de acordo com todas as regras aqui estabelecidas.
                    </p>
                </footer>
            </main>
        </div>
    );
};

export default TermsPage;
