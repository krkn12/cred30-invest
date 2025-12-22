import React, { useState, useEffect } from 'react';
import {
    ShoppingBag, Tag, Search, Filter, PlusCircle,
    ShieldCheck, Truck, Package, CheckCircle2,
    Clock, DollarSign, ArrowLeft, Image as ImageIcon,
    ChevronRight, Info, AlertCircle, ExternalLink, Star, X as XIcon, RefreshCw,
    Sparkles, Wand2, Lightbulb, Zap, TrendingUp
} from 'lucide-react';
import { AdBanner } from '../ui/AdBanner';
import { ConfirmModal } from '../ui/ConfirmModal';
import { AppState, User } from '../../../domain/types/common.types';
import { MARKETPLACE_ESCROW_FEE_RATE, MARKET_CREDIT_INTEREST_RATE, MARKET_CREDIT_MAX_INSTALLMENTS, MARKET_CREDIT_MIN_SCORE } from '../../../shared/constants/app.constants';
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
    const [buyMethod, setBuyMethod] = useState<'balance' | 'credit'>('balance');
    const [selectedInstallments, setSelectedInstallments] = useState(1);

    // Novos estados de entrega e contato
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('TODOS');

    // Estado para Modal de Confirmação
    const [confirmData, setConfirmData] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type?: 'danger' | 'warning' | 'info';
        confirmText?: string;
    } | null>(null);

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
    const [aiLoading, setAiLoading] = useState(false);

    const handleAIAssist = async () => {
        if (!newListing.title || newListing.title.length < 3) {
            onError('Título Curto', 'Diga o que você está vendendo para a IA te ajudar!');
            return;
        }

        setAiLoading(true);
        // Simulação de processamento de IA para gerar descrição profissional
        setTimeout(() => {
            const title = newListing.title.toLowerCase();
            let suggestedDesc = '';
            let suggestedCat = 'OUTROS';

            if (title.includes('iphone') || title.includes('celular') || title.includes('samsung')) {
                suggestedDesc = `Vendo ${newListing.title} em excelente estado de conservação. Aparelho 100% original, funcionando perfeitamente e sem detalhes.\n\nAcompanha acessórios originais. Ótimo custo-benefício para quem busca qualidade e procedência. Entrega a combinar via Cred30.`;
                suggestedCat = 'ELETRÔNICOS';
            } else if (title.includes('carro') || title.includes('moto') || title.includes('veiculo')) {
                suggestedDesc = `${newListing.title} muito bem cuidado, com as manutenções em dia. Documentação ok, pneus bons e pronto para uso.\n\nIdeal para quem busca um veículo confiável e econômico. Aceito propostas justas através do pagamento seguro da plataforma.`;
                suggestedCat = 'VEÍCULOS';
            } else if (title.includes('limpeza') || title.includes('aula') || title.includes('pintura') || title.includes('serviço')) {
                suggestedDesc = `Ofereço serviço profissional de ${newListing.title}. Experiência comprovada, pontualidade e foco na satisfação do cliente.\n\nUtilizo materiais de alta qualidade. Solicite um orçamento sem compromisso. Pagamento garantido pelo sistema de Escrow da Cred30.`;
                suggestedCat = 'SERVIÇOS';
            } else {
                suggestedDesc = `Oportunidade única: ${newListing.title}.\n\nProduto de procedência, conforme as fotos anexadas. Perfeito para quem busca um item ${newListing.title} com durabilidade e preço justo. Dúvidas? Entre em contato via chat para negociarmos os detalhes da entrega!`;
            }

            setNewListing(prev => ({
                ...prev,
                description: suggestedDesc,
                category: suggestedCat
            }));

            onSuccess('IA Consultora', 'Melhorei seu anúncio com descrições que vendem mais rápido!');
            setAiLoading(false);
        }, 1500);
    };

    const compressImage = (file: File): Promise<Blob> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else resolve(file);
                    }, 'image/jpeg', 0.75); // 75% de qualidade para economizar muito espaço
                };
            };
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // Comprimir antes de enviar para economizar banda e espaço no Cloudinary
            const compressedBlob = await compressImage(file);

            const formData = new FormData();
            formData.append('file', compressedBlob);
            formData.append('upload_preset', 'cred30_preset');
            formData.append('cloud_name', 'diu2htzxk');

            const res = await fetch(`https://api.cloudinary.com/v1_1/diu2htzxk/image/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.secure_url) {
                // Adicionamos parâmetros de otimização do Cloudinary na URL salva
                // c_limit,w_1200 -> limite de largura
                // q_auto,f_auto -> qualidade e formato automático
                const optimizedUrl = data.secure_url.replace('/upload/', '/upload/c_limit,w_1200,q_auto,f_auto/');
                setNewListing({ ...newListing, imageUrl: optimizedUrl });
                onSuccess('Imagem Otimizada', 'Sua foto foi comprimida e salva com sucesso!');
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
            console.log('Fetching listings...');
            const response = await apiService.get<any>('/marketplace/listings');
            console.log('Listings response:', response);
            if (response.success && response.data) {
                setListings(Array.isArray(response.data.listings) ? response.data.listings : []);
            } else {
                setListings([]);
            }
        } catch (e) {
            console.error('Fetch listings error:', e);
            setListings([]);
        }
    };

    const fetchMyOrders = async () => {
        try {
            const response = await apiService.get<any>('/marketplace/my-orders');
            if (response.success && response.data) {
                setMyOrders(Array.isArray(response.data.orders) ? response.data.orders : []);
            } else {
                setMyOrders([]);
            }
        } catch (e) {
            console.error('Fetch orders error:', e);
            setMyOrders([]);
        }
    };

    const handleCreateListing = async (e: React.FormEvent) => {
        e.preventDefault();

        const priceNum = parseFloat(newListing.price.replace(',', '.'));
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

    const executeBuy = async (listingId: number) => {
        setLoading(true);
        try {
            const response = await apiService.post<any>('/marketplace/buy', {
                listingId,
                deliveryAddress,
                contactPhone
            });
            if (response.success) {
                onSuccess('Compra Realizada!', response.message);
                setView('my-orders');
                setDeliveryAddress('');
                setContactPhone('');
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

    const handleBuy = (listingId: number) => {
        setConfirmData({
            isOpen: true,
            title: 'Confirmar Compra?',
            message: 'O valor será retido pela Cred30 de forma segura. O vendedor só receberá quando você confirmar que o produto chegou e está conforme anunciado.',
            confirmText: 'Pagar com Saldo',
            onConfirm: () => executeBuy(listingId)
        });
    };

    const executeConfirmDelivery = async (orderId: number) => {
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

    const handleConfirmDelivery = (orderId: number) => {
        setConfirmData({
            isOpen: true,
            title: 'Confirmar Recebimento?',
            message: 'Atenção: Ao confirmar, o dinheiro será liberado imediatamente para o vendedor. Só faça isso se já estiver com o produto em mãos e satisfeito.',
            confirmText: 'Liberar Pagamento',
            type: 'warning',
            onConfirm: () => executeConfirmDelivery(orderId)
        });
    };

    const executeBoost = async (listingId: number) => {
        setLoading(true);
        try {
            const response = await apiService.post<any>('/marketplace/boost', { listingId });
            if (response.success) {
                onSuccess('Impulsionado!', response.message);
                fetchListings();
                onRefresh();
            } else {
                onError('Falha no Impulsionamento', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message || 'Erro ao impulsionar anúncio.');
        } finally {
            setLoading(false);
        }
    };

    const handleBoostListing = (listingId: number) => {
        setConfirmData({
            isOpen: true,
            title: 'Impulsionar Anúncio',
            message: 'Deseja impulsionar este anúncio por R$ 5,00? Ele aparecerá no topo do mercado com destaque especial.',
            confirmText: 'Impulsionar (R$ 5,00)',
            onConfirm: () => executeBoost(listingId)
        });
    };

    const executeBuyCredit = async (listingId: number) => {
        setLoading(true);
        try {
            const response = await apiService.post<any>('/marketplace/buy-on-credit', {
                listingId,
                installments: selectedInstallments,
                deliveryAddress,
                contactPhone
            });
            if (response.success) {
                onSuccess('Apoio Aprovado!', response.message);
                setView('my-orders');
                setDeliveryAddress('');
                setContactPhone('');
                fetchMyOrders();
                onRefresh();
            } else {
                onError('Falha no Apoio Mútuo', response.message);
            }
        } catch (e: any) {
            onError('Erro', e.message || 'Erro ao processar seu apoio social.');
        } finally {
            setLoading(false);
        }
    };

    const handleBuyOnCredit = (listingId: number) => {
        setConfirmData({
            isOpen: true,
            title: 'Solicitar Apoio Social',
            message: `Deseja solicitar apoio para este item em ${selectedInstallments}x? Seu Score será usado como garantia e analisado instantaneamente.`,
            confirmText: 'Solicitar Apoio',
            onConfirm: () => executeBuyCredit(listingId)
        });
    };

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const NativeAdCard = ({ title, price, img, category }: { title: string, price: string, img: string, category: string }) => (
        <div
            onClick={() => {
                if (confirm('Você está saindo da Cred30 para ver uma oferta de um parceiro externo. Deseja continuar?')) {
                    window.open('https://www.effectivegatecpm.com/ec4mxdzvs?key=a9eefff1a8aa7769523373a66ff484aa', '_blank');
                }
            }}
            className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-primary-500/40 transition-all flex flex-col cursor-pointer relative shadow-2xl"
        >
            <div className="absolute top-2 left-2 z-10 bg-zinc-800 text-zinc-400 text-[7px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 border border-zinc-700">
                <Info size={8} /> ANÚNCIO DE PARCEIRO
            </div>
            <div className="aspect-square bg-zinc-900 flex items-center justify-center relative grayscale-[0.3] group-hover:grayscale-0 transition-all">
                <img src={img} alt={title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[9px] text-zinc-400 font-medium">
                    {category}
                </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-white text-base mb-1 line-clamp-1 group-hover:text-primary-400 transition-colors">{title}</h3>
                <p className="text-[10px] text-zinc-500 mb-4 line-clamp-2 h-8 italic leading-tight">Esta é uma oferta externa recomendada por nossos parceiros publicitários.</p>

                <div className="mt-auto space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-base font-black text-primary-400/70">{price}</span>
                        <div className="text-[9px] text-zinc-600 flex items-center gap-1">
                            Link Externo <ExternalLink size={10} />
                        </div>
                    </div>

                    <button className="w-full bg-zinc-800 group-hover:bg-primary-500 group-hover:text-black py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2">
                        SAIBA MAIS
                    </button>

                    <p className="text-[7px] text-zinc-700 text-center uppercase tracking-tighter">
                        A Cred30 não se responsabiliza pelo conteúdo deste site externo.
                    </p>
                </div>
            </div>
        </div>
    );

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
                            className="w-full bg-surface border border-surfaceHighlight rounded-2xl pl-12 pr-12 py-4 text-sm text-white focus:outline-none focus:border-primary-500/50 transition-all shadow-xl"
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
                                        : 'bg-surface text-zinc-500 border-surfaceHighlight hover:border-zinc-700'}
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

                        return filtered.map((item, index) => (
                            <React.Fragment key={item.id}>
                                <div className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden group hover:border-primary-500/30 transition-all flex flex-col">
                                    <div className="aspect-square bg-zinc-900 flex items-center justify-center relative">
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

                                        <div className="mt-auto pt-4 border-t border-surfaceHighlight flex flex-col gap-3">
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
                                                            if (item.type === 'AFFILIATE') {
                                                                setSelectedItem(item);
                                                                setView('details');
                                                            } else {
                                                                setSelectedItem(item);
                                                                setView('details');
                                                            }
                                                        }}
                                                        className={`${item.type === 'AFFILIATE' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-primary-600 hover:bg-primary-500'} text-black px-4 py-2 rounded-lg text-xs font-black transition active:scale-95 flex items-center gap-2`}
                                                    >
                                                        {item.type === 'AFFILIATE' ? 'VER OFERTA' : 'COMPRAR AGORA'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Injeção de Anúncio Estilo OLX a cada 3 itens */}
                                {(index + 1) % 3 === 0 && (
                                    <NativeAdCard
                                        title={index === 2 ? "Novo Cartão Black Sem Anuidade" : "Empréstimo FGTS Cai na Hora"}
                                        price={index === 2 ? "GRÁTIS" : "SIMULAR"}
                                        category="OFERTA"
                                        img={index === 2 ? "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80" : "https://images.unsplash.com/photo-1554224155-16974a4005d1?auto=format&fit=crop&w=600&q=80"}
                                    />
                                )}
                            </React.Fragment>
                        ))
                    }

                            {/* Segunda chamada Adsterra no final */}
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
    )
}

{
    view === 'create' && (
        <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 animate-in slide-in-from-bottom duration-300">
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
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Descrição Detalhada</label>
                        {!newListing.description && (
                            <span className="text-[9px] text-zinc-600 flex items-center gap-1 italic">
                                <Lightbulb size={10} /> A IA pode preencher isso para você!
                            </span>
                        )}
                    </div>
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
    )
}

{
    view === 'my-orders' && (
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
                                    {order.payment_method === 'CRED30_CREDIT' && order.installments && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-primary-400 font-bold mt-0.5">
                                            <Zap size={12} className="fill-primary-400/20" />
                                            <span>Repasse Programado: {order.installments}x de {formatCurrency(parseFloat(order.total_repayment) / order.installments)}</span>
                                        </div>
                                    )}
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

                        {/* Dados de Entrega (Visível para ambos) */}
                        {(order.delivery_address || order.contact_phone) && (
                            <div className="bg-zinc-800/30 p-3 rounded-xl space-y-2 border border-zinc-700/30">
                                <p className="text-[10px] uppercase font-bold text-zinc-500 mb-1 flex items-center gap-1">
                                    <Truck size={12} /> Detalhes de Envio
                                </p>
                                {order.delivery_address && (
                                    <div className="text-xs text-zinc-300">
                                        <span className="text-zinc-500 block text-[9px]">Endereço:</span>
                                        {order.delivery_address}
                                    </div>
                                )}
                                {order.contact_phone && (
                                    <div className="text-xs text-zinc-300">
                                        <span className="text-zinc-500 block text-[9px]">Contato:</span>
                                        {order.contact_phone}
                                    </div>
                                )}
                            </div>
                        )}

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
    )
}

{
    view === 'details' && selectedItem && (
        <div className="bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden animate-in fade-in slide-in-from-right duration-300">
            <div className="md:grid md:grid-cols-2 lg:grid-cols-5 md:gap-0">
                {/* Coluna da Imagem */}
                <div className="lg:col-span-3 bg-black flex items-center justify-center relative min-h-[400px] md:min-h-[600px] md:border-r border-surfaceHighlight">
                    {selectedItem.image_url ? (
                        <img src={selectedItem.image_url} alt={selectedItem.title} className="w-full h-full object-contain max-h-[80vh]" />
                    ) : (
                        <ImageIcon size={64} className="text-zinc-800" />
                    )}
                    <button onClick={() => setView('browse')} title="Voltar" className="absolute top-4 left-4 bg-black/60 hover:bg-black/80 transition p-2 rounded-full text-white z-10 backdrop-blur-sm">
                        <ArrowLeft size={24} />
                    </button>
                </div>

                {/* Coluna de Detalhes e Ação */}
                <div className="lg:col-span-2 p-6 md:p-8 flex flex-col h-full overflow-y-auto max-h-[90vh]">
                    <div className="mb-6">
                        <span className="text-[10px] bg-primary-500/20 text-primary-400 px-2 py-1 rounded font-black uppercase mb-3 inline-block tracking-wider">
                            {selectedItem.category}
                        </span>
                        <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-2">{selectedItem.title}</h1>
                        <p className="text-sm text-zinc-500 font-medium flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-400">
                                {selectedItem.seller_name.charAt(0)}
                            </span>
                            Vendido por <span className="text-zinc-300">{selectedItem.seller_name}</span>
                        </p>
                    </div>

                    <div className="mb-8">
                        <p className="text-4xl font-black text-white tracking-tight">{formatCurrency(parseFloat(selectedItem.price))}</p>
                        <p className="text-xs text-zinc-500 font-medium mt-1">À vista no Pix ou Saldo</p>
                    </div>

                    <div className="bg-background/40 rounded-2xl p-4 mb-6 border border-white/5">
                        <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-2 tracking-widest">Sobre este item</h4>
                        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                            {selectedItem.description}
                        </p>
                    </div>

                    <div className="mt-auto">
                        {selectedItem.type === 'AFFILIATE' ? (
                            <div className="space-y-6">
                                <div className="bg-amber-900/20 border border-amber-500/20 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-2 text-amber-400">
                                        <Star size={16} />
                                        <span className="text-xs font-black uppercase">Oferta de Parceiro Cred30</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                                        Este produto é vendido por uma loja parceira externa. Ao clicar no botão abaixo, você será redirecionado para concluir a compra com segurança no site do lojista.
                                    </p>
                                </div>

                                <button
                                    onClick={() => window.open(selectedItem.affiliate_url || selectedItem.affiliateUrl, '_blank')}
                                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-5 rounded-2xl shadow-xl shadow-amber-900/20 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-wider"
                                >
                                    IR PARA A LOJA <ExternalLink size={20} />
                                </button>

                                <p className="text-[9px] text-zinc-600 text-center uppercase font-bold tracking-tighter">
                                    A Cred30 pode receber uma comissão por sua compra neste parceiro, ajudando a manter nossa cooperativa.
                                </p>
                            </div>
                        ) : (
                            <>
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase mb-4 tracking-widest">Como você quer pagar?</h4>

                                <div className="flex gap-2 mb-6">
                                    <button
                                        onClick={() => setBuyMethod('balance')}
                                        className={`flex-1 py-4 rounded-xl border font-bold text-xs transition active:scale-95 ${buyMethod === 'balance' ? 'bg-primary-500 text-black border-primary-500 shadow-lg shadow-primary-500/20' : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:bg-zinc-900'}`}
                                    >
                                        Saldo à Vista
                                    </button>
                                    <button
                                        onClick={() => setBuyMethod('credit')}
                                        className={`flex-1 py-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all relative active:scale-95 ${buyMethod === 'credit' ? 'bg-primary-500/10 border-primary-500 text-primary-400 shadow-lg shadow-primary-500/10' : 'bg-background border-surfaceHighlight text-zinc-500 hover:bg-zinc-900'}`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <TrendingUp size={14} />
                                            <span>APOIO SOCIAL</span>
                                        </div>
                                        <span className="absolute -top-2 -right-2 bg-emerald-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">
                                            TAXA REDUZIDA
                                        </span>
                                    </button>
                                </div>

                                {buyMethod === 'credit' && (
                                    <div className="space-y-4 animate-in slide-in-from-top duration-300 mb-6 bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                                        {state.currentUser!.score < MARKET_CREDIT_MIN_SCORE ? (
                                            <div className="flex items-start gap-3">
                                                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="text-xs font-bold text-red-500 uppercase mb-1">Indisponível para seu perfil</h4>
                                                    <p className="text-[11px] text-zinc-400 leading-tight">
                                                        Seu score é <strong>{state.currentUser!.score}</strong>. O mínimo para crédito é <strong>{MARKET_CREDIT_MIN_SCORE}</strong>.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-2">Opções de Parcelamento</label>
                                                <select
                                                    value={selectedInstallments}
                                                    onChange={(e) => setSelectedInstallments(Number(e.target.value))}
                                                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                                                >
                                                    {[...Array(MARKET_CREDIT_MAX_INSTALLMENTS)].map((_, i) => {
                                                        const month = i + 1;
                                                        const total = parseFloat(selectedItem.price) * (1 + (MARKET_CREDIT_INTEREST_RATE * month));
                                                        return (
                                                            <option key={month} value={month}>
                                                                {month}x de {formatCurrency(total / month)} (Total: {formatCurrency(total)})
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                <p className="text-[10px] text-zinc-500 mt-2 text-right">
                                                    * Juros de {MARKET_CREDIT_INTEREST_RATE * 100}% a.m.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Dados de Entrega (Compacto para Desktop) */}
                                <div className="space-y-3 mb-6">
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                            <Truck size={14} className="text-zinc-500 group-focus-within:text-primary-500 transition-colors" />
                                        </div>
                                        <input
                                            value={deliveryAddress}
                                            onChange={(e) => setDeliveryAddress(e.target.value)}
                                            placeholder="Endereço de Entrega Completo"
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-primary-500 text-xs transition-all focus:bg-black"
                                        />
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                            <Truck size={14} className="text-zinc-500 group-focus-within:text-primary-500 transition-colors" />
                                        </div>
                                        <input
                                            type="tel"
                                            value={contactPhone}
                                            onChange={(e) => setContactPhone(e.target.value)}
                                            placeholder="WhatsApp (XX) XXXXX-XXXX"
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-primary-500 text-xs transition-all focus:bg-black"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => buyMethod === 'balance' ? handleBuy(selectedItem.id) : handleBuyOnCredit(selectedItem.id)}
                                    disabled={loading || (buyMethod === 'credit' && state.currentUser!.score < MARKET_CREDIT_MIN_SCORE) || deliveryAddress.length < 10 || contactPhone.length < 8}
                                    className="w-full bg-white hover:bg-primary-400 hover:text-black text-black font-black py-4 rounded-xl shadow-xl shadow-white/5 hover:shadow-primary-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base uppercase tracking-wide"
                                >
                                    {loading ? 'Processando...' : (
                                        deliveryAddress.length < 10 || contactPhone.length < 8
                                            ? 'Preencha a Entrega'
                                            : (buyMethod === 'credit' ? 'Solicitar Crédito' : 'Comprar Agora')
                                    )}
                                </button>

                                <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                    <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-primary-500" /> Compra Segura</span>
                                    <span className="flex items-center gap-1"><Truck size={12} /> Entrega Combinada</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
{
    confirmData && (
        <ConfirmModal
            isOpen={confirmData.isOpen}
            onClose={() => setConfirmData(null)}
            onConfirm={confirmData.onConfirm}
            title={confirmData.title}
            message={confirmData.message}
            confirmText={confirmData.confirmText}
            type={confirmData.type}
        />
    )
}
        </div >
    );
};
