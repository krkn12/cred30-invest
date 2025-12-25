import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ScrollText, ShieldCheck, Scale, Users, Gavel, AlertTriangle, CreditCard, ClockIcon, FileText, Zap, ShoppingBag, Tag, Lock, CheckCircle2 } from 'lucide-react';

const TermsPage = () => {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-500/30">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 w-full z-50 bg-zinc-950/50 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-3 sm:py-4">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <button
                        onClick={() => navigate(-1)}
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

            <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-20">
                <div className="mb-8 sm:mb-12">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-emerald-400 text-xs sm:text-sm font-bold mb-4 sm:mb-6">
                        <ShieldCheck size={14} /> Estatuto Social e Blindagem Jurídica
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-3 sm:mb-4 tracking-tight">Regulamento Interno</h1>
                    <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
                        A Cred30 NÃO é um banco, NÃO é uma fintech e NÃO é uma instituição financeira.
                        Este software gere um <strong>Clube de Benefícios Privado</strong> baseado em ajuda mútua e troca comunitária.
                    </p>
                </div>

                <div className="space-y-8 sm:space-y-12">
                    {/* AVISO CRITICAL */}
                    <section className="bg-red-500/5 border border-red-500/20 p-6 rounded-3xl">
                        <div className="flex items-start gap-4">
                            <div className="bg-red-500/20 p-2 rounded-xl text-red-400 animate-pulse">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-red-400 font-black uppercase text-sm tracking-widest">Aviso de Limitação de Responsabilidade</h3>
                                <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                                    Ao ingressar, o membro declara ciência de que a plataforma atua apenas como facilitadora tecnológica. Todas as operações de ajuda mútua ocorrem entre os membros (P2P), sob o risco integral dos participantes, sem garantia de rentabilidade ou fundo garantidor de crédito.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Natureza Jurídica Detalhada */}
                    <section className="bg-zinc-900/30 border border-white/5 p-8 rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-3 text-emerald-400">
                            <Scale size={24} /> 1. Estrutura de Blindagem (SCP)
                        </h2>
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="text-zinc-600 font-black text-2xl italic select-none">01</div>
                                <div>
                                    <h4 className="text-white font-bold mb-1 uppercase text-xs tracking-widest">Sociedade em Conta de Participação</h4>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        O modelo jurídico adotado é o de <strong>SCP (Art. 991 CC)</strong>. O ingresso do membro ocorre como "Sócio Participante". Não há prestação de serviços financeiros ao público em geral, mas sim uma união de capital privado para objetivo comum.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-zinc-600 font-black text-2xl italic select-none">02</div>
                                <div>
                                    <h4 className="text-white font-bold mb-1 uppercase text-xs tracking-widest">Inexistência de Oferta Pública</h4>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        A Cred30 NÃO realiza oferta pública de investimentos. O acesso é restrito a convidados e membros aprovados pelo comitê de score. Isso nos exclui da regulação da CVM (Comissão de Valores Mobiliários) quanto à oferta de títulos financeiros.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-zinc-600 font-black text-2xl italic select-none">03</div>
                                <div>
                                    <h4 className="text-white font-bold mb-1 uppercase text-xs tracking-widest">Mútuo Social e Privado</h4>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        Os apoios liberados no sistema são contratos civis de <strong>Mútuo Privado</strong> entre membros. As taxas cobradas visam a manutenção da infraestrutura e a proteção do lastro, sem configurar agiotagem ou atividade bancária ilícita.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Identificação do Sócio Ostensivo */}
                        <div className="mt-8 pt-6 border-t border-white/5">
                            <h4 className="text-white font-bold mb-3 uppercase text-xs tracking-widest flex items-center gap-2">
                                <Users size={14} className="text-emerald-400" />
                                Sócio Ostensivo (Responsável Legal)
                            </h4>
                            <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-sm">
                                <p className="text-zinc-300"><strong className="text-white">Nome:</strong> Josias da Silva Conceição</p>
                                <p className="text-zinc-300"><strong className="text-white">CPF:</strong> 064.XXX.XXX-XX</p>
                                <p className="text-zinc-300"><strong className="text-white">Endereço:</strong> Brasil</p>
                                <p className="text-zinc-500 text-xs mt-2 italic">
                                    Conforme Art. 991 do Código Civil, o Sócio Ostensivo é o único responsável perante terceiros pelas obrigações da sociedade.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* O Mercado como Prova de Valor */}
                    <section className="bg-cyan-900/10 border border-cyan-500/20 p-8 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-5">
                            <ShoppingBag size={150} />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-3 text-cyan-400 relative z-10">
                            <ShoppingBag size={24} /> 2. O Ecossistema de Trocas
                        </h2>
                        <p className="text-zinc-300 text-sm leading-relaxed mb-6 relative z-10">
                            A Cred30 fundamenta sua existência jurídica na operação de um <strong>Marketplace de Bens e Serviços</strong>. O saldo circulante no sistema é um crédito de troca comunitária ("Pontos de Troca"), lastreado pelos produtos reais anunciados por outros membros.
                        </p>
                        <div className="bg-black/40 p-5 rounded-2xl border border-white/5 relative z-10">
                            <h4 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-3">Compromisso de Transparência</h4>
                            <p className="text-xs text-zinc-500 italic">"Nossa prioridade é o comércio entre associados. O apoio financeiro é apenas um recurso secundário de fomento à economia do clube."</p>
                        </div>
                    </section>

                    {/* Prevenção de Crimes e Fraudes */}
                    <section className="bg-zinc-900/30 border border-white/5 p-8 rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-3 text-red-500">
                            <Lock size={24} /> 3. Tolerância Zero a Fraudes
                        </h2>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                            Embora preguemos a privacidade, reservamo-nos o direito de agir preventivamente contra crimes financeiros:
                        </p>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <CheckCircle2 size={16} className="text-emerald-500 mt-1 shrink-0" />
                                <span className="text-zinc-300 text-sm italic">O sistema monitora padrões de movimentação e pode bloquear contas suspeitas de lavagem de dinheiro ou origem ilícita sem aviso prévio.</span>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle2 size={16} className="text-emerald-500 mt-1 shrink-0" />
                                <span className="text-zinc-300 text-sm italic">Para retiradas acima de R$ 2.000,00, o clube poderá solicitar comprovação de origem dos recursos ou identificação adicional para proteção do associado ostensivo.</span>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle2 size={16} className="text-emerald-500 mt-1 shrink-0" />
                                <span className="text-zinc-300 text-sm italic">Tentativas de fraude no sistema de Score resultam em banimento imediato e retenção de multas administrativas.</span>
                            </li>
                        </ul>
                    </section>

                    {/* AVISO DE RISCO - CRÍTICO */}
                    <section className="bg-red-500/10 border-2 border-red-500/30 p-6 sm:p-8 rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-3 text-red-500">
                            <AlertTriangle size={24} /> 4. Aviso de Risco de Perda
                        </h2>
                        <div className="space-y-4">
                            <p className="text-red-300 text-sm sm:text-base font-bold leading-relaxed">
                                ⚠️ VOCÊ PODE PERDER TODO O CAPITAL APORTADO.
                            </p>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                O sistema de apoio mútuo <strong className="text-white">NÃO GARANTE</strong> retorno do investimento.
                                Os rendimentos passados não garantem rendimentos futuros.
                                Não invista recursos que você não pode perder.
                            </p>
                            <p className="text-zinc-500 text-xs italic">
                                Ao aceitar estes termos, você declara ciência de que assume integralmente os riscos
                                de perdas financeiras decorrentes da participação neste sistema de ajuda mútua.
                            </p>
                        </div>
                    </section>

                    {/* Elegibilidade e Capacidade */}
                    <section className="bg-zinc-900/30 border border-white/5 p-6 sm:p-8 rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-3 text-purple-400">
                            <Users size={24} /> 5. Elegibilidade e Capacidade
                        </h2>
                        <ul className="space-y-3 text-zinc-400 text-sm">
                            <li className="flex gap-3">
                                <CheckCircle2 size={16} className="text-emerald-500 mt-1 shrink-0" />
                                <span>É necessário ter <strong className="text-white">18 anos ou mais</strong> e plena capacidade civil para participar.</span>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle2 size={16} className="text-emerald-500 mt-1 shrink-0" />
                                <span>O cadastro é pessoal e intransferível. Cada CPF pode ter apenas uma conta.</span>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle2 size={16} className="text-emerald-500 mt-1 shrink-0" />
                                <span>É obrigatório possuir um <strong className="text-white">código de indicação</strong> válido de membro ativo.</span>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle2 size={16} className="text-emerald-500 mt-1 shrink-0" />
                                <span>A Cred30 reserva-se o direito de recusar ou encerrar cadastros a seu exclusivo critério.</span>
                            </li>
                        </ul>
                    </section>

                    {/* Vigência e Rescisão */}
                    <section className="bg-zinc-900/30 border border-white/5 p-6 sm:p-8 rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-3 text-amber-400">
                            <ClockIcon size={24} /> 6. Vigência e Rescisão
                        </h2>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                            A associação se encerra nas seguintes situações:
                        </p>
                        <ul className="space-y-3 text-zinc-400 text-sm">
                            <li className="flex gap-3">
                                <span className="text-amber-500 font-bold">•</span>
                                <span><strong className="text-white">Por vontade do membro:</strong> Mediante solicitação de exclusão de conta nas configurações.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-amber-500 font-bold">•</span>
                                <span><strong className="text-white">Por inadimplência:</strong> Após liquidação automática de licenças para quitação de débitos.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-amber-500 font-bold">•</span>
                                <span><strong className="text-white">Por violação:</strong> Tentativas de fraude, uso de múltiplas contas ou comportamento abusivo.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-amber-500 font-bold">•</span>
                                <span><strong className="text-white">Por decisão administrativa:</strong> A critério exclusivo do Sócio Ostensivo, sem necessidade de justificativa.</span>
                            </li>
                        </ul>
                    </section>

                    {/* Modificação dos Termos */}
                    <section className="bg-zinc-900/30 border border-white/5 p-6 sm:p-8 rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-3 text-blue-400">
                            <FileText size={24} /> 7. Modificação dos Termos
                        </h2>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            Os presentes termos podem ser alterados a qualquer momento, a critério exclusivo da administração.
                            O uso continuado da plataforma após alterações implica <strong className="text-white">aceite automático</strong> das novas condições.
                            Membros serão notificados por email sobre mudanças relevantes.
                        </p>
                    </section>

                    {/* Foro e Arbitragem */}
                    <section className="bg-zinc-900/30 border border-white/5 p-6 sm:p-8 rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-3 text-cyan-400">
                            <Gavel size={24} /> 8. Resolução de Conflitos
                        </h2>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                            Qualquer disputa oriunda deste contrato será resolvida preferencialmente por:
                        </p>
                        <ol className="space-y-3 text-zinc-400 text-sm list-decimal list-inside">
                            <li><strong className="text-white">Negociação direta</strong> através do suporte ao cliente.</li>
                            <li><strong className="text-white">Mediação/Arbitragem</strong> conforme Lei 9.307/96, em câmara a ser definida pelo Sócio Ostensivo.</li>
                            <li>Caso necessário, o <strong className="text-white">Foro da Comarca de São Paulo/SP</strong> é eleito para dirimir questões não resolvidas.</li>
                        </ol>
                        <p className="text-zinc-500 text-xs italic mt-4">
                            As partes renunciam a qualquer outro foro, por mais privilegiado que seja.
                        </p>
                    </section>

                    {/* Rodapé Jurídico */}
                    <section className="text-center space-y-4 pt-10">
                        <div className="w-16 h-1 bg-zinc-800 mx-auto rounded-full"></div>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                            Este regulamento tem força de CONTRATO SOCIAL PRIVADO entre as partes.
                        </p>
                        <p className="text-[9px] text-zinc-700 max-w-lg mx-auto leading-relaxed">
                            O uso continuado da plataforma implica na assinatura digital irrevogável deste estatuto.
                            Qualquer dúvida deve ser sanada via suporte administrativo antes da realização de qualquer contribuição.
                        </p>
                        <p className="text-[10px] text-emerald-600 font-bold mt-4">
                            Versão 2.0 • Vigente a partir de 25/12/2024
                        </p>
                    </section>
                </div>

                <footer className="mt-20 pt-10 border-t border-white/5 text-center">
                    <p className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">
                        Cred30 © 2025 - Sistema de Gestão Associativa Distribuída
                    </p>
                </footer>
            </main>
        </div>
    );
};

export default TermsPage;
