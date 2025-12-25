import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, DollarSign, Clock, Eye, ChevronRight, Plus, X as XIcon, CheckCircle2, AlertTriangle, Youtube, Film, ExternalLink, Loader2 } from 'lucide-react';
import { apiService } from '../../../application/services/api.service';

interface PromoVideo {
    id: string;
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl: string;
    platform: string;
    durationSeconds: number;
    pricePerView: number;
    minWatchSeconds: number;
    promoterName: string;
    totalViews: number;
    targetViews: number;
    viewerEarning: number;
}

interface MyCampaign {
    id: string;
    title: string;
    videoUrl: string;
    platform: string;
    pricePerView: number;
    budget: number;
    spent: number;
    remaining: number;
    totalViews: number;
    targetViews: number;
    status: string;
    isActive: boolean;
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

    const watchTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [feedRes, campaignsRes, earningsRes] = await Promise.all([
                apiService.get<PromoVideo[]>('/promo-videos/feed'),
                apiService.get<MyCampaign[]>('/promo-videos/my-campaigns'),
                apiService.get<{ totalEarned: number; videosWatched: number }>('/promo-videos/my-earnings'),
            ]);

            if (feedRes.success && feedRes.data) setVideos(feedRes.data);
            if (campaignsRes.success && campaignsRes.data) setMyCampaigns(campaignsRes.data);
            if (earningsRes.success && earningsRes.data) setEarnings(earningsRes.data);
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
        }
        setLoading(false);
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
        // YouTube
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        if (ytMatch) return ytMatch[1];
        return null;
    };

    const getThumbnail = (video: PromoVideo) => {
        if (video.thumbnailUrl) return video.thumbnailUrl;
        const ytId = getVideoId(video.videoUrl);
        if (ytId) return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        return '/placeholder-video.png';
    };

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'YOUTUBE': return <Youtube size={14} className="text-red-500" />;
            case 'TIKTOK': return <Film size={14} className="text-pink-500" />;
            default: return <Film size={14} className="text-zinc-400" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-primary-500" size={32} />
            </div>
        );
    }

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
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white">Vídeos Disponíveis</h3>
                        <span className="text-xs text-emerald-400">{videos.length} vídeos para assistir</span>
                    </div>

                    {videos.length === 0 ? (
                        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-8 text-center">
                            <Eye size={48} className="mx-auto text-zinc-600 mb-4" />
                            <p className="text-zinc-400">Nenhum vídeo disponível no momento</p>
                            <p className="text-xs text-zinc-500 mt-2">Volte mais tarde para novos vídeos pagos</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {videos.map(video => (
                                <div key={video.id} className="bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden hover:border-primary-500/50 transition">
                                    <div className="flex">
                                        {/* Thumbnail */}
                                        <div className="relative w-32 h-24 flex-shrink-0">
                                            <img
                                                src={getThumbnail(video)}
                                                alt={video.title}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <Play size={24} className="text-white" />
                                            </div>
                                            <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1 rounded">
                                                {Math.floor(video.durationSeconds / 60)}:{String(video.durationSeconds % 60).padStart(2, '0')}
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 p-3 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    {getPlatformIcon(video.platform)}
                                                    <h4 className="text-sm font-bold text-white line-clamp-1">{video.title}</h4>
                                                </div>
                                                <p className="text-xs text-zinc-500">por {video.promoterName}</p>
                                            </div>

                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-emerald-400 font-bold text-sm">
                                                        +{video.viewerEarning.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {video.minWatchSeconds}s
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => startWatching(video)}
                                                    className="bg-primary-500 hover:bg-primary-400 text-black px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                                >
                                                    Assistir <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
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
                                <div key={campaign.id} className="bg-surface border border-surfaceHighlight rounded-2xl p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-white">{campaign.title}</h4>
                                            <p className="text-xs text-zinc-500">{campaign.platform}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${campaign.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                                            {campaign.status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                                        <div className="bg-background rounded-lg p-2">
                                            <p className="text-[10px] text-zinc-500">Views</p>
                                            <p className="font-bold text-white">{campaign.totalViews}</p>
                                        </div>
                                        <div className="bg-background rounded-lg p-2">
                                            <p className="text-[10px] text-zinc-500">Gasto</p>
                                            <p className="font-bold text-white">{campaign.spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                        <div className="bg-background rounded-lg p-2">
                                            <p className="text-[10px] text-zinc-500">Restante</p>
                                            <p className="font-bold text-emerald-400">{campaign.remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                    </div>

                                    <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                            style={{ width: `${Math.min(100, (campaign.totalViews / campaign.targetViews) * 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-1 text-center">
                                        {campaign.totalViews} / {campaign.targetViews} views ({((campaign.totalViews / campaign.targetViews) * 100).toFixed(0)}%)
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Assistir Vídeo */}
            {watchingVideo && (
                <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-lg">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">{watchingVideo.title}</h3>
                            <button onClick={cancelWatch} className="text-zinc-500 hover:text-white">
                                <XIcon size={24} />
                            </button>
                        </div>

                        {/* Video Placeholder / Embed */}
                        <div className="aspect-video bg-zinc-900 rounded-xl overflow-hidden mb-4 relative">
                            {watchingVideo.platform === 'YOUTUBE' && getVideoId(watchingVideo.videoUrl) ? (
                                <iframe
                                    src={`https://www.youtube.com/embed/${getVideoId(watchingVideo.videoUrl)}?autoplay=1`}
                                    className="w-full h-full"
                                    allow="autoplay; encrypted-media"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <a
                                        href={watchingVideo.videoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-primary-500 text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2"
                                    >
                                        <ExternalLink size={20} /> Abrir Vídeo
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Progress */}
                        <div className="bg-surface border border-surfaceHighlight rounded-xl p-4 mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-zinc-400">Progresso</span>
                                <span className="text-sm font-bold text-white">
                                    {watchProgress}s / {watchingVideo.minWatchSeconds}s
                                </span>
                            </div>
                            <div className="w-full bg-background rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full transition-all ${watchProgress >= watchingVideo.minWatchSeconds ? 'bg-emerald-500' : 'bg-primary-500'}`}
                                    style={{ width: `${Math.min(100, (watchProgress / watchingVideo.minWatchSeconds) * 100)}%` }}
                                />
                            </div>

                            {watchProgress >= watchingVideo.minWatchSeconds ? (
                                <div className="mt-4">
                                    <p className="text-emerald-400 text-sm text-center mb-3 flex items-center justify-center gap-2">
                                        <CheckCircle2 size={16} /> Tempo mínimo atingido!
                                    </p>
                                    <button
                                        onClick={completeWatch}
                                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl transition"
                                    >
                                        Resgatar {watchingVideo.viewerEarning.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-500 text-center mt-3">
                                    Continue assistindo para liberar o ganho...
                                </p>
                            )}
                        </div>

                        {/* Legal */}
                        <p className="text-[9px] text-zinc-600 text-center">
                            O conteúdo do vídeo é de responsabilidade do anunciante. O Cred30 apenas intermedia a visualização.
                        </p>
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
        durationSeconds: 60,
        pricePerView: 0.05,
        minWatchSeconds: 30,
        budget: 10,
        targetViews: 200,
        dailyLimit: 100,
    });

    // Taxas do Asaas (mesmas do backend)
    const ASAAS_PIX_FIXED_FEE = 0.99;
    const ASAAS_CARD_FEE_PERCENT = 0.0299;
    const ASAAS_CARD_FIXED_FEE = 0.49;

    const estimatedViews = Math.floor(form.budget / form.pricePerView);
    const viewerEarning = form.pricePerView * 0.60; // 60% para quem assiste
    const quotaHoldersShare = form.pricePerView * 0.25; // 25% para quem tem cotas
    const serviceFee = form.pricePerView * 0.15; // 15% taxa de serviço

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
                // Se for PIX, precisa mostrar o QR Code
                if (paymentMethod === 'PIX' && (res.data as any)?.pixCopiaECola) {
                    // TODO: Abrir modal PIX
                    onSuccess();
                } else {
                    onSuccess();
                }
            } else {
                onError('Erro', res.message);
            }
        } catch (e: any) {
            onError('Erro', e.message);
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-md my-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Nova Campanha de Vídeo</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <XIcon size={24} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Título da Campanha *</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            placeholder="Ex: Veja meu novo vídeo!"
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">URL do Vídeo *</label>
                        <input
                            type="url"
                            value={form.videoUrl}
                            onChange={e => setForm({ ...form, videoUrl: e.target.value })}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Plataforma</label>
                            <select
                                value={form.platform}
                                onChange={e => setForm({ ...form, platform: e.target.value })}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white"
                            >
                                <option value="YOUTUBE">YouTube</option>
                                <option value="TIKTOK">TikTok</option>
                                <option value="INSTAGRAM">Instagram</option>
                                <option value="KWAI">Kwai</option>
                                <option value="OTHER">Outro</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Tempo Mínimo (s)</label>
                            <input
                                type="number"
                                value={form.minWatchSeconds}
                                onChange={e => setForm({ ...form, minWatchSeconds: Number(e.target.value) })}
                                min={5}
                                max={300}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Preço por View (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.pricePerView}
                                onChange={e => setForm({ ...form, pricePerView: Number(e.target.value) })}
                                min={0.01}
                                max={10}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Orçamento Total (R$)</label>
                            <input
                                type="number"
                                value={form.budget}
                                onChange={e => setForm({ ...form, budget: Number(e.target.value) })}
                                min={5}
                                className="w-full bg-background border border-surfaceHighlight rounded-xl py-3 px-4 text-white"
                            />
                        </div>
                    </div>

                    {/* Método de Pagamento */}
                    <div>
                        <label className="text-xs text-zinc-400 block mb-2">Método de Pagamento</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('BALANCE')}
                                className={`py-3 rounded-xl font-bold text-sm transition border ${paymentMethod === 'BALANCE'
                                    ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                                    : 'bg-background border-surfaceHighlight text-zinc-400 hover:border-zinc-500'}`}
                            >
                                💰 Saldo
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('PIX')}
                                className={`py-3 rounded-xl font-bold text-sm transition border ${paymentMethod === 'PIX'
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                    : 'bg-background border-surfaceHighlight text-zinc-400 hover:border-zinc-500'}`}
                            >
                                📱 PIX
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('CARD')}
                                className={`py-3 rounded-xl font-bold text-sm transition border ${paymentMethod === 'CARD'
                                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                    : 'bg-background border-surfaceHighlight text-zinc-400 hover:border-zinc-500'}`}
                            >
                                💳 Cartão
                            </button>
                        </div>
                        {paymentMethod === 'BALANCE' && (
                            <p className="text-[10px] text-zinc-500 mt-2">Seu saldo: {userBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-purple-400 mb-2">Resumo da Campanha</h4>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Views Estimadas</span>
                                <span className="text-white font-bold">~{estimatedViews} views</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Cada Viewer Ganha (60%)</span>
                                <span className="text-emerald-400 font-bold">{viewerEarning.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Quem tem Cotas (25%)</span>
                                <span className="text-blue-400 font-bold">{quotaHoldersShare.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Taxa Serviço (15%)</span>
                                <span className="text-zinc-500">{serviceFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            {paymentMethod !== 'BALANCE' && (
                                <>
                                    <div className="border-t border-zinc-700 my-2" />
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Taxa {paymentMethod === 'PIX' ? 'PIX' : 'Cartão'}</span>
                                        <span className="text-orange-400">{gatewayFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-base">
                                        <span className="text-white">Total a Pagar</span>
                                        <span className="text-white">{totalToPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {paymentMethod === 'BALANCE' && form.budget > userBalance && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-400" />
                            <span className="text-red-400 text-sm">Saldo insuficiente. Você tem R$ {userBalance.toFixed(2)}</span>
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={loading || (paymentMethod === 'BALANCE' && form.budget > userBalance)}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><Loader2 className="animate-spin" size={20} /> Criando...</>
                        ) : paymentMethod === 'BALANCE' ? (
                            <>Criar Campanha por {form.budget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</>
                        ) : (
                            <>Pagar {totalToPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} via {paymentMethod}</>
                        )}
                    </button>
                </div>

                <p className="text-[9px] text-zinc-600 text-center mt-4">
                    Ao criar uma campanha, você concorda que o conteúdo do vídeo é de sua responsabilidade e não viola nossos Termos de Uso.
                </p>
            </div>
        </div>
    );
};

export default PromoVideosView;
