import React, { useState, useEffect, useRef, memo } from 'react';
import { Play, Pause, DollarSign, Clock, Eye, ChevronRight, Plus, X as XIcon, CheckCircle2, AlertTriangle, Youtube, Film, ExternalLink, Loader2, Wallet, Smartphone, CreditCard } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface PromoVideo {
    id: string;
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl: string;
    platform: string;
    tag: string;
    durationSeconds: number;
    pricePerView: number;
    minWatchSeconds: number;
    promoterName: string;
    totalViews: number;
    completedViews: number;
    targetViews: number;
    viewerEarning: number;
    isOwner?: boolean;
    ranking: number;
}

interface MyCampaign {
    id: string;
    title: string;
    videoUrl: string;
    platform: string;
    tag: string;
    pricePerView: number;
    minWatchSeconds: number;
    budget: number;
    spent: number;
    remaining: number;
    totalViews: number;
    completedViews: number;
    targetViews: number;
    status: string;
    isActive: boolean;
    ranking: number | null;
    createdAt: string;
}

interface PromoVideosViewProps {
    userBalance: number;
    onRefresh: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export const PromoVideosView: React.FC<PromoVideosViewProps> = ({
    userBalance,
    onRefresh,
    onSuccess,
    onError
}) => {
    const [activeTab, setActiveTab] = useState<'watch' | 'campaigns'>('watch');
    const [videos, setVideos] = useState<PromoVideo[]>([]);
    const [myCampaigns, setMyCampaigns] = useState<MyCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [watchingVideo, setWatchingVideo] = useState<PromoVideo | null>(null);
    const [watchProgress, setWatchProgress] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [earnings, setEarnings] = useState<{ totalEarned: number; videosWatched: number } | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [selectedTag, setSelectedTag] = useState<string>('TODOS');

    const watchTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [feedRes, campaignsRes, earningsRes, tagsRes] = await Promise.all([
                apiService.get<PromoVideo[]>(`/promo-videos/feed${selectedTag !== 'TODOS' ? `?tag=${selectedTag}` : ''}`),
                apiService.get<MyCampaign[]>('/promo-videos/my-campaigns'),
                apiService.get<{ totalEarned: number; videosWatched: number }>('/promo-videos/my-earnings'),
                apiService.get<string[]>('/promo-videos/tags'),
            ]);

            if (feedRes.success && feedRes.data) setVideos(feedRes.data);
            if (campaignsRes.success && campaignsRes.data) setMyCampaigns(campaignsRes.data);
            if (earningsRes.success && earningsRes.data) setEarnings(earningsRes.data);
            if (tagsRes.success && tagsRes.data) setTags(['TODOS', ...tagsRes.data]);
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (activeTab === 'watch') {
            loadFeed();
        }
    }, [selectedTag]);

    const loadFeed = async () => {
        try {
            const feedRes = await apiService.get<PromoVideo[]>(`/promo-videos/feed${selectedTag !== 'TODOS' ? `?tag=${selectedTag}` : ''}`);
            if (feedRes.success && feedRes.data) setVideos(feedRes.data);
        } catch (e) {
            console.error('Erro ao carregar feed:', e);
        }
    };

    const startWatching = async (video: PromoVideo) => {
        try {
            const res = await apiService.post<any>(`/promo-videos/${video.id}/start-view`, {});
            if (!res.success) {
                onError('Erro', res.message);
                return;
            }

            setWatchingVideo(video);
            setWatchProgress(0);

            // Timer para contar tempo assistido
            watchTimerRef.current = setInterval(() => {
                setWatchProgress(prev => {
                    if (prev >= video.minWatchSeconds) {
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000);

        } catch (e: any) {
            onError('Erro', e.message);
        }
    };

    const completeWatch = async () => {
        if (!watchingVideo) return;

        try {
            if (watchTimerRef.current) {
                clearInterval(watchTimerRef.current);
            }

            const res = await apiService.post<any>(`/promo-videos/${watchingVideo.id}/complete-view`, { watchTimeSeconds: watchProgress });

            if (res.success) {
                onSuccess('Parabéns!', res.message);
                onRefresh();
                loadData();
            } else {
                onError('Erro', res.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }

        setWatchingVideo(null);
        setWatchProgress(0);
    };

    const cancelWatch = () => {
        if (watchTimerRef.current) {
            clearInterval(watchTimerRef.current);
        }
        setWatchingVideo(null);
        setWatchProgress(0);
    };

    const getVideoId = (url: string) => {
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        if (ytMatch) return ytMatch[1];
        return null;
    };



    return (
        <div className="space-y-6 pb-32">
            {/* Header com estatísticas */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <Play size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Cred Views</h2>
                        <p className="text-sm opacity-80">Assista vídeos e ganhe dinheiro</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-xl p-3">
                        <p className="text-xs opacity-70">Total Ganho</p>
                        <p className="text-xl font-bold">
                            {(earnings?.totalEarned || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3">
                        <p className="text-xs opacity-70">Vídeos Assistidos</p>
                        <p className="text-xl font-bold">{earnings?.videosWatched || 0}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-surface rounded-xl p-1 border border-surfaceHighlight">
                <button
                    onClick={() => setActiveTab('watch')}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${activeTab === 'watch' ? 'bg-primary-500 text-black' : 'text-zinc-400 hover:text-white'}`}
                >
                    <Eye size={16} className="inline mr-2" />
                    Assistir
                </button>
                <button
                    onClick={() => setActiveTab('campaigns')}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${activeTab === 'campaigns' ? 'bg-primary-500 text-black' : 'text-zinc-400 hover:text-white'}`}
                >
                    <DollarSign size={16} className="inline mr-2" />
                    Minhas Campanhas
                </button>
            </div>

            {/* Conteúdo das Tabs */}
            {activeTab === 'watch' ? (
                <div className="space-y-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Vídeos Disponíveis</h3>
                            <span className="text-xs text-emerald-400">{videos.length} vídeos para assistir</span>
                        </div>

                        {/* Filtros por Tag */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {tags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(tag)}
                                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${selectedTag === tag ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/20' : 'bg-surface border border-surfaceHighlight text-zinc-400'}`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => <VideoCardSkeleton key={i} />)}
                        </div>
                    ) : videos.length === 0 ? (
                        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-8 text-center">
                            <Eye size={48} className="mx-auto text-zinc-600 mb-4" />
                            <p className="text-zinc-400">Nenhum vídeo disponível no momento</p>
                            <p className="text-xs text-zinc-500 mt-2">Volte mais tarde para novos vídeos pagos</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {videos.map(video => (
                                <VideoCard key={video.id} video={video} onWatch={startWatching} />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white">Minhas Campanhas</h3>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-primary-500 hover:bg-primary-400 text-black px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
                        >
                            <Plus size={16} /> Nova Campanha
                        </button>
                    </div>

                    {myCampaigns.length === 0 ? (
                        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-8 text-center">
                            <Film size={48} className="mx-auto text-zinc-600 mb-4" />
                            <p className="text-zinc-400">Você ainda não tem campanhas</p>
                            <p className="text-xs text-zinc-500 mt-2">Promova seus vídeos e pague por views reais</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myCampaigns.map(campaign => (
                                <div key={campaign.id} className="bg-surface border border-surfaceHighlight rounded-2xl p-4 relative overflow-hidden group">
                                    {/* Ranking Badge */}
                                    {campaign.ranking && (
                                        <div className="absolute top-0 right-0 bg-primary-500 py-1 px-3 text-[10px] font-black italic transform translate-x-[15%] translate-y-[-10%] rotate-[15deg]">
                                            RANK #{campaign.ranking}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] bg-primary-500/10 border border-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded font-bold">
                                                    {campaign.tag}
                                                </span>
                                                <h4 className="font-bold text-white line-clamp-1">{campaign.title}</h4>
                                            </div>
                                            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{campaign.platform}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${campaign.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                                            {campaign.status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 text-center mb-4">
                                        <div className="bg-background rounded-xl p-2 border border-surfaceHighlight">
                                            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">Views Totais</p>
                                            <p className="font-black text-white text-xs">{campaign.totalViews.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-background rounded-xl p-2 border border-surfaceHighlight">
                                            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">Completas</p>
                                            <p className="font-black text-emerald-400 text-xs">{campaign.completedViews.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-background rounded-xl p-2 border border-surfaceHighlight">
                                            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">Investido</p>
                                            <p className="font-black text-white text-xs">{campaign.spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                        <div className="bg-background rounded-xl p-2 border border-primary-500/20 bg-primary-500/5">
                                            <p className="text-[8px] text-primary-500/70 font-bold uppercase tracking-tighter">Restante</p>
                                            <p className="font-black text-primary-500 text-xs">{campaign.remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                                            <span>Progresso da Campanha</span>
                                            <span>{campaign.completedViews} / {campaign.targetViews}</span>
                                        </div>
                                        <div className="w-full bg-background rounded-full h-1.5 overflow-hidden border border-surfaceHighlight">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary-600 to-primary-400"
                                                style={{ width: `${Math.min(100, (campaign.completedViews / campaign.targetViews) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Assistir Vídeo - Bottom Sheet on Mobile */}
            {watchingVideo && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-500">
                    <div className="bg-[#0A0A0A] border-t sm:border border-white/5 sm:border-surfaceHighlight rounded-t-[2.5rem] sm:rounded-3xl p-8 w-full sm:max-w-lg relative animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 sm:duration-300 overflow-y-auto max-h-[95vh] custom-scrollbar">
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden opacity-50" />

                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tighter sm:tracking-tight">{watchingVideo.title}</h3>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">por {watchingVideo.promoterName}</p>
                            </div>
                            <button onClick={cancelWatch} className="text-zinc-500 hover:text-white bg-zinc-900/50 p-2 rounded-full">
                                <XIcon size={24} />
                            </button>
                        </div>

                        {/* Video Content */}
                        <div className="aspect-video bg-black rounded-2xl overflow-hidden mb-8 shadow-2xl ring-1 ring-white/10 relative group">
                            {watchingVideo.platform === 'YOUTUBE' && getVideoId(watchingVideo.videoUrl) ? (
                                <iframe
                                    src={`https://www.youtube.com/embed/${getVideoId(watchingVideo.videoUrl)}?autoplay=1`}
                                    className="w-full h-full"
                                    allow="autoplay; encrypted-media"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-zinc-900 to-black">
                                    <Play size={48} className="text-primary-500 opacity-20" />
                                    <a
                                        href={watchingVideo.videoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-primary-500 hover:bg-primary-400 text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-xl shadow-primary-500/20 active:scale-95 transition-all"
                                    >
                                        <ExternalLink size={18} /> ABRIR VÍDEO NOVO
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Progress Monitoring */}
                        <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 mb-6">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Tempo Assistido</span>
                                <span className="text-sm font-black text-white font-mono">
                                    {watchProgress}s / {watchingVideo.minWatchSeconds}s
                                </span>
                            </div>
                            <div className="w-full bg-black rounded-full h-3 overflow-hidden ring-1 ring-white/5">
                                <div
                                    className={`h-full transition-all duration-500 shadow-[0_0_15px_rgba(34,211,238,0.3)] ${watchProgress >= watchingVideo.minWatchSeconds ? 'bg-emerald-500' : 'bg-primary-500'}`}
                                    style={{ width: `${Math.min(100, (watchProgress / watchingVideo.minWatchSeconds) * 100)}%` }}
                                />
                            </div>

                            {watchProgress >= watchingVideo.minWatchSeconds ? (
                                <div className="mt-8 animate-in zoom-in-95 duration-300">
                                    {watchingVideo.isOwner ? (
                                        <>
                                            <div className="bg-primary-500/10 border border-primary-500/20 rounded-2xl p-4 mb-4 flex items-center gap-3">
                                                <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-black shrink-0 shadow-lg shadow-primary-500/20">
                                                    <CheckCircle2 size={24} strokeWidth={3} />
                                                </div>
                                                <p className="text-primary-400 text-xs font-black uppercase tracking-tight">Prévia completa! Este é seu próprio vídeo.</p>
                                            </div>
                                            <button
                                                onClick={cancelWatch}
                                                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all text-xs"
                                            >
                                                FECHAR PRÉVIA
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-4 flex items-center gap-3">
                                                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-black shrink-0 shadow-lg shadow-emerald-500/20">
                                                    <CheckCircle2 size={24} strokeWidth={3} />
                                                </div>
                                                <p className="text-emerald-400 text-xs font-black uppercase tracking-tight">Tempo atingido! Você já pode resgatar seu lucro.</p>
                                            </div>
                                            <button
                                                onClick={completeWatch}
                                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] text-xs"
                                            >
                                                RESGATAR {watchingVideo.viewerEarning.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 mt-6 text-zinc-600">
                                    <Clock size={14} className="animate-spin" />
                                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] animate-pulse">
                                        {watchingVideo.isOwner ? 'Assistindo prévia...' : 'Aguarde o tempo mínimo para validar...'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Anti-Fraud Disclaimer */}
                        <div className="bg-primary-500/5 border border-primary-500/10 rounded-xl p-4 text-center">
                            <p className="text-[9px] text-zinc-500 font-medium leading-relaxed">
                                <span className="text-primary-400 font-black">SEGURANÇA:</span> A visualização é validada pelo ID único da sessão. Não feche o app ou o vídeo antes de completar o tempo mínimo.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Criar Campanha */}
            {showCreateModal && (
                <CreateCampaignModal
                    userBalance={userBalance}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        loadData();
                        onRefresh();
                        onSuccess('Sucesso!', 'Campanha criada com sucesso');
                    }}
                    onError={onError}
                />
            )}
        </div>
    );
};

// Modal para criar campanha
const CreateCampaignModal: React.FC<{
    userBalance: number;
    onClose: () => void;
    onSuccess: () => void;
    onError: (title: string, message: string) => void;
}> = ({ userBalance, onClose, onSuccess, onError }) => {
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'BALANCE' | 'PIX' | 'CARD'>('BALANCE');
    const [form, setForm] = useState({
        title: '',
        description: '',
        videoUrl: '',
        platform: 'YOUTUBE',
        tag: 'OUTROS',
        durationSeconds: 60,
        pricePerView: 0.10,
        minWatchSeconds: 20,
        budget: 10,
        targetViews: 100,
    });

    // Taxas do Asaas (mesmas do backend)
    const ASAAS_PIX_FIXED_FEE = 0.99;
    const ASAAS_CARD_FEE_PERCENT = 0.0299;
    const ASAAS_CARD_FIXED_FEE = 0.49;

    const estimatedViews = Math.floor((form.budget / form.pricePerView) * 1.02); // 2% bonus views
    const viewerEarning = form.pricePerView * 0.60;
    const quotaHoldersShare = form.pricePerView * 0.25;
    const serviceFee = form.pricePerView * 0.15;

    // Lista de tags para o formulário
    const FORM_TAGS = ['ENTRETENIMENTO', 'MUSICA', 'EDUCACAO', 'GAMES', 'LIFESTYLE', 'TECNOLOGIA', 'NEGOCIOS', 'SAUDE', 'HUMOR', 'OUTROS'];

    // Valor total baseado no método de pagamento
    const gatewayFee = paymentMethod === 'PIX'
        ? ASAAS_PIX_FIXED_FEE
        : paymentMethod === 'CARD'
            ? (form.budget + ASAAS_CARD_FIXED_FEE) / (1 - ASAAS_CARD_FEE_PERCENT) - form.budget
            : 0;
    const totalToPay = form.budget + gatewayFee;

    const handleSubmit = async () => {
        if (!form.title || !form.videoUrl) {
            onError('Erro', 'Preencha todos os campos obrigatórios');
            return;
        }

        // Só valida saldo se for pagar com saldo
        if (paymentMethod === 'BALANCE' && form.budget > userBalance) {
            onError('Saldo Insuficiente', `Você tem R$ ${userBalance.toFixed(2)} de saldo`);
            return;
        }

        setLoading(true);
        try {
            const res = await apiService.post<any>('/promo-videos/create', { ...form, paymentMethod });

            if (res.success) {
                // Se for PIX, abrimos o modal de pagamento do Asaas ou mostramos o QR
                if (paymentMethod === 'PIX' && res.data?.bankSlipUrl) {
                    window.open(res.data.bankSlipUrl, '_blank');
                    onSuccess();
                } else {
                    onSuccess();
                }
            } else {
                onError('Erro', res.message || 'Erro ao criar campanha');
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
            <div className="bg-[#0A0A0A] border-t sm:border border-white/5 sm:border-surfaceHighlight rounded-t-[2.5rem] sm:rounded-3xl p-8 w-full sm:max-w-md relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 sm:duration-300 overflow-y-auto max-h-[90vh] custom-scrollbar">
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden opacity-50" />

                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black text-white tracking-tight">Anunciar Vídeo</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white bg-zinc-900/50 p-2 rounded-full">
                        <XIcon size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 px-1">Título da Campanha</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder="Dê um nome atrativo..."
                                className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-5 text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-primary-500/50 transition-all font-medium"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 px-1">URL do Vídeo (YouTube, TikTok...)</label>
                            <input
                                type="url"
                                value={form.videoUrl}
                                onChange={e => setForm({ ...form, videoUrl: e.target.value })}
                                placeholder="https://..."
                                className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-5 text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-primary-500/50 transition-all font-medium"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 px-1">Plataforma</label>
                            <select
                                value={form.platform}
                                onChange={e => setForm({ ...form, platform: e.target.value })}
                                className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-4 text-zinc-100 outline-none appearance-none font-bold text-xs"
                            >
                                <option value="YOUTUBE">YouTube</option>
                                <option value="TIKTOK">TikTok</option>
                                <option value="INSTAGRAM">Instagram</option>
                                <option value="KWAI">Kwai</option>
                                <option value="OTHER">Outro</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 px-1">Categoria (Tag)</label>
                            <select
                                value={form.tag}
                                onChange={e => setForm({ ...form, tag: e.target.value })}
                                className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-4 text-zinc-100 outline-none appearance-none font-bold text-xs"
                            >
                                {FORM_TAGS.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 px-1">Duração (mín 60s)</label>
                            <input
                                type="number"
                                min="60"
                                value={form.durationSeconds}
                                onChange={e => setForm({ ...form, durationSeconds: Math.max(60, Number(e.target.value)) })}
                                className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-5 text-zinc-100 outline-none font-black text-xs"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2 px-1">Retenção (mín 20s)</label>
                            <input
                                type="number"
                                min="20"
                                value={form.minWatchSeconds}
                                onChange={e => setForm({ ...form, minWatchSeconds: Math.max(20, Number(e.target.value)) })}
                                className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 px-5 text-zinc-100 outline-none font-black text-xs"
                            />
                        </div>
                    </div>

                    <div className="p-1 bg-zinc-950 rounded-2xl border border-white/5 grid grid-cols-2 gap-1 font-black">
                        <div className="p-4 bg-zinc-900 rounded-xl">
                            <label className="text-[9px] text-zinc-500 uppercase block mb-1">Preço/View</label>
                            <p className="text-white text-lg">R$ {form.pricePerView.toFixed(2)}</p>
                        </div>
                        <div className="p-4 bg-zinc-900 rounded-xl">
                            <label className="text-[9px] text-zinc-500 uppercase block mb-1">Budget Total</label>
                            <input
                                type="number"
                                value={form.budget}
                                onChange={e => setForm({ ...form, budget: Number(e.target.value) })}
                                className="bg-transparent text-primary-400 text-lg outline-none w-full"
                            />
                        </div>
                    </div>

                    {/* Método de Pagamento - Visual Moderno */}
                    <div>
                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-4 px-1">Forma de Pagamento</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'BALANCE', label: 'SALDO', icon: <Wallet size={20} />, color: 'primary' },
                                { id: 'PIX', label: 'PIX', icon: <Smartphone size={20} />, color: 'emerald' },
                                { id: 'CARD', label: 'CARD', icon: <CreditCard size={20} />, color: 'blue' }
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setPaymentMethod(m.id as any)}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl transition-all border-2 ${paymentMethod === m.id
                                        ? `bg-${m.color}-500/10 border-${m.color}-500/50 text-${m.color}-400 shadow-lg shadow-${m.color}-500/10`
                                        : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:border-zinc-700'}`}
                                >
                                    {m.icon}
                                    <span className="text-[10px] font-black tracking-widest">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Detailed Summary Card */}
                    <div className="bg-primary-500/5 border border-primary-500/20 rounded-[2rem] p-6 space-y-4">
                        <div className="flex justify-between items-center group">
                            <div className="flex flex-col">
                                <span className="text-xs text-zinc-500 font-bold">Alcance Estimado</span>
                                <span className="text-[10px] text-primary-400 font-black animate-pulse">+2% BÔNUS INCLUSO</span>
                            </div>
                            <span className="text-base font-black text-white bg-white/5 px-3 py-1 rounded-full">{estimatedViews} VIEWS</span>
                        </div>

                        <div className="h-px bg-white/5 w-full" />

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-zinc-500 font-semibold">Custo por View (Net)</span>
                                <span className="text-emerald-400 font-black">{viewerEarning.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-zinc-600 font-medium">Lucro dos Sócios (40%)</span>
                                <span className="text-zinc-500 font-bold">{(form.budget * 0.4).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>

                        {paymentMethod !== 'BALANCE' && (
                            <div className="pt-2 mt-4 border-t border-primary-500/10 flex justify-between items-baseline">
                                <span className="text-xs text-zinc-400 font-black uppercase tracking-widest">Total Líquido</span>
                                <span className="text-2xl font-black text-primary-400">{totalToPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading || (paymentMethod === 'BALANCE' && form.budget > userBalance)}
                        className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-30 disabled:grayscale text-black font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-[0_20px_40px_-10px_rgba(6,182,212,0.3)] active:scale-[0.98] text-xs"
                    >
                        {loading ? 'PROCESSANDO...' : 'CONFIRMAR E ATIVAR'}
                    </button>

                    <p className="text-[9px] text-zinc-600 text-center uppercase font-bold tracking-tight">Campanha verificada • Proteção contra fraudes ativada</p>
                </div>
            </div>
        </div>
    );
};

export default PromoVideosView;
// Componente de Card Memoizado para Performance
const VideoCard = memo(({ video, onWatch }: { video: PromoVideo; onWatch: (v: PromoVideo) => void }) => {
    // Funções auxiliares movidas para dentro ou fora conforme necessário
    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'YOUTUBE': return <Youtube size={14} className="text-red-500" />;
            case 'TIKTOK': return <Film size={14} className="text-pink-500" />;
            default: return <Film size={14} className="text-zinc-500" />;
        }
    };

    const getThumbnail = (video: PromoVideo) => {
        if (video.thumbnailUrl) return video.thumbnailUrl;
        if (video.platform === 'YOUTUBE') {
            const id = video.videoUrl.split('v=')[1]?.split('&')[0] || video.videoUrl.split('/').pop();
            return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
        }
        return 'https://placehold.co/400x225/111/444?text=PREVIEW';
    };

    return (
        <div className={`bg-surface border rounded-2xl overflow-hidden transition ${video.isOwner ? 'border-primary-500/30 bg-primary-500/5' : 'border-surfaceHighlight hover:border-primary-500/50'}`}>
            <div className="flex">
                <div className="relative w-32 h-24 flex-shrink-0">
                    <img src={getThumbnail(video)} alt={video.title} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Play size={24} className="text-white" /></div>
                    <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1 rounded">
                        {Math.floor(video.durationSeconds / 60)}:{String(video.durationSeconds % 60).padStart(2, '0')}
                    </div>
                    <div className="absolute top-1 left-1 flex flex-col gap-1">
                        {video.isOwner && <div className="bg-primary-500 text-black text-[8px] px-1.5 py-0.5 rounded font-bold">SEU VÍDEO</div>}
                        <div className="bg-zinc-900/80 text-white text-[8px] px-1.5 py-0.5 rounded font-bold border border-white/10 uppercase">#{video.ranking} TOP</div>
                    </div>
                </div>

                <div className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                {getPlatformIcon(video.platform)}
                                <h4 className="text-sm font-bold text-white line-clamp-1">{video.title}</h4>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.2 rounded text-zinc-400 font-medium">{video.tag}</span>
                            <span className="text-[10px] text-zinc-500">•</span>
                            <p className="text-[10px] text-zinc-500">{video.isOwner ? 'Sua campanha' : `por ${video.promoterName}`}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider leading-none mb-1">Total Views</span>
                                <span className="text-zinc-300 text-xs font-black leading-none">{video.totalViews.toLocaleString()}</span>
                            </div>
                            {!video.isOwner && (
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider leading-none mb-1">Ganhos</span>
                                    <span className="text-emerald-400 font-black text-xs leading-none">+{video.viewerEarning.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            )}
                        </div>
                        <button onClick={() => onWatch(video)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2 ${video.isOwner ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-primary-500 hover:bg-primary-400 text-black shadow-lg shadow-primary-500/20'}`}>
                            {video.isOwner ? 'Ver' : 'Assistir'} <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

// Componente de Skeleton para Carregamento Suave
const VideoCardSkeleton = () => (
    <div className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden animate-pulse">
        <div className="flex">
            <div className="w-32 h-24 bg-zinc-900" />
            <div className="flex-1 p-3 space-y-3">
                <div className="h-4 bg-zinc-900 rounded w-3/4" />
                <div className="h-3 bg-zinc-900 rounded w-1/2" />
                <div className="flex justify-between items-center mt-2">
                    <div className="h-8 bg-zinc-900 rounded w-20" />
                    <div className="h-8 bg-zinc-900 rounded w-24" />
                </div>
            </div>
        </div>
    </div>
);
