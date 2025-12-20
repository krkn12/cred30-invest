import React from 'react';
import { ExternalLink, Info } from 'lucide-react';

interface AdBannerProps {
    type: 'NATIVE' | 'BANNER' | 'TIP';
    title?: string;
    description?: string;
    actionText?: string;
}

export const AdBanner = ({ type, title, description, actionText }: AdBannerProps) => {
    const [isVisible, setIsVisible] = React.useState(true);
    const SMART_LINK = 'https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa';

    const handleClick = () => {
        window.open(SMART_LINK, '_blank');
    };

    if (!isVisible) return null;

    if (type === 'NATIVE') {
        return (
            <div
                onClick={handleClick}
                className="bg-gradient-to-br from-primary-900/20 to-surface border border-primary-500/20 rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:border-primary-500/40 transition-all"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400">
                        <Star size={24} className="fill-primary-500/20" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-primary-400 transition-colors">
                            {title || 'Oferta Exclusiva Cred30'}
                        </h4>
                        <p className="text-xs text-zinc-500 max-w-[200px]">
                            {description || 'Descubra como aumentar seus rendimentos hoje.'}
                        </p>
                    </div>
                </div>
                <ExternalLink size={18} className="text-zinc-600 group-hover:text-primary-400 transition-colors" />
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
                    <h4 className="text-sm font-bold text-white mb-1">{title || 'Cartão com Limite Imediato'}</h4>
                    <p className="text-xs text-zinc-500 mb-3">{description || 'Aproveite as melhores taxas do mercado parceiro.'}</p>
                    <button className="w-full py-2 bg-zinc-800 group-hover:bg-primary-500 group-hover:text-black rounded-lg text-xs font-bold transition-all">
                        {actionText || 'SAIBA MAIS'}
                    </button>
                    <p className="text-[8px] text-zinc-700 mt-2 text-center uppercase tracking-tighter">O conteúdo acima é de responsabilidade do anunciante</p>
                </div>
            </div>
        );
    }

    // Default: TIP
    return (
        <div
            onClick={handleClick}
            className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors group"
        >
            <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-primary-400">
                <Info size={16} />
            </div>
            <div className="flex-1">
                <p className="text-[10px] text-zinc-500 leading-tight">
                    {description || 'Dica: Conheça os cartões parceiros com aprovação facilitada.'}
                </p>
            </div>
            <ExternalLink size={12} className="text-zinc-700" />
        </div>
    );
};

import { Star, X } from 'lucide-react';
