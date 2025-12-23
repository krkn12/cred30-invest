import React from 'react';
import { ShieldCheck, Scale, AlertTriangle } from 'lucide-react';
import { DISCLAIMERS } from '../../../shared/constants/legal.constants';

interface LegalFooterProps {
    variant?: 'minimal' | 'full';
    showDisclaimer?: boolean;
}

/**
 * Rodapé Legal obrigatório em todas as páginas do sistema.
 * Garante transparência sobre a natureza jurídica da plataforma.
 */
export const LegalFooter: React.FC<LegalFooterProps> = ({
    variant = 'minimal',
    showDisclaimer = false
}) => {
    if (variant === 'minimal') {
        return (
            <footer className="w-full py-6 px-4 border-t border-zinc-900 mt-auto">
                <div className="max-w-4xl mx-auto text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-zinc-600 text-[10px]">
                        <ShieldCheck size={12} className="text-zinc-700" />
                        <span>SCP - Art. 991 CC</span>
                        <span className="text-zinc-800">•</span>
                        <span>NÃO somos banco</span>
                        <span className="text-zinc-800">•</span>
                        <span>NÃO somos fintech regulada</span>
                    </div>
                    <p className="text-zinc-700 text-[9px]">
                        © {new Date().getFullYear()} Cred30 - Clube de Benefícios Privado e Apoio Mútuo
                    </p>
                </div>
            </footer>
        );
    }

    return (
        <footer className="w-full py-8 px-4 bg-zinc-950 border-t border-zinc-900 mt-auto">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Disclaimer Principal */}
                {showDisclaimer && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-zinc-400 text-[10px] leading-relaxed">
                            {DISCLAIMERS.NOT_A_BANK}
                        </p>
                    </div>
                )}

                {/* Badges de Conformidade */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <Scale size={12} className="text-emerald-500" />
                        <span className="text-[9px] text-zinc-400 font-medium">SCP Art. 991 CC</span>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <ShieldCheck size={12} className="text-purple-500" />
                        <span className="text-[9px] text-zinc-400 font-medium">LGPD 13.709/18</span>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
                        <span className="text-[9px] text-zinc-500">Mútuo Civil Art. 586 CC</span>
                    </div>
                </div>

                {/* Texto Legal */}
                <div className="text-center space-y-2">
                    <p className="text-zinc-500 text-[10px] max-w-2xl mx-auto leading-relaxed">
                        A Cred30 é um clube privado de benefícios operando sob Sociedade em Conta de Participação.
                        NÃO realiza operações privativas de instituições financeiras.
                        Os apoios mútuos são contratos civis entre membros, sem garantia de fundo garantidor.
                    </p>
                    <p className="text-zinc-600 text-[9px]">
                        © {new Date().getFullYear()} Cred30 - Todos os direitos reservados
                    </p>
                    <div className="flex justify-center gap-4 text-[9px] text-zinc-600">
                        <a href="/terms" className="hover:text-zinc-400 transition-colors">Termos</a>
                        <a href="/privacy" className="hover:text-zinc-400 transition-colors">Privacidade</a>
                        <a href="/security" className="hover:text-zinc-400 transition-colors">Segurança</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default LegalFooter;
