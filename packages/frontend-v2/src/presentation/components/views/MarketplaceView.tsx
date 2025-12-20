import React, { useState, useEffect } from 'react';
import {
    ShoppingBag, Tag, Search, Filter, PlusCircle,
    ShieldCheck, Truck, Package, CheckCircle2,
    Clock, DollarSign, ArrowLeft, Image as ImageIcon,
    ChevronRight, Info, AlertCircle, ExternalLink, Star, X as XIcon, RefreshCw
} from 'lucide-react';
import { AdBanner } from '../ui/AdBanner';
import { AppState, User } from '../../../domain/types/common.types';
import { MARKETPLACE_ESCROW_FEE_RATE } from '../../../shared/constants/app.constants';
import { apiService } from '../../../application/services/api.service';

interface MarketplaceViewProps {
    state: AppState;
    onBack: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onRefresh: () => Promise<void>;
}

export const MarketplaceView = ({ state, onBack, onSuccess, onError, onRefresh }: MarketplaceViewProps) => {
    const [view, setView] = useState<'browse' | 'create' | 'my-orders' | 'details'>('browse');
    const [listings, setListings] = useState<any[]>([]);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [myOrders, setMyOrders] = useState<any[]>([]);

    // Form states
    const [newListing, setNewListing] = useState({
        title: '',
        description: '',
        price: '',
        category: 'OUTROS',
        imageUrl: ''
    });

    const categories = ['ELETRÔNICOS', 'SERVIÇOS', 'MODA', 'CASA', 'VEÍCULOS', 'OUTROS'];

    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', 'cred30_preset'); // Nome do preset público
            formData.append('cloud_name', 'diu2htzxk');

            const res = await fetch(`https://api.cloudinary.com/v1_1/diu2htzxk/image/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.secure_url) {
                setNewListing({ ...newListing, imageUrl: data.secure_url });
                onSuccess('Imagem Enviada', 'Sua foto foi salva na nuvem com sucesso!');
            } else {
                console.error('Cloudinary Error Detail:', data);
                const errorMsg = data.error?.message || 'Falha no upload';
                if (errorMsg.includes('unsigned')) {
                    onError('Configuração Necessária', 'Vá no Cloudinary e mude o preset "cred30_preset" para "Unsigned".');
                } else {
                    onError('Erro no Upload', errorMsg);
                }
                throw new Error(errorMsg);
            }
        } catch (e: any) {
            console.error('Upload catch:', e);
            if (!e.message.includes('Configuração')) {
                onError('Erro de Conexão', 'Não foi possível enviar a imagem. Verifique sua internet.');
            }
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        fetchListings();
        fetchMyOrders();
    }, []);

    const fetchListings = async () => {
        try {
            const response = await apiService.get<any>('/marketplace/listings');
            if (response.success) setListings(response.data?.listings || []);
        } catch (e) {
            console.error('Fetch listings error:', e);
        }
    };

    const fetchMyOrders = async () => {
        try {
            const response = await apiService.get<any>('/marketplace/my-orders');
            if (response.success) setMyOrders(response.data?.orders || []);
        } catch (e) {
            console.error('Fetch orders error:', e);
        }
    };

    const handleCreateListing = async (e: React.FormEvent) => {
        e.preventDefault();

        const priceNum = parseFloat(newListing.price);
        if (isNaN(priceNum) || priceNum <= 0) {
            onError('Preço Inválido', 'Por favor, coloque um valor válido para o item.');
            return;
        }

        if (!newListing.imageUrl) {
            onError('Foto Obrigatória', 'Por favor, selecione uma foto para o seu produto.');
            return;
        }

        setLoading(true);
        try {
            const response = await apiService.post<any>('/marketplace/create', {
                ...newListing,
                price: priceNum
            });

            if (response.success) {
                onSuccess('Parabéns!', 'Seu item já está à venda no Mercado Cred30.');
                setView('browse');
                fetchListings();
                setNewListing({ title: '', description: '', price: '', category: 'OUTROS', imageUrl: '' });
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            console.error('Create listing error:', e);
            onError('Falha no Anúncio', e.message || 'Não foi possível publicar seu anúncio. Verifique os dados.');
        } finally {
            setLoading(false);
        }
    };

    const handleBuy = async (listingId: number) => {
        if (!confirm('Deseja realmente comprar este item? O valor será retido pela Cred30 até que você confirme o recebimento.')) return;

        setLoading(true);
        try {
            const response = await apiService.post<any>('/marketplace/buy', { listingId });
            if (response.success) {
                onSuccess('Compra Realizada!', response.message);
                setView('my-orders');
                fetchMyOrders();
                onRefresh(); // Update balance
            } else {
                onError('Falha na Compra', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message || 'Erro ao processar sua compra.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDelivery = async (orderId: number) => {
        if (!confirm('Você confirma que recebeu o produto/serviço? Isso liberará o dinheiro imediatamente para o vendedor.')) return;

        setLoading(true);
        try {
            const response = await apiService.post<any>(`/marketplace/order/${orderId}/receive`, {});
            if (response.success) {
                onSuccess('Sucesso!', 'Valor liberado para o vendedor.');
                fetchMyOrders();
            } else {
                onError('Erro', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message || 'Erro ao processar liberação.');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-30 py-4 -mx-4 px-4 sm:mx-0">
                <div className="flex items-center gap-3">
                    <button onClick={view === 'browse' ? onBack : () => setView('browse')} className="text-zinc-400 hover:text-white transition">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <ShoppingBag className="text-primary-400" />
                            Mercado Cred30
                        </h1>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Compra e Venda com Garantia</p>
                    </div>
                </div>
                {view === 'browse' && (
                    <button
                        onClick={() => setView('create')}
                        className="bg-primary-500 hover:bg-primary-400 text-black px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition active:scale-95 shadow-lg shadow-primary-500/20"
                    >
                        <PlusCircle size={16} /> ANUNCIAR
                    </button>
                )}
            </div>

            {/* View Tabs */}
            <div className="flex gap-2 bg-surfaceHighlight p-1 rounded-xl">
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
            </div>

            {/* Protective Escrow Banner */}
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

            {/* Content Rendering */}
            {view === 'browse' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300">
                    {listings.length > 0 ? (
                        <>
                            {/* Inserir Anúncio Adsterra no topo para visibilidade máxima */}
                            <div className="col-span-1">
                                <AdBanner
                                    type="BANNER"
                                    title="Ganhe + R$ 500 no Saldo"
                                    description="Confira como liberar bônus de parceiros assistindo vídeos."
                                    actionText="LIBERAR AGORA"
                                />
                            </div>

                            {listings.map((item) => (
                                <div key={item.id} className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden group hover:border-primary-500/30 transition-all flex flex-col">
                                    <div className="aspect-square bg-zinc-900 flex items-center justify-center relative">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <ImageIcon size={40} className="text-zinc-800" />
                                        )}
                                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] text-zinc-300 font-bold uppercase">
                                            {item.category}
                                        </div>
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col">
                                        <h3 className="font-bold text-white text-base mb-1 line-clamp-1">{item.title}</h3>
                                        <p className="text-xs text-zinc-500 mb-4 line-clamp-2 h-8">{item.description}</p>

                                        <div className="mt-auto pt-4 border-t border-surfaceHighlight flex items-center justify-between">
                                            <span className="text-lg font-black text-primary-400">{formatCurrency(parseFloat(item.price))}</span>
                                            <button
                                                onClick={() => {
                                                    setSelectedItem(item);
                                                    setView('details');
                                                }}
                                                className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2"
                                            >
                                                VER MAIS
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Segunda chamada Adsterra no final */}
                            <div className="col-span-1">
                                <AdBanner
                                    type="TIP"
                                    description="Dica: Clique em anúncios parceiros para aumentar seu Score Cred30."
                                />
                            </div>
                        </>
                    ) : (
                        <div className="col-span-full py-12 text-center">
                            <Tag size={48} className="text-zinc-800 mx-auto mb-4" />
                            <p className="text-zinc-500 text-sm">Nenhum item anunciado no momento.</p>
                            <button onClick={() => setView('create')} className="text-primary-400 text-xs font-bold mt-2">Clique aqui para ser o primeiro!</button>
                        </div>
                    )}
                </div>
            )}

            {view === 'create' && (
                <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 animate-in slide-in-from-bottom duration-300">
                    <h3 className="text-lg font-bold text-white mb-6">O que você quer vender?</h3>
                    <form onSubmit={handleCreateListing} className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Título do Anúncio</label>
                            <input
                                required
                                value={newListing.title}
                                onChange={e => setNewListing({ ...newListing, title: e.target.value })}
                                placeholder="Ex: iPhone 13 128GB semi-novo"
                                className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Preço (R$)</label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    value={newListing.price}
                                    onChange={e => setNewListing({ ...newListing, price: e.target.value })}
                                    placeholder="0,00"
                                    className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Categoria</label>
                                <select
                                    value={newListing.category}
                                    onChange={e => setNewListing({ ...newListing, category: e.target.value })}
                                    className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition appearance-none"
                                >
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Descrição Detalhada</label>
                            <textarea
                                required
                                rows={4}
                                value={newListing.description}
                                onChange={e => setNewListing({ ...newListing, description: e.target.value })}
                                placeholder="Conte mais sobre o produto, estado de conservação..."
                                className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Foto do Produto</label>
                            <div className="mt-2 flex flex-col gap-4">
                                {newListing.imageUrl ? (
                                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-zinc-900 border border-surfaceHighlight">
                                        <img src={newListing.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setNewListing({ ...newListing, imageUrl: '' })}
                                            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition"
                                        >
                                            <XIcon size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="w-full aspect-video rounded-2xl border-2 border-dashed border-zinc-700 hover:border-primary-500/50 hover:bg-primary-500/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-primary-400 group-hover:bg-primary-500/10 transition-all">
                                            <PlusCircle size={24} />
                                        </div>
                                        <div className="text-center flex flex-col items-center gap-2">
                                            {uploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <RefreshCw size={24} className="text-primary-400 animate-spin" />
                                                    <p className="text-xs font-bold text-primary-400">Subindo para nuvem...</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="bg-primary-500 text-black px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tighter mb-2 shadow-lg">
                                                        Tirar ou Escolher Foto
                                                    </div>
                                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Toque para selecionar da sua galeria</p>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                )}

                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-zinc-600 uppercase text-center">Ou use um link externo</p>
                                    <div className="relative">
                                        <input
                                            value={newListing.imageUrl.startsWith('data:') ? '' : newListing.imageUrl}
                                            onChange={e => setNewListing({ ...newListing, imageUrl: e.target.value })}
                                            placeholder="https://imgur.com/foto.jpg"
                                            className="w-full bg-background border border-surfaceHighlight rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition pl-10 text-xs"
                                        />
                                        <ImageIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-primary-900/20 border border-primary-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Info size={16} className="text-primary-400" />
                                <span className="text-xs font-bold text-white uppercase">Taxas do Mercado</span>
                            </div>
                            <p className="text-[11px] text-zinc-400">
                                Ao vender, a Cred30 retém uma taxa de 5% sobre o valor total pela intermediação segura (Escrow).
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-black py-4 rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50"
                        >
                            {loading ? 'PUBLICANDO...' : 'PUBLICAR ANÚNCIO'}
                        </button>
                    </form>
                </div>
            )}

            {view === 'my-orders' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    {myOrders.length > 0 ? myOrders.map((order) => {
                        const isBuyer = order.buyer_id === state.currentUser?.id;
                        return (
                            <div key={order.id} className="bg-surface border border-surfaceHighlight rounded-2xl p-4 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500">
                                            {isBuyer ? <ShoppingBag size={20} /> : <Tag size={20} />}
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 font-bold uppercase tracking-tight">{isBuyer ? 'Minha Compra' : 'Minha Venda'}</p>
                                            <h4 className="font-bold text-white text-sm line-clamp-1">{order.title}</h4>
                                        </div>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-[9px] font-black uppercase ${order.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                                        order.status === 'WAITING_SHIPPING' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-400'
                                        }`}>
                                        {order.status === 'WAITING_SHIPPING' ? 'EM GARANTIA' : order.status}
                                    </div>
                                </div>

                                <div className="bg-background/40 rounded-xl p-3 flex justify-between items-center text-xs">
                                    <div className="text-zinc-500">
                                        {isBuyer ? 'Vendedor: ' : 'Comprador: '}
                                        <span className="text-zinc-300 font-bold">{isBuyer ? order.seller_name : order.buyer_name}</span>
                                    </div>
                                    <div className="text-white font-black">{formatCurrency(isBuyer ? parseFloat(order.amount) : parseFloat(order.seller_amount))}</div>
                                </div>

                                {isBuyer && order.status === 'WAITING_SHIPPING' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 bg-zinc-800/30 p-2 rounded-lg">
                                            <AlertCircle size={14} className="text-yellow-500" />
                                            <span>Só confirme se realmente já estiver com o produto em mãos.</span>
                                        </div>
                                        <button
                                            onClick={() => handleConfirmDelivery(order.id)}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black py-3 rounded-xl transition shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle2 size={16} /> CONFIRMAR RECEBIMENTO
                                        </button>
                                    </div>
                                )}

                                {!isBuyer && order.status === 'WAITING_SHIPPING' && (
                                    <div className="bg-zinc-800/40 p-3 rounded-xl flex items-center gap-3">
                                        <Clock size={20} className="text-yellow-500 shrink-0" />
                                        <p className="text-[10px] text-zinc-400 leading-tight">
                                            O pagamento do comprador ja foi processado e esta seguro conosco. Entregue o produto para que ele possa liberar seu saldo.
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    }) : (
                        <div className="py-12 text-center">
                            <Package size={48} className="text-zinc-800 mx-auto mb-4" />
                            <p className="text-zinc-500 text-sm">Você ainda não realizou transações.</p>
                        </div>
                    )}
                </div>
            )}

            {view === 'details' && selectedItem && (
                <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden animate-in fade-in slide-in-from-right duration-300">
                    <div className="aspect-video bg-zinc-900 flex items-center justify-center relative">
                        {selectedItem.image_url ? (
                            <img src={selectedItem.image_url} alt={selectedItem.title} className="w-full h-full object-cover" />
                        ) : (
                            <ImageIcon size={64} className="text-zinc-800" />
                        )}
                        <button onClick={() => setView('browse')} title="Fechar" className="absolute top-4 left-4 bg-black/60 p-2 rounded-full text-white">
                            <ArrowLeft size={20} />
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className="text-[10px] bg-primary-500/20 text-primary-400 px-2 py-1 rounded font-black uppercase mb-2 inline-block">
                                    {selectedItem.category}
                                </span>
                                <h1 className="text-2xl font-black text-white">{selectedItem.title}</h1>
                                <p className="text-sm text-zinc-500 font-medium">Vendedor: {selectedItem.seller_name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-primary-400">{formatCurrency(parseFloat(selectedItem.price))}</p>
                            </div>
                        </div>

                        <div className="bg-background/40 rounded-2xl p-4 mb-6">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase mb-2">Descrição</h4>
                            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                                {selectedItem.description}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-xs text-zinc-400">
                                <ShieldCheck size={18} className="text-primary-400" />
                                <span>Compra protegida pela Garantia Cred30</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-zinc-400">
                                <Truck size={18} className="text-zinc-500" />
                                <span>Combine a entrega diretamente com o vendedor</span>
                            </div>

                            <button
                                onClick={() => handleBuy(selectedItem.id)}
                                disabled={loading}
                                className="w-full bg-primary-600 hover:bg-primary-500 text-white font-black py-4 rounded-2xl shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
                            >
                                <ShoppingBag /> {loading ? 'PROCESSANDO...' : 'COMPRAR AGORA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
