import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, MessageCircle, ShieldCheck, TrendingUp, DollarSign, Users } from 'lucide-react';

interface FaqItemProps {
    question: string;
    answer: string;
    icon: React.ReactNode;
}

const FaqItem: React.FC<FaqItemProps> = ({ question, answer, icon }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/30 mb-3 transition-all">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="text-primary-400 p-2 bg-primary-400/10 rounded-lg">
                        {icon}
                    </div>
                    <span className="font-bold text-sm text-white">{question}</span>
                </div>
                {isOpen ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
            </button>
            {isOpen && (
                <div className="p-4 pt-0 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {answer}
                </div>
            )}
        </div>
    );
};

export const FaqView: React.FC = () => {
    const faqs = [
        {
            icon: <ShieldCheck size={18} />,
            question: "O Cred30 é um banco?",
            answer: "Não. O Cred30 é uma plataforma tecnológica que facilita a gestão de um Clube de Benefícios operando sob Sociedade em Conta de Participação (SCP) e contratos de Mútuo Civil entre membros, conforme os Artigos 991 a 996 do Código Civil Brasileiro. Não somos uma instituição financeira regulada pelo BACEN."
        },
        {
            icon: <TrendingUp size={18} />,
            question: "Como funcionam as cotas de R$ 50,00?",
            answer: "Ao adquirir uma participação (licença), você aporta R$ 42,00 no Capital Social (valor que gera bônus e é resgatável) e R$ 8,00 em uma Taxa Administrativa única para manutenção e tecnologia da plataforma. Esse modelo garante a sustentabilidade do clube a longo prazo."
        },
        {
            icon: <DollarSign size={18} />,
            question: "Quando posso sacar meu dinheiro?",
            answer: "Os bônus de participação podem ser sacados assim que atingirem o valor mínimo. Já o Capital Social das participações possui um período de carência (vesting) para garantir a estabilidade do fundo comum. Consulte a aba 'Carteira' para ver seus prazos de resgate."
        },
        {
            icon: <Users size={18} />,
            question: "O que acontece se eu não pagar um apoio?",
            answer: "Como todos os apoios mútuos são baseados em lastros reais, caso haja atraso superior a 5 dias, o sistema executa automaticamente o lastro (suas participações ativas) para recompor o fundo comum. Seu score também será reduzido para zero."
        },
        {
            icon: <MessageCircle size={18} />,
            question: "Como funciona o bônus de indicação?",
            answer: "Você ganha uma participação sobre cada nova licença adquirida por membros que entrarem com seu código de convite. Esse valor cai direto no seu saldo disponível para saque ou reinvestimento."
        }
    ];

    return (
        <div className="animate-in fade-in slide-in-from-bottom duration-500">
            <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-primary-400/10 rounded-full flex items-center justify-center text-primary-400 mb-4 shadow-xl shadow-primary-900/20">
                    <HelpCircle size={32} />
                </div>
                <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Central de Ajuda</h1>
                <p className="text-zinc-500 text-xs max-w-xs">Tire suas dúvidas sobre o funcionamento do clube e as regras de participação.</p>
            </div>

            <div className="max-w-2xl mx-auto">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 ml-2">Perguntas Frequentes</h2>
                {faqs.map((faq, index) => (
                    <FaqItem key={index} {...faq} />
                ))}

                <div className="mt-8 p-6 bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl text-center">
                    <h3 className="text-white font-bold mb-2">Ainda tem dúvidas?</h3>
                    <p className="text-xs text-zinc-500 mb-6">Nosso atendimento inteligente está disponível 24h para ajudar você diretamente pelo chat.</p>
                    <button
                        onClick={() => window.alert("Clique no ícone do 'Edy' no canto da tela para falar com nosso suporte direto!")}
                        className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 px-8 rounded-2xl transition-all flex items-center justify-center gap-3 text-sm shadow-xl shadow-primary-900/20"
                    >
                        <MessageCircle size={20} />
                        Abrir Chat de Suporte
                    </button>
                </div>
            </div>
        </div>
    );
};
