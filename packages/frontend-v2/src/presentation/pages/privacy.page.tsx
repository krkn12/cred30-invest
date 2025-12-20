import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, EyeOff, ShieldCheck, Database, Fingerprint, Trash2, FileCheck, Globe, AlertTriangle } from 'lucide-react';

const PrivacyPage = () => {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-zinc-950 text-white selection:bg-purple-500/30">
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
                    <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-purple-400 text-xs sm:text-sm font-bold mb-4 sm:mb-6">
                        <Lock size={14} /> Conforme LGPD
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-3 sm:mb-4 tracking-tight">Política de Privacidade</h1>
                    <p className="text-zinc-400 text-sm sm:text-lg">Última atualização: 20 de Dezembro de 2024</p>
                </div>

                <div className="space-y-8 sm:space-y-12">
                    {/* Introdução */}
                    <section className="bg-purple-500/5 border border-purple-500/20 p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
                            Esta Política de Privacidade descreve como a Cred30 coleta, usa, armazena e protege suas informações pessoais, em conformidade com a <strong className="text-purple-400">Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>.
                        </p>
                    </section>

                    {/* Seção 1 */}
                    <section className="bg-zinc-900/30 border border-white/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-3 text-purple-400">
                            <EyeOff size={22} /> 1. Dados Coletados
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4">
                            Coletamos apenas os dados estritamente necessários para o funcionamento da plataforma e a segurança da sua conta:
                        </p>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="bg-zinc-800/50 p-4 rounded-xl">
                                <h3 className="font-bold text-white text-sm mb-2">Dados de Cadastro</h3>
                                <ul className="text-zinc-400 text-xs space-y-1">
                                    <li>• Nome completo</li>
                                    <li>• Endereço de e-mail</li>
                                    <li>• Chave PIX</li>
                                    <li>• Senha (criptografada)</li>
                                    <li>• Frase secreta (criptografada)</li>
                                </ul>
                            </div>
                            <div className="bg-zinc-800/50 p-4 rounded-xl">
                                <h3 className="font-bold text-white text-sm mb-2">Dados de Uso</h3>
                                <ul className="text-zinc-400 text-xs space-y-1">
                                    <li>• Histórico de transações</li>
                                    <li>• Score de crédito interno</li>
                                    <li>• Logs de acesso (IP, data/hora)</li>
                                    <li>• Preferências de configuração</li>
                                </ul>
                            </div>
                        </div>
                        <div className="mt-4 bg-green-500/10 border border-green-500/20 p-3 rounded-xl">
                            <p className="text-green-300 text-xs sm:text-sm">
                                <strong>✓ Não coletamos:</strong> Contatos, localização, galeria de fotos, biometria ou dados sensíveis.
                            </p>
                        </div>
                    </section>

                    {/* Seção 2 */}
                    <section className="space-y-4 sm:space-y-6">
                        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
                            <Database size={22} className="text-purple-400" /> 2. Armazenamento e Segurança
                        </h2>
                        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                            <div className="bg-zinc-900/50 p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2 text-white">Criptografia</h3>
                                <p className="text-zinc-400 text-xs sm:text-sm">Senhas e frases secretas são armazenadas utilizando bcrypt, um algoritmo de hashing irreversível considerado padrão de mercado.</p>
                            </div>
                            <div className="bg-zinc-900/50 p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2 text-white">HTTPS/TLS</h3>
                                <p className="text-zinc-400 text-xs sm:text-sm">Toda comunicação entre seu dispositivo e nossos servidores é criptografada via protocolo TLS 1.3.</p>
                            </div>
                            <div className="bg-zinc-900/50 p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2 text-white">Autenticação 2FA</h3>
                                <p className="text-zinc-400 text-xs sm:text-sm">Operações sensíveis (saques, alteração de dados) exigem autenticação de dois fatores via app autenticador (TOTP).</p>
                            </div>
                            <div className="bg-zinc-900/50 p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5">
                                <h3 className="font-bold mb-2 text-white">Backups</h3>
                                <p className="text-zinc-400 text-xs sm:text-sm">Backups diários automáticos garantem a integridade dos dados em caso de falhas técnicas.</p>
                            </div>
                        </div>
                    </section>

                    {/* Seção 3 */}
                    <section className="bg-zinc-900/30 border border-white/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-3 text-purple-400">
                            <Globe size={22} /> 3. Compartilhamento de Dados
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4">
                            A Cred30 <strong className="text-white">NÃO vende, aluga ou compartilha</strong> seus dados pessoais com terceiros para fins de marketing. O compartilhamento ocorre apenas nos seguintes casos:
                        </p>
                        <ul className="text-zinc-400 text-xs sm:text-sm space-y-2 ml-2">
                            <li><strong className="text-white">• Gateway de Pagamento:</strong> Dados necessários para processar pagamentos são transmitidos ao Mercado Pago de forma segura.</li>
                            <li><strong className="text-white">• Parceiros de Publicidade:</strong> Informações técnicas não identificáveis (como IP e tipo de dispositivo) podem ser compartilhadas com parceiros de mídia (ex: Adsterra) para exibição de anúncios.</li>
                            <li><strong className="text-white">• Obrigação Legal:</strong> Mediante ordem judicial ou requisição de autoridades competentes.</li>
                            <li><strong className="text-white">• Proteção:</strong> Para investigar fraudes ou proteger a integridade do sistema.</li>
                        </ul>
                    </section>

                    {/* Seção 4 */}
                    <section className="bg-zinc-900/30 border border-white/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-3 text-purple-400">
                            <Fingerprint size={22} /> 4. Score de Crédito
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4">
                            O score é uma pontuação interna baseada no seu comportamento na plataforma. Ele é <strong className="text-white">privado</strong> e utilizado exclusivamente para:
                        </p>
                        <ul className="list-disc list-inside text-zinc-400 text-xs sm:text-sm space-y-2 ml-2 sm:ml-4">
                            <li>Calcular seu limite de crédito disponível para empréstimos.</li>
                            <li>Definir elegibilidade para distribuição de dividendos.</li>
                            <li>Identificar e prevenir atividades fraudulentas.</li>
                        </ul>
                        <div className="mt-4 bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
                            <p className="text-blue-300 text-xs sm:text-sm">
                                Seu score não é compartilhado com bureaus de crédito externos (SPC, Serasa, etc.).
                            </p>
                        </div>
                    </section>

                    {/* Seção 5 */}
                    <section className="space-y-4 sm:space-y-6">
                        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
                            <ShieldCheck size={22} className="text-purple-400" /> 5. Seus Direitos (LGPD)
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
                            Conforme a Lei Geral de Proteção de Dados, você tem os seguintes direitos:
                        </p>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="bg-zinc-800/50 p-4 rounded-xl border-l-4 border-purple-500">
                                <h3 className="font-bold text-white text-sm mb-1">Acesso</h3>
                                <p className="text-zinc-400 text-xs">Solicitar uma cópia de todos os seus dados armazenados.</p>
                            </div>
                            <div className="bg-zinc-800/50 p-4 rounded-xl border-l-4 border-purple-500">
                                <h3 className="font-bold text-white text-sm mb-1">Correção</h3>
                                <p className="text-zinc-400 text-xs">Atualizar ou corrigir dados incorretos ou incompletos.</p>
                            </div>
                            <div className="bg-zinc-800/50 p-4 rounded-xl border-l-4 border-purple-500">
                                <h3 className="font-bold text-white text-sm mb-1">Exclusão</h3>
                                <p className="text-zinc-400 text-xs">Solicitar a exclusão definitiva de todos os seus dados.</p>
                            </div>
                            <div className="bg-zinc-800/50 p-4 rounded-xl border-l-4 border-purple-500">
                                <h3 className="font-bold text-white text-sm mb-1">Portabilidade</h3>
                                <p className="text-zinc-400 text-xs">Receber seus dados em formato estruturado.</p>
                            </div>
                        </div>
                    </section>

                    {/* Seção 6 */}
                    <section className="bg-zinc-900/30 border border-white/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-3 text-purple-400">
                            <Trash2 size={22} /> 6. Exclusão de Conta
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4">
                            Você pode solicitar a exclusão definitiva da sua conta e de todos os dados associados a qualquer momento através das <strong className="text-white">Configurações</strong> do seu perfil.
                        </p>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-yellow-400 shrink-0 mt-0.5" size={20} />
                                <p className="text-yellow-200 text-xs sm:text-sm">
                                    <strong>Atenção:</strong> A exclusão é irreversível. Cotas ativas, saldo em conta e histórico serão permanentemente apagados.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Seção 7 */}
                    <section className="bg-zinc-900/30 border border-white/5 p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center gap-3 text-purple-400">
                            <FileCheck size={22} /> 7. Cookies e Publicidade
                        </h2>
                        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4">
                            A Cred30 utiliza cookies essenciais para o funcionamento do sistema e cookies de terceiros para fins de publicidade:
                        </p>
                        <ul className="text-zinc-400 text-xs sm:text-sm space-y-2 ml-2">
                            <li><strong className="text-white">• Cookies Essenciais:</strong> Necessários para manter sua sessão ativa e segura.</li>
                            <li><strong className="text-white">• Cookies de Terceiros:</strong> Nossos parceiros de publicidade (ex: Adsterra) podem utilizar cookies e tecnologias similares para coletar informações técnicas e exibir anúncios relevantes.</li>
                        </ul>
                        <p className="text-zinc-500 text-[10px] mt-4 italic">Você pode gerenciar ou desabilitar cookies diretamente nas configurações do seu navegador.</p>
                    </section>
                </div>

                <footer className="mt-12 sm:mt-20 pt-8 sm:pt-10 border-t border-white/5 text-center">
                    <p className="text-zinc-500 text-xs sm:text-sm">
                        Dúvidas sobre seus dados? Entre em contato com nossa equipe de suporte.
                    </p>
                    <p className="text-zinc-600 text-xs mt-4">
                        Cred30 © 2024 - Todos os direitos reservados.
                    </p>
                </footer>
            </main>
        </div>
    );
};

export default PrivacyPage;
