import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ScrollText, ShieldCheck, Scale, Users, Gavel, AlertTriangle, CreditCard, ClockIcon, FileText, Zap, ShoppingBag, Tag } from 'lucide-react';

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
                    <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-cyan-400 text-xs sm:text-sm font-bold mb-4 sm:mb-6">
                        <ScrollText size={14} /> Documento Oficial
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-3 sm:mb-4 tracking-tight">Termos de Uso</h1>
                    <p className="text-zinc-400 text-sm sm:text-lg">Última atualização: 20 de Dezembro de 2024</p>
                </div>

                <div className="space-y-8 sm:space-y-12">
                    {/* Seção 1 */}
                    <section className="bg-zinc-900/30 border border-white/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-3 text-cyan-400">
                            <FileText size={22} /> 1. Aceite e Vigência
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4">
                            Ao criar uma conta no Cred30, você declara ter lido, compreendido e aceito integralmente os presentes Termos de Uso. Este documento constitui um contrato vinculante entre você ("Usuário" ou "Membro") e a plataforma Cred30 ("Sistema" ou "Cooperativa").
                        </p>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-yellow-400 shrink-0 mt-0.5" size={20} />
                                <p className="text-yellow-200 text-xs sm:text-sm">
                                    <strong>AVISO IMPORTANTE:</strong> Se você não concorda com qualquer cláusula deste documento, não utilize a plataforma.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Seção 2 */}
                    <section className="bg-zinc-900/30 border border-white/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-3 text-emerald-400 font-mono">
                            <Users size={22} /> 2. Natureza da Comunidade (Grupo Fechado)
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4">
                            O Cred30 é uma plataforma de gestão para uma **Economia Social Fechada**. Ao se cadastrar, você declara ser parte de um grupo restrito de ajuda mútua, sujeito às seguintes condições:
                        </p>
                        <ul className="list-disc list-inside text-zinc-400 text-[10px] sm:text-xs space-y-2 ml-2 sm:ml-4 font-medium uppercase tracking-wider">
                            <li>A adesão é restrita e baseada em convite e confiança mútua.</li>
                            <li>O capital é formado por aportes de capital social (Participações) para uso exclusivo do grupo.</li>
                            <li>As sobras financeiras são distribuídas como bonificação por participação, não como rendimento financeiro fixo.</li>
                            <li>A plataforma NÃO realiza intermediação financeira pública e não é regulada pelo BACEN.</li>
                            <li>A aquisição de participações não constitui investimento em valores mobiliários sob a ótica da CVM.</li>
                        </ul>
                    </section>

                    {/* Seção 3 */}
                    <section className="space-y-4 sm:space-y-6">
                        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
                            <Scale size={22} className="text-emerald-400" /> 3. Participações e Excedentes
                        </h2>
                        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                            <div className="bg-zinc-900/50 p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2 text-white">Aporte de Capital</h3>
                                <p className="text-zinc-400 text-xs sm:text-sm">Cada participação representa um aporte de R$ 50,00 no fundo comum. Isso não é um depósito bancário, mas um direito de participação nos resultados da conta comum.</p>
                            </div>
                            <div className="bg-zinc-900/50 p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2 text-white">Excedentes (Participação)</h3>
                                <p className="text-zinc-400 text-xs sm:text-sm">85% das sobras operacionais (taxas e anúncios) são distribuídas como bônus de participação. Não há promessa de rendimento fixo ou garantido.</p>
                            </div>
                            <div className="bg-zinc-900/50 p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2 text-white">Cessão e Carência (Regra de 1 Ano)</h3>
                                <p className="text-zinc-400 text-xs sm:text-sm">As participações têm carência de 1 ano (365 dias) para resgate integral. Resgates antes desse prazo implicam em multa de 40% sobre o valor, destinada ao fundo de reserva.</p>
                            </div>
                            <div className="bg-zinc-900/50 p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2 text-white">Fundo de Reserva</h3>
                                <p className="text-zinc-400 text-xs sm:text-sm">15% de todo excedente é retido para blindagem do capital contra inadimplência e manutenção da infraestrutura tecnológica.</p>
                            </div>
                        </div>
                    </section>

                    {/* Seção 4 */}
                    <section className="bg-zinc-900/30 border border-white/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-3 text-emerald-400">
                            <CreditCard size={22} /> 4. Apoio Mútuo (Mútuo Social)
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4">
                            Os membros podem solicitar apoio financeiro do fundo comum sob a égide do Mútuo Civil (Art. 586 do CC). As condições são:
                        </p>
                        <div className="space-y-3 sm:space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 flex-shrink-0 text-xs font-bold">1</div>
                                <p className="text-zinc-400 text-xs sm:text-sm"><strong className="text-white">Limite Dinâmico:</strong> Calculado pelo score de reputação interna e garantias aportadas.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 flex-shrink-0 text-xs font-bold">2</div>
                                <p className="text-zinc-400 text-xs sm:text-sm"><strong className="text-white">Taxa de Sustentabilidade:</strong> Taxa de 20% destinada ao reequilíbrio do fundo e bonificação dos demais membros (não se confunde com juros bancários).</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 flex-shrink-0 text-xs font-bold">3</div>
                                <p className="text-zinc-400 text-xs sm:text-sm"><strong className="text-white">Garantia Real:</strong> Os apoios são lastreados pelas participações do membro. Em caso de atraso superior a 5 dias, o sistema executará automaticamente o lastro, liquidando as cotas necessárias para quitar o débito.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 flex-shrink-0 text-xs font-bold">4</div>
                                <p className="text-zinc-400 text-xs sm:text-sm"><strong className="text-white">Juros de Mora:</strong> Aplica-se multa diária de 0.5% sobre o valor total em atraso, além da restrição de score imediata.</p>
                            </div>
                        </div>
                    </section>

                    {/* Seção 5 */}
                    <section className="bg-zinc-900/30 border border-white/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-3 text-cyan-400">
                            <ShieldCheck size={22} /> 5. Saques
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4">
                            Os saques são processados exclusivamente via PIX para a chave cadastrada. As regras aplicáveis são:
                        </p>
                        <ul className="list-disc list-inside text-zinc-400 text-xs sm:text-sm space-y-2 ml-2 sm:ml-4">
                            <li>Saques requerem autenticação de dois fatores (2FA) para segurança.</li>
                            <li>Membros com cotas ativas em valor igual ou superior ao saque estão isentos de taxa.</li>
                            <li>Caso contrário, aplica-se uma taxa de 2% (mínimo R$ 5,00) sobre o valor do saque.</li>
                            <li>85% da taxa de saque retorna ao caixa operacional e 15% vai para o pool de excedentes.</li>
                            <li>Saques estão sujeitos à disponibilidade de caixa e podem ser enfileirados.</li>
                        </ul>
                    </section>

                    {/* Seção 6 */}
                    <section className="space-y-4 sm:space-y-6">
                        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
                            <Gavel size={22} className="text-cyan-400" /> 6. Conduta e Penalidades
                        </h2>
                        <div className="bg-red-500/10 border border-red-500/20 p-4 sm:p-6 rounded-xl sm:rounded-2xl">
                            <h3 className="font-bold mb-2 text-red-400">Condutas Proibidas</h3>
                            <ul className="text-red-200 text-xs sm:text-sm space-y-1">
                                <li>• Utilizar a plataforma para lavagem de dinheiro ou atividades ilícitas.</li>
                                <li>• Criar múltiplas contas para obter vantagens indevidas.</li>
                                <li>• Tentar fraudar o sistema de score ou manipular transações.</li>
                                <li>• Fornecer dados falsos ou de terceiros sem autorização.</li>
                            </ul>
                        </div>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
                            A violação de qualquer regra pode resultar em suspensão ou exclusão permanente da cooperativa, sem direito a ressarcimento de valores aportados em cotas.
                        </p>
                    </section>

                    {/* Seção 7 - NOVO (Mercado Cred30) */}
                    <section className="bg-zinc-900/30 border border-white/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-[0_0_20px_rgba(34,211,238,0.05)]">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-3 text-cyan-400">
                            <ShoppingBag size={22} /> 7. Mercado Cred30 (P2P e Escrow)
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4">
                            O Mercado Cred30 é um ambiente de troca entre membros. A Cred30 atua EXCLUSIVAMENTE como custodiante dos fundos (Escrow) para garantir a segurança financeira da promessa de compra e venda:
                        </p>
                        <div className="space-y-4">
                            <div className="bg-cyan-500/5 border border-cyan-500/10 p-4 rounded-xl">
                                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-cyan-400" /> Sistema de Garantia
                                </h4>
                                <p className="text-xs text-zinc-400">Ao clicar em comprar, o saldo do comprador é retido pelo sistema. O valor só é liberado ao vendedor após a "Confirmação de Recebimento" pelo comprador.</p>
                            </div>
                            <div className="bg-zinc-800/50 p-4 rounded-xl">
                                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                    <Tag size={16} className="text-zinc-500" /> Taxa de Intermediação
                                </h4>
                                <p className="text-xs text-zinc-400">A Cred30 retém 5% do valor bruto da transação para cobrir custos de operação e garantia de rede.</p>
                            </div>
                            <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl">
                                <h4 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">
                                    <AlertTriangle size={16} /> Isenção de Responsabilidade do Objeto
                                </h4>
                                <p className="text-xs text-zinc-400">A Cred30 NÃO verifica a qualidade, procedência ou estado físico dos produtos anunciados. A responsabilidade pela entrega física é integralmente do vendedor. Em caso de não recebimento, o comprador deve abrir disputa antes de confirmar o recebimento.</p>
                            </div>
                        </div>
                    </section>

                    {/* Seção 8 */}
                    <section className="bg-zinc-900/30 border border-white/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-3 text-emerald-400">
                            <ClockIcon size={22} /> 8. Modificações e Foro
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4">
                            A Cred30 reserva-se o direito de modificar estes Termos a qualquer momento para garantir a sustentabilidade do grupo.
                        </p>
                        <div className="bg-zinc-800/30 p-4 rounded-xl border border-white/5 space-y-3 shadow-inner">
                            <p className="text-zinc-400 text-[10px] sm:text-xs leading-relaxed">
                                <strong>Natureza Jurídica (Blindagem):</strong> Este sistema opera estritamente sob as normas do Código Civil Brasileiro relativas à **Sociedade em Conta de Participação (SCP - Arts. 991 a 996)**, onde o gestor atua como sócio ostensivo e os membros como sócios participantes.
                            </p>
                            <p className="text-zinc-400 text-[10px] sm:text-xs leading-relaxed">
                                **Mútuo Coletivo:** As operações de apoio mútuo baseiam-se nos **Arts. 586 a 592 (Mútuo Civil)** operados em caráter privado entre os sócios. NÃO se caracteriza como atividade financeira pública, conta de pagamento aberta ou oferta pública de investimentos (CVM).
                            </p>
                            <p className="text-red-400/80 text-[9px] uppercase font-black tracking-tighter">
                                aviso: a plataforma não promete ganhos fáceis. o resultado depende da atividade comercial do grupo no mercado cred30 e publicidade.
                            </p>
                        </div>
                        <p className="text-zinc-400 text-[10px] sm:text-xs mt-4 italic">
                            Fica eleito o foro da comarca sede do gestor para dirimir controvérsias de natureza societária.
                        </p>
                    </section>
                </div>

                <footer className="mt-12 sm:mt-20 pt-8 sm:pt-10 border-t border-white/5 text-center">
                    <p className="text-zinc-500 text-xs sm:text-sm italic">
                        Ao utilizar o Cred30, você declara estar ciente e de acordo com todas as regras aqui estabelecidas.
                    </p>
                    <p className="text-zinc-600 text-xs mt-4">
                        Cred30 © 2024 - Todos os direitos reservados.
                    </p>
                </footer>
            </main >
        </div >
    );
};

export default TermsPage;
