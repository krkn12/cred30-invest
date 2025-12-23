import React, { useState, useEffect } from 'react';
import {
    Search, Tag, ShoppingBag, PlusCircle, ImageIcon, Zap, Sparkles,
    ChevronRight, ArrowLeft, ShieldCheck, Heart, Share2, MessageCircle,
    Truck, Clock, CheckCircle2, History, Package, RefreshCw, Wand2, X as XIcon
} from 'lucide-react';
import { AppState } from '../../../domain/types/common.types';
import { apiService } from '../../../application/services/api.service';
import { ConfirmModal } from '../ui/ConfirmModal';

interface MarketplaceViewProps {
    state: AppState;
    onRefresh: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

// Componentes internos para anúncios
const AdBanner = ({ type, title, description, actionText }: any) => (
    <div className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] cursor-pointer ${type === 'BANNER'
        ? 'bg-gradient-to-br from-primary-600/20 to-purple-600/10 border-primary-500/20 shadow-lg shadow-primary-500/5'
        : 'bg-zinc-900/50 border-zinc-800'
        }`}>
        <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-black bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700 uppercase tracking-widest">Patrocinado</span>
            <Sparkles size={12} className="text-primary-400" />
        </div>
        {title && <h4 className="text-xs font-black text-white mb-1 uppercase tracking-tight">{title}</h4>}
        <p className="text-[10px] text-zinc-400 leading-tight mb-3">{description}</p>
        {actionText && (
            <button className="w-full py-2 bg-primary-500 hover:bg-primary-400 text-black text-[9px] font-black rounded-lg transition-all uppercase tracking-widest shadow-lg shadow-primary-500/20">
                {actionText}
            </button>
        )}
    </div>
);

const NativeAdCard = ({ title, price, category, img }: any) => (
    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl overflow-hidden group hover:border-amber-500/30 transition-all flex flex-col relative">
        <div className="absolute top-2 left-2 z-10">
            <span className="text-[8px] font-black bg-amber-500 text-black px-1.5 py-0.5 rounded shadow-lg uppercase">OFERTA PARCEIRA</span>
        </div>
        <div className="aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden">
            <img src={img} alt={title} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" />
        </div>
        <div className="p-4 flex-1 flex flex-col">
            <h3 className="font-bold text-white text-sm line-clamp-1 mb-1 uppercase tracking-tight">{title}</h3>
            <p className="text-[10px] text-zinc-500 mb-4 uppercase font-bold tracking-widest">{category}</p>
            <div className="mt-auto flex items-center justify-between">
                <span className="text-sm font-black text-amber-400">{price}</span>
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg group-hover:bg-amber-500 group-hover:text-black transition-all">
                    <ChevronRight size={14} />
                </div>
            </div>
        </div>
    </div>
);

export const MarketplaceView = ({ state, onRefresh, onSuccess, onError }: MarketplaceViewProps) => {
    const [view, setView] = useState<'browse' | 'create' | 'my-orders' | 'details' | 'offline-sync' | 'missions'>('browse');
    const [listings, setListings] = useState<any[]>([]);
    const [myOrders, setMyOrders] = useState<any[]>([]);
    const [missions, setMissions] = useState<any[]>([]);
    const [deliveryOption, setDeliveryOption] = useState<'SELF_PICKUP' | 'COURIER_REQUEST'>('SELF_PICKUP');
    const [offeredFee, setOfferedFee] = useState<string>('5.00');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('TODOS');
    const [confirmData, setConfirmData] = useState<any>(null);
    const [offlineVoucher, setOfflineVoucher] = useState<{ code: string, amount: number, item: string } | null>(null);
    const [redeemCode, setRedeemCode] = useState('');

    const [newListing, setNewListing] = useState({
        title: '',
        description: '',
        price: '',
        category: 'ELETRÔNICOS',
        image_url: ''
    });

    const categories = ['ELETRÔNICOS', 'VEÍCULOS', 'IMÓVEIS', 'SERVIÇOS', 'MODA', 'OUTROS'];
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, [view]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            if (view === 'browse') {
                const response = await apiService.get<any>('/marketplace/listings');
                if (response.success) {
                    const data = response.data;
                    setListings(Array.isArray(data) ? data : (data?.listings || []));
                }
            } else if (view === 'my-orders') {
                const response = await apiService.get<any>('/marketplace/my-orders');
                if (response.success) {
                    const data = response.data;
                    setMyOrders(Array.isArray(data) ? data : (data?.orders || []));
                }
            } else if (view === 'missions') {
                const response = await apiService.get<any>('/marketplace/logistic/missions');
                if (response.success) {
                    setMissions(response.data);
                }
            }
        } catch (error) {
            console.error('Erro ao buscar dados do marketplace:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateListing = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await apiService.post<any>('/marketplace/listings', {
                ...newListing,
                price: parseFloat(newListing.price)
            });
            if (response.success) {
                onSuccess('Sucesso', 'Anúncio publicado!');
                setView('browse');
                setNewListing({ title: '', description: '', price: '', category: 'ELETRÔNICOS', image_url: '' });
            }
        } catch (error: any) {
            onError('Erro', error.message || 'Falha ao publicar anúncio');
        }
    };

    const handleAIAssist = async () => {
        if (!newListing.title) return;
        setAiLoading(true);
        try {
            const response = await apiService.post<any>('/marketplace/ai-assist', { title: newListing.title });
            if (response.success) {
                setNewListing(prev => ({
                    ...prev,
                    description: response.data.description,
                    category: response.data.category || prev.category
                }));
                onSuccess('IA Ativa', 'Descrição e categoria sugeridas com sucesso!');
            }
        } catch (error) {
            console.error('Erro no assistente IA:', error);
        } finally {
            setAiLoading(false);
        }
    };

    const handleBoostListing = async (id: number) => {
        try {
            const response = await apiService.post<any>(`/marketplace/listings/${id}/boost`, {});
            if (response.success) {
                onSuccess('Impulsionado!', 'Seu anúncio terá prioridade nas buscas por 24h.');
                fetchData();
            }
        } catch (error: any) {
            onError('Erro', error.message);
        }
    };

    const generateOfflineVoucher = (item: any) => {
        // Criar um código baseado no tempo e IDs (apenas para exibição, a segurança real é no sync posterior)
        const code = `CR30-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${item.id}`;
        setOfflineVoucher({ code, amount: item.price, item: item.title });

        // Registrar no sync service que esta compra foi iniciada offline
        import('../../../application/services/sync.service').then(({ syncService }) => {
            syncService.enqueue('BUY_MARKETPLACE', {
                listingId: item.id,
                offlineToken: code
            });
        });

        onSuccess('Voucher Gerado', 'Mostre este código ao vendedor para confirmar a compra offline.');
    };

    const handleRedeemOfflineCode = async () => {
        if (!redeemCode) return;

        // O vendedor registra o código recebido do comprador.
        // Como ambos estão offline, isso fica na fila de sincronização do vendedor.
        import('../../../application/services/sync.service').then(({ syncService }) => {
            syncService.enqueue('RELEASE_ESCROW', {
                verificationCode: redeemCode,
                note: 'Resgate via modo offline (Interior)'
            });
        });

        onSuccess('Código Registrado', 'O resgate foi agendado. O saldo cairá assim que você detectar internet.');
        setRedeemCode('');
        setView('browse');
    };

    const formatCurrency = (val: number) => {
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header / Barra de Ação */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center border border-primary-500/20">
                        <ShoppingBag className="text-primary-400" size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Mercado Cred30</h2>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Compre e venda com segurança</p>
                    </div>
                </div>

                {view === 'browse' && (
                    <button
                        onClick={() => setView('create')}
                        className="bg-primary-500 hover:bg-primary-400 text-black px-4 py-2.5 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-2 shadow-lg shadow-primary-500/20"
                    >
                        <PlusCircle size={16} /> ANUNCIAR
                    </button>
                )}
            </div>

            {/* View Tabs */}
            <div className="flex gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                <button
                    onClick={() => setView('browse')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${view === 'browse' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                    Explorar
                </button>
                <button
                    onClick={() => setView('my-orders')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${view === 'my-orders' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                    Meus Pedidos
                </button>
                <button
                    onClick={() => setView('missions')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${view === 'missions' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                    <div className="flex items-center justify-center gap-1">
                        <Truck size={10} className={view === 'missions' ? 'text-primary-400' : 'text-zinc-500'} />
                        Missões
                    </div>
                </button>
                <button
                    onClick={() => setView('offline-sync')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${view === 'offline-sync' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                    <div className="flex items-center justify-center gap-1">
                        <Zap size={10} className={view === 'offline-sync' ? 'text-primary-400' : 'text-zinc-500'} />
                        Modo Interior
                    </div>
                </button>
            </div>

            {/* Protective Escrow Banner */}
            {view === 'browse' && (
                <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-4">
                    <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-emerald-400">Compra Garantida Cred30</h4>
                        <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                            Seu dinheiro fica protegido conosco. Só liberamos o valor ao vendedor quando você confirmar que recebeu tudo ok.
                        </p>
                    </div>
                </div>
            )}

            {/* Search and Filters */}
            {view === 'browse' && (
                <div className="space-y-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary-400 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="O que você está procurando hoje?"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl pl-12 pr-12 py-4 text-sm text-white focus:outline-none focus:border-primary-500/50 transition-all shadow-xl"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                            >
                                <XIcon size={18} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                        {['TODOS', ...categories].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`
                                    px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border
                                    ${selectedCategory === cat
                                        ? 'bg-primary-500 text-black border-primary-500 shadow-lg shadow-primary-500/20'
                                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'}
                                `}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Rendering */}
            {view === 'browse' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-300">
                    {(() => {
                        const filtered = listings.filter(item => {
                            const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                item.description.toLowerCase().includes(searchQuery.toLowerCase());
                            const matchesCategory = selectedCategory === 'TODOS' || item.category === selectedCategory;
                            return matchesSearch && matchesCategory;
                        });

                        if (filtered.length === 0 && (searchQuery || selectedCategory !== 'TODOS')) {
                            return (
                                <div className="col-span-full py-20 text-center animate-in fade-in zoom-in duration-300">
                                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                                        <Search size={32} className="text-zinc-700" />
                                    </div>
                                    <h3 className="text-white font-bold mb-1">Nenhum resultado encontrado</h3>
                                    <p className="text-zinc-500 text-xs">Tente ajustar sua busca ou filtro para encontrar o que precisa.</p>
                                    <button
                                        onClick={() => { setSearchQuery(''); setSelectedCategory('TODOS'); }}
                                        className="mt-6 text-primary-400 text-[10px] font-black uppercase tracking-widest hover:underline"
                                    >
                                        Limpar todos os filtros
                                    </button>
                                </div>
                            );
                        }

                        if (filtered.length === 0) {
                            return (
                                <div className="col-span-full py-12 text-center">
                                    <Tag size={48} className="text-zinc-800 mx-auto mb-4" />
                                    <p className="text-zinc-500 text-sm">Nenhum item anunciado no momento.</p>
                                    <button onClick={() => setView('create')} className="text-primary-400 text-xs font-bold mt-2">Clique aqui para ser o primeiro!</button>
                                </div>
                            );
                        }

                        return (
                            <>
                                {/* Inserir Anúncio Adsterra no topo */}
                                <div className="col-span-1">
                                    <AdBanner
                                        type="BANNER"
                                        title="Ganhe + R$ 500 no Saldo"
                                        description="Confira como liberar bônus de parceiros assistindo vídeos."
                                        actionText="LIBERAR AGORA"
                                    />
                                </div>

                                {filtered.map((item, index) => (
                                    <React.Fragment key={item.id}>
                                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-primary-500/30 transition-all flex flex-col">
                                            <div className="aspect-square bg-zinc-950 flex items-center justify-center relative">
                                                {item.image_url ? (
                                                    <img
                                                        src={item.image_url.includes('cloudinary') ? item.image_url.replace('/upload/', '/upload/w_600,c_fill,g_auto,q_auto,f_auto/') : item.image_url}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon size={40} className="text-zinc-800" />
                                                )}
                                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] text-zinc-300 font-bold uppercase">
                                                    {item.category}
                                                </div>
                                            </div>
                                            <div className="p-4 flex-1 flex flex-col">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h3 className="font-bold text-white text-base line-clamp-1">{item.title}</h3>
                                                    {item.type === 'AFFILIATE' ? (
                                                        <div className="bg-amber-500/20 text-amber-400 text-[8px] px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1 font-black">
                                                            <Sparkles size={8} /> PARCEIRO
                                                        </div>
                                                    ) : item.is_boosted && (
                                                        <div className="bg-primary-500/10 text-primary-400 text-[8px] px-1.5 py-0.5 rounded border border-primary-500/20 flex items-center gap-1 font-black">
                                                            <Zap size={8} /> DESTAQUE
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-zinc-500 mb-4 line-clamp-2 h-8">{item.description}</p>

                                                <div className="mt-auto pt-4 border-t border-zinc-800 flex flex-col gap-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-lg font-black text-primary-400">
                                                            {item.price > 0 ? formatCurrency(parseFloat(item.price)) : 'Ver Preço'}
                                                        </span>
                                                        {item.seller_id === state.currentUser?.id ? (
                                                            <button
                                                                onClick={() => handleBoostListing(item.id)}
                                                                disabled={item.is_boosted}
                                                                className={`text-[9px] font-black px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${item.is_boosted ? 'bg-zinc-800 text-zinc-500' : 'bg-primary-500/10 text-primary-400 hover:bg-primary-500 hover:text-black'}`}
                                                            >
                                                                <Zap size={10} /> {item.is_boosted ? 'IMPULSIONADO' : 'IMPULSIONAR'}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedItem(item);
                                                                    setView('details');
                                                                }}
                                                                className={`${item.type === 'AFFILIATE' ? 'bg-amber-500 hover:bg-amber-400 transition-all active:scale-95' : 'bg-primary-600 hover:bg-primary-500 transition-all active:scale-95'} text-black px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2`}
                                                            >
                                                                {item.type === 'AFFILIATE' ? 'VER OFERTA' : 'COMPRAR AGORA'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {(index + 1) % 3 === 0 && (
                                            <NativeAdCard
                                                title={index === 2 ? "Novo Cartão Black Sem Anuidade" : "Empréstimo FGTS Cai na Hora"}
                                                price={index === 2 ? "GRÁTIS" : "SIMULAR"}
                                                category="OFERTA"
                                                img={index === 2 ? "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80" : "https://images.unsplash.com/photo-1554224155-16974a4005d1?auto=format&fit=crop&w=600&q=80"}
                                            />
                                        )}
                                    </React.Fragment>
                                ))}

                                <div className="col-span-1">
                                    <AdBanner
                                        type="TIP"
                                        description="Dica: Clique em anúncios parceiros para aumentar seu Score Cred30."
                                    />
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}

            {view === 'create' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 animate-in slide-in-from-bottom duration-300">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        O que você quer vender?
                        <div className="bg-primary-500/10 text-primary-400 text-[9px] px-2 py-0.5 rounded-full border border-primary-500/20 flex items-center gap-1">
                            <Sparkles size={10} /> ASSISTENTE IA ATIVO
                        </div>
                    </h3>
                    <form onSubmit={handleCreateListing} className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Título do Anúncio</label>
                                <button
                                    type="button"
                                    onClick={handleAIAssist}
                                    disabled={aiLoading || !newListing.title}
                                    className="text-[9px] font-black text-primary-400 flex items-center gap-1 hover:text-white transition-colors disabled:opacity-30"
                                >
                                    {aiLoading ? <RefreshCw size={10} className="animate-spin" /> : <Wand2 size={10} />}
                                    MELHORAR COM IA
                                </button>
                            </div>
                            <input
                                type="text"
                                value={newListing.title}
                                onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                                placeholder="Ex: iPhone 13 Pro Max 256GB"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Descrição Detalhada</label>
                            <textarea
                                value={newListing.description}
                                onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white h-32 focus:outline-none focus:border-primary-500/50"
                                placeholder="Descreva o estado do produto, tempo de uso, acessórios inclusos..."
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Preço de Venda</label>
                                <input
                                    type="number"
                                    value={newListing.price}
                                    onChange={(e) => setNewListing({ ...newListing, price: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                                    placeholder="0,00"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Categoria</label>
                                <select
                                    value={newListing.category}
                                    onChange={(e) => setNewListing({ ...newListing, category: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50"
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Foto do Produto (Automático)</label>
                            <div className="flex gap-4 items-start">
                                <div className="w-24 h-24 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                                    {newListing.image_url ? (
                                        <img src={newListing.image_url} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon className="text-zinc-800" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (readerEvent) => {
                                                    const img = new Image();
                                                    img.onload = () => {
                                                        const canvas = document.createElement('canvas');
                                                        const ctx = canvas.getContext('2d');
                                                        const size = 600; // Standard Size
                                                        canvas.width = size;
                                                        canvas.height = size;

                                                        // Calculate crop (Cover)
                                                        const ratio = Math.max(size / img.width, size / img.height);
                                                        const centerShift_x = (size - img.width * ratio) / 2;
                                                        const centerShift_y = (size - img.height * ratio) / 2;

                                                        if (ctx) {
                                                            ctx.clearRect(0, 0, size, size);
                                                            ctx.drawImage(img, 0, 0, img.width, img.height,
                                                                centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);

                                                            // Compression
                                                            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                                            setNewListing(prev => ({ ...prev, image_url: dataUrl }));
                                                        }
                                                    };
                                                    img.src = readerEvent.target?.result as string;
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-primary-500/10 file:text-primary-400 hover:file:bg-primary-500/20"
                                    />
                                    <p className="text-[9px] text-zinc-600 mt-2">
                                        A imagem será automaticamente ajustada para o formato padrão do feed (Quadrado 600px).
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setView('browse')}
                                className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-bold rounded-2xl transition hover:bg-zinc-700 uppercase tracking-widest text-[10px]"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="flex-[2] py-4 bg-primary-500 text-black font-black rounded-2xl transition hover:bg-primary-400 shadow-lg shadow-primary-500/20 uppercase tracking-widest text-[10px]"
                            >
                                Publicar Anúncio
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {view === 'my-orders' && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white mb-4">Minhas Compras</h3>
                    {myOrders.length === 0 ? (
                        <div className="py-20 text-center bg-zinc-900 border border-zinc-800 rounded-3xl">
                            <History size={48} className="text-zinc-800 mx-auto mb-4" />
                            <p className="text-zinc-500 text-sm">Você ainda não realizou nenhuma compra.</p>
                            <button onClick={() => setView('browse')} className="text-primary-400 text-xs font-bold mt-2">Explorar Mercado</button>
                        </div>
                    ) : (
                        myOrders.map(order => (
                            <div key={order.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-4">
                                <div className="w-20 h-20 bg-zinc-950 rounded-xl overflow-hidden flex-shrink-0">
                                    <img src={order.listing_image} alt={order.listing_title} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-white text-sm">{order.listing_title}</h4>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${order.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary-500/10 text-primary-400'}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <p className="text-lg font-black text-white mt-1">{formatCurrency(parseFloat(order.amount))}</p>
                                    <p className="text-[10px] text-zinc-500 mt-2 uppercase font-bold">Pedido: #{order.id.toString().slice(-6)}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {view === 'missions' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="bg-gradient-to-br from-indigo-900/40 to-indigo-600/10 border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Mural de Missões</h3>
                            <p className="text-sm text-zinc-400 max-w-sm">
                                Ganhe dinheiro extra ajudando outros membros com a logística. Aceite missões que cruzam com seu caminho.
                            </p>
                        </div>
                        <Truck className="absolute -right-4 -bottom-4 text-indigo-500/20 w-32 h-32 rotate-12" />
                    </div>

                    {missions.length === 0 ? (
                        <div className="py-20 text-center bg-zinc-900/50 border border-zinc-800 rounded-3xl">
                            <Truck size={48} className="text-zinc-800 mx-auto mb-4" />
                            <p className="text-zinc-500 text-sm">Nenhuma missão de logística disponível no momento.</p>
                            <p className="text-[10px] text-zinc-600 mt-2">Novas oportunidades aparecem quando membros solicitam apoio.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {missions.map(mission => (
                                <div key={mission.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row gap-5 items-start md:items-center group hover:border-indigo-500/40 transition-all">
                                    <div className="w-16 h-16 bg-zinc-950 rounded-xl overflow-hidden shrink-0 border border-zinc-800">
                                        <img src={mission.image_url} alt={mission.item_title} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded uppercase tracking-widest">TRANSPORTE</span>
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase">• {new Date(mission.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <h4 className="font-bold text-white text-base">{mission.item_title}</h4>
                                        <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                                            <span className="text-zinc-500">De:</span> {mission.seller_name.split(' ')[0]} <ArrowLeft size={10} className="rotate-180" /> <span className="text-zinc-500">Para:</span> {mission.buyer_name.split(' ')[0]}
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-1">
                                            Local: <strong>{mission.delivery_address}</strong>
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-0 border-zinc-800">
                                        <div className="text-right">
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Recompensa</p>
                                            <p className="text-xl font-black text-emerald-400">{formatCurrency(parseFloat(mission.delivery_fee))}</p>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                setConfirmData({
                                                    isOpen: true,
                                                    title: 'Aceitar Missão?',
                                                    message: 'Você se compromete a retirar o produto com o vendedor e entregar ao comprador. Ao aceitar, enviaremos o código de coleta.',
                                                    confirmText: 'ACEITAR MISSÃO',
                                                    type: 'info',
                                                    onConfirm: async () => {
                                                        try {
                                                            const res = await apiService.post<any>(`/marketplace/logistic/mission/${mission.id}/accept`, {});
                                                            if (res.success) {
                                                                onSuccess('Missão Aceita!', `Código de Coleta: ${res.data.pickupCode}. Mostre ao vendedor.`);
                                                                setConfirmData(null);
                                                                fetchData(); // refresh
                                                            }
                                                        } catch (err: any) {
                                                            onError('Erro', err.message);
                                                        }
                                                    }
                                                });
                                            }}
                                            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 px-6 rounded-xl transition shadow-lg shadow-indigo-600/20 text-xs uppercase tracking-widest"
                                        >
                                            Aceitar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view === 'offline-sync' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Zap className="text-primary-400" size={32} />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Modo Interior / Sem Sinal</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            Use esta seção para validar compras presenciais quando ambos estiverem sem internet.
                            O vendedor digita o código gerado no celular do comprador.
                        </p>
                    </div>

                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                        <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-primary-400" /> Sou o Vendedor
                        </h4>
                        <div className="space-y-3">
                            <p className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Código Recebido do Comprador</p>
                            <input
                                type="text"
                                value={redeemCode}
                                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                                placeholder="EX: CR30-X4K2P-12"
                                className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-white font-mono text-xl focus:border-primary-500 outline-none transition-all"
                            />
                            <button
                                onClick={handleRedeemOfflineCode}
                                className="w-full bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl shadow-lg transition active:scale-[0.98] uppercase text-xs tracking-widest"
                            >
                                Validar e Receber Saldo
                            </button>
                        </div>
                    </div>

                    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 flex gap-4 items-center">
                        <div className="p-2 bg-zinc-800 rounded-lg text-zinc-500"><Clock size={20} /></div>
                        <div>
                            <p className="text-[10px] font-bold text-white uppercase">Como funciona?</p>
                            <p className="text-[10px] text-zinc-500">O App guarda a validação localmente. O saldo será transferido assim que o celular do vendedor encontrar um sinal de internet.</p>
                        </div>
                    </div>
                </div>
            )}

            {view === 'details' && selectedItem && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
                    <div className="max-w-xl mx-auto min-h-screen bg-zinc-950 flex flex-col">
                        <div className="sticky top-0 z-10 p-4 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md">
                            <button onClick={() => setView('browse')} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition">
                                <ArrowLeft size={24} />
                            </button>
                            <div className="flex gap-2">
                                <button className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition"><Share2 size={20} /></button>
                                <button className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition"><Heart size={20} /></button>
                            </div>
                        </div>

                        <div className="aspect-[4/3] bg-zinc-900 relative">
                            {selectedItem.image_url ? (
                                <img src={selectedItem.image_url} alt={selectedItem.title} className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon size={64} className="text-zinc-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            )}
                        </div>

                        <div className="p-6 space-y-8">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded uppercase tracking-widest">{selectedItem.category}</span>
                                    {selectedItem.is_boosted && <span className="text-[10px] font-black bg-primary-400 text-black px-2 py-0.5 rounded animate-pulse">DESTAQUE</span>}
                                </div>
                                <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1">{selectedItem.title}</h1>
                                <p className="text-2xl font-black text-primary-400">{formatCurrency(parseFloat(selectedItem.price))}</p>
                            </div>

                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-4">
                                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <Package size={14} className="text-primary-400" /> Descrição do Item
                                </h4>
                                <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{selectedItem.description}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400"><ShieldCheck size={16} /></div>
                                        <span className="text-[10px] font-black text-zinc-300 uppercase">Segurança</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 leading-tight">Pagamento protegido por Escrow Cred30.</p>
                                </div>
                                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-primary-500/10 rounded-lg text-primary-400"><Truck size={16} /></div>
                                        <span className="text-[10px] font-black text-zinc-300 uppercase">Logística</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 leading-tight">Retirada ou Apoio Colaborativo (Sem Vínculo Empregatício).</p>
                                </div>
                            </div>

                            <div className="sticky bottom-6 mt-12 bg-black border border-zinc-800 p-4 rounded-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                                <div className="flex-1">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Preço Final</p>
                                    <p className="text-xl font-black text-white">{formatCurrency(parseFloat(selectedItem.price) + (deliveryOption === 'COURIER_REQUEST' ? parseFloat(offeredFee || '0') : 0))}</p>
                                </div>
                                <button
                                    className="flex-[2] bg-primary-500 hover:bg-primary-400 text-black font-black py-4 rounded-2xl transition shadow-lg shadow-primary-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                                    onClick={() => {
                                        if (!navigator.onLine) {
                                            generateOfflineVoucher(selectedItem);
                                            return;
                                        }

                                        // Se for afiliado, abre link
                                        if (selectedItem.type === 'AFFILIATE') {
                                            window.open(selectedItem.affiliate_url, '_blank');
                                            onSuccess('Redirecionando', 'Aproveite a oferta do parceiro!');
                                            return;
                                        }

                                        // Confirmação de Compra com Delivery
                                        setConfirmData({
                                            isOpen: true,
                                            title: deliveryOption === 'COURIER_REQUEST' ? 'Confirmar Compra + Entrega' : 'Confirmar Compra',
                                            message: `Deseja comprar "${selectedItem.title}" por ${formatCurrency(parseFloat(selectedItem.price))} ${deliveryOption === 'COURIER_REQUEST' ? `+ R$ ${offeredFee} de ajuda de custo?` : '?'}`,
                                            confirmText: 'CONFIRMAR PAGAMENTO',
                                            type: 'success',
                                            onConfirm: async () => {
                                                try {
                                                    const res = await apiService.post<any>('/marketplace/buy', {
                                                        listingId: selectedItem.id,
                                                        deliveryType: deliveryOption,
                                                        offeredDeliveryFee: parseFloat(offeredFee),
                                                        deliveryAddress: 'Endereço Principal', // TODO: Pegar do user ou input
                                                        contactPhone: '000000000'
                                                    });
                                                    if (res.success) {
                                                        onSuccess('Sucesso!', 'Compra realizada. Veja detalhes em Seus Pedidos.');
                                                        setView('my-orders');
                                                        setConfirmData(null);
                                                    }
                                                } catch (err: any) {
                                                    onError('Erro', err.message);
                                                }
                                            }
                                        });
                                    }}
                                >
                                    {!navigator.onLine ? 'GERAR VOUCHER OFFLINE' : (selectedItem.type === 'AFFILIATE' ? 'Ver Oferta Parceira' : 'Comprar Agora')}
                                    <ChevronRight size={18} />
                                </button>
                            </div>

                            {selectedItem.type !== 'AFFILIATE' && (
                                <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Opções de Logística</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setDeliveryOption('SELF_PICKUP')}
                                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl border transition ${deliveryOption === 'SELF_PICKUP' ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-transparent border-zinc-800 text-zinc-500'}`}
                                        >
                                            Vou Retirar
                                        </button>
                                        <button
                                            onClick={() => setDeliveryOption('COURIER_REQUEST')}
                                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl border transition ${deliveryOption === 'COURIER_REQUEST' ? 'bg-indigo-900/40 border-indigo-500/50 text-indigo-300' : 'bg-transparent border-zinc-800 text-zinc-500'}`}
                                        >
                                            Solicitar Colaborador
                                        </button>
                                    </div>

                                    {deliveryOption === 'COURIER_REQUEST' && (
                                        <div className="animate-in slide-in-from-top duration-300">
                                            <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1">Oferta de Ajuda de Custo (R$)</label>
                                            <input
                                                type="number"
                                                value={offeredFee}
                                                onChange={(e) => setOfferedFee(e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                                                placeholder="Valor para o entregador (Ex: 10.00)"
                                            />
                                            <p className="text-[9px] text-zinc-600 mt-1 italic">Este valor será pago integralmente ao membro que realizar a entrega.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {offlineVoucher && (
                                <div className="mt-6 bg-primary-500/10 border border-primary-500/30 p-6 rounded-3xl animate-in zoom-in duration-300">
                                    <div className="text-center space-y-2">
                                        <p className="text-[10px] text-primary-400 font-black uppercase tracking-widest">Código de Pagamento Offline</p>
                                        <p className="text-4xl font-black text-white font-mono tracking-tighter">{offlineVoucher.code}</p>
                                        <p className="text-[11px] text-zinc-400 leading-tight">O vendedor deve digitar este código no "Modo Interior" do App dele para validar sua compra.</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-zinc-500 font-bold uppercase tracking-widest border-t border-zinc-800 pt-4">
                                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Transação Segura</span>
                                <span className="flex items-center gap-1"><Truck size={12} /> Entrega Combinada</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {confirmData && (
                <ConfirmModal
                    isOpen={confirmData.isOpen}
                    onClose={() => setConfirmData(null)}
                    onConfirm={confirmData.onConfirm}
                    title={confirmData.title}
                    message={confirmData.message}
                    confirmText={confirmData.confirmText}
                    type={confirmData.type}
                />
            )}
        </div>
    );
};
