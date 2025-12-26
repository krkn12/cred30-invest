import React from 'react';
import { ExternalLink, Info, Star, X } from 'lucide-react';

interface AdBannerProps {
    type: 'NATIVE' | 'BANNER' | 'TIP';
    title?: string;
    description?: string;
    actionText?: string;
    hide?: boolean; // Esconde anúncios para usuários PRO
}

export const AdBanner = ({ type, title, description, actionText, hide }: AdBannerProps) => {
    const [isVisible, setIsVisible] = React.useState(true);
    const SMART_LINK = 'https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa';

    const handleClick = () => {
        window.open(SMART_LINK, '_blank');
    };

    // Não renderiza se o usuário é PRO, se foi fechado ou se há flag global de desativação
    if (!isVisible || hide || (window as any).DISABLE_ALL_ADS) return null;

    if (type === 'NATIVE') {
        return (
            <div
                onClick={handleClick}
                className="bg-gradient-to-br from-primary-900/20 to-surface border border-primary-500/20 rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:border-primary-500/40 transition-all"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400 shrink-0">
                        <Star size={24} className="fill-primary-500/20" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="text-sm font-bold text-white group-hover:text-primary-400 transition-colors">
                                {title || 'Oferta de Parceiro'}
                            </h4>
                            <span className="text-[8px] bg-zinc-800 text-zinc-500 px-1 rounded border border-zinc-700">EXTERNO</span>
                        </div>
                        <p className="text-xs text-zinc-500 max-w-[200px]">
                            {description || 'Descubra como aumentar seus resultados hoje.'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <ExternalLink size={18} className="text-zinc-600 group-hover:text-primary-400 transition-colors" />
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
                        className="p-2 text-zinc-700 hover:text-white transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        );
    }

    if (type === 'BANNER') {
        return (
            <div
                onClick={handleClick}
                className="w-full bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-all group"
            >
                <div className="bg-primary-500/10 p-2 flex items-center justify-between border-b border-zinc-800">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-primary-400 tracking-widest uppercase">Parceiro</span>
                        <div className="w-1 h-1 bg-zinc-700 rounded-full"></div>
                        <span className="text-[9px] text-zinc-500 italic">Anúncio Externo</span>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
                        className="text-zinc-600 hover:text-white p-1"
                        title="Ocultar"
                    >
                        <X size={12} />
                    </button>
                </div>
                <div className="p-4">
                    <h4 className="text-sm font-bold text-white mb-1">{title || 'Oportunidades Parceiras'}</h4>
                    <p className="text-xs text-zinc-500 mb-3">{description || 'Explore benefícios de nossos parceiros.'}</p>
                    <button className="w-full py-2 bg-zinc-800 group-hover:bg-primary-500 group-hover:text-black rounded-lg text-xs font-bold transition-all">
                        {actionText || 'VER MAIS'}
                    </button>
                    <p className="text-[7px] text-zinc-700 mt-2 text-center uppercase tracking-tighter leading-none">
                        A Cred30 não garante e não se responsabiliza pelo conteúdo, ofertas ou segurança de links externos.
                    </p>
                </div>
            </div>
        );
    }

    // Default: TIP
    return (
        <div
            onClick={handleClick}
            className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors group relative"
        >
            <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-primary-400">
                <Info size={16} />
            </div>
            <div className="flex-1">
                <p className="text-[10px] text-zinc-500 leading-tight">
                    {description || 'Dica: Confira benefícios selecionados de parceiros.'}
                    <span className="ml-1 opacity-50 italic">(Parceiro Externo)</span>
                </p>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-white transition-all"
            >
                <X size={12} />
            </button>
            <ExternalLink size={12} className="text-zinc-700" />
        </div>
    );
};

