import React, { useState, useRef, useEffect } from 'react';
import { ScrollText, CheckCircle2, X } from 'lucide-react';

interface TermsAcceptanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
}

export const TermsAcceptanceModal: React.FC<TermsAcceptanceModalProps> = ({ isOpen, onClose, onAccept }) => {
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            // Usar margem de erro de 10px para dispositivos móveis
            if (scrollHeight - scrollTop - clientHeight < 10) {
                setHasScrolledToBottom(true);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300 backdrop-blur-md">
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] flex flex-col relative overflow-hidden shadow-[0_0_50px_rgba(34,211,238,0.1)]">
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-500 border border-primary-500/20">
                            <ScrollText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Termos de Uso</h2>
                            <p className="text-zinc-500 text-xs md:text-sm">Leia até o fim para aceitar</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white p-2">
                        <X size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar scroll-smooth"
                >
                    <section className="space-y-4">
                        <h3 className="text-lg md:text-xl font-bold text-primary-400 flex items-center gap-2">
                            1. Natureza da Cooperativa
                        </h3>
                        <p className="text-zinc-400 leading-relaxed text-sm md:text-base">
                            O Cred30 é um sistema de cooperação financeira mútua. Ao se cadastrar, você não está apenas abrindo uma conta, mas tornando-se um membro participante de uma comunidade de crédito cooperativo. A participação é voluntária e baseada na confiança mútua.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-lg md:text-xl font-bold text-primary-400 flex items-center gap-2">
                            2. Regras de Investimento (Cotas)
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800">
                                <h4 className="font-bold text-white mb-2 text-sm md:text-base">Valor da Cota</h4>
                                <p className="text-zinc-500 text-xs md:text-sm leading-relaxed">Cada cota possui o valor nominal fixado em R$ 50,00, podendo ser reajustado conforme deliberação do sistema.</p>
                            </div>
                            <div className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800">
                                <h4 className="font-bold text-white mb-2 text-sm md:text-base">Distribuição</h4>
                                <p className="text-zinc-500 text-xs md:text-sm leading-relaxed">85% do lucro gerado é distribuído proporcionalmente entre os detentores de cotas ativas.</p>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-lg md:text-xl font-bold text-primary-400 flex items-center gap-2">
                            3. Empréstimos e Garantia Real
                        </h3>
                        <p className="text-zinc-400 leading-relaxed text-sm md:text-base">
                            Os membros podem solicitar crédito baseado em seu patrimônio. <strong className="text-white">As cotas ativas servem como garantia real para os empréstimos.</strong>
                        </p>
                        <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl flex items-start gap-4">
                            <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center text-red-400 text-xs font-bold mt-1 shrink-0">!</div>
                            <p className="text-zinc-500 text-xs md:text-sm leading-relaxed">
                                Em caso de atraso superior a 5 dias, o sistema reserva-se o direito de <strong className="text-red-400">LIQUIDAR AUTOMATICAMENTE</strong> as cotas do devedor para quitar o saldo devedor, sem necessidade de aviso prévio.
                            </p>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-lg md:text-xl font-bold text-primary-400 flex items-center gap-2">
                            4. Juros e Penalidades
                        </h3>
                        <div className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800">
                            <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
                                • Juros fixos de 20% por operação.<br />
                                • Multa de mora diária de <strong className="text-white">0.5% ao dia</strong> sobre o valor em atraso.<br />
                                • Perda imediata de Score e exclusão de benefícios VIP em caso de inadimplência.
                            </p>
                        </div>
                    </section>

                    <div className="pt-10 border-t border-zinc-900 text-center">
                        <p className="text-zinc-500 text-sm italic">
                            Fim dos termos. Role até o fim para habilitar o botão de aceite.
                        </p>
                    </div>
                </div>

                {/* Footer / Action */}
                <div className="p-6 md:p-8 border-t border-zinc-800 bg-zinc-950 flex flex-col gap-4">
                    {!hasScrolledToBottom && (
                        <p className="text-amber-500 text-xs font-medium flex items-center gap-2 justify-center mb-2 animate-pulse">
                            <ScrollText size={14} /> Você deve ler até o final para aceitar
                        </p>
                    )}

                    <button
                        onClick={onAccept}
                        disabled={!hasScrolledToBottom}
                        className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 text-base md:text-lg shadow-2-xl ${hasScrolledToBottom
                            ? 'bg-primary-500 hover:bg-primary-400 text-black shadow-primary-500/20'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                            }`}
                    >
                        {hasScrolledToBottom ? <CheckCircle2 size={24} /> : <div className="w-6 h-6 border-2 border-zinc-600 rounded-full" />}
                        Eu li e aceito os Termos de Uso
                    </button>
                </div>
            </div>
        </div>
    );
};
