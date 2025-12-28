import React, { useState, useEffect } from 'react';
import {
    ArrowRight, Shield, PiggyBank, CreditCard, Download,
    Smartphone, X as XIcon, ChevronDown, Rocket,
    Star, Zap, Users, ShieldCheck, TrendingUp, Globe
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const features = [
        {
            icon: <Zap className="text-yellow-400" size={24} />,
            title: "Rápido & Ágil",
            description: "Acesso imediato a recursos financeiros quando você mais precisa."
        },
        {
            icon: <ShieldCheck className="text-emerald-400" size={24} />,
            title: "100% Seguro",
            description: "Tecnologia de ponta para garantir a segurança dos seus dados."
        },
        {
            icon: <TrendingUp className="text-cyan-400" size={24} />,
            title: "Crescimento Mútuo",
            description: "Participe de uma rede que valoriza o crescimento coletivo."
        }
    ];

    const testimonials = [
        {
            name: "João Silva",
            role: "Empreendedor",
            content: "O Cred30 mudou a forma como eu gerencio meu capital de giro. É rápido e transparente.",
            rating: 5
        },
        {
            name: "Maria Oliveira",
            role: "Freelancer",
            content: "A melhor plataforma de apoio financeiro que já utilizei. O sistema de convites é excelente.",
            rating: 5
        }
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-primary-500/30 overflow-x-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary-500/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full" />
            </div>

            {/* Navigation */}
            <nav className={`fixed top-0 inset-x-0 z-50 px-6 py-6 transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
                <div className="max-w-7xl mx-auto flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-4 rounded-3xl shadow-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                            <img src="/pwa-192x192.png" alt="Cred30" className="w-8 h-8 rounded-lg" />
                        </div>
                        <span className="text-2xl font-black tracking-tighter">Cred<span className="text-primary-400">30</span></span>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors">Funcionalidades</a>
                        <a href="#how-it-works" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors">Como Funciona</a>
                        <a href="#testimonials" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors">Depoimentos</a>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/auth')} className="text-sm font-bold text-zinc-400 hover:text-white transition-colors px-4">
                            Login
                        </button>
                        <button
                            onClick={() => navigate('/auth')}
                            className="bg-primary-500 text-black font-black px-6 py-3 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary-500/20 text-sm uppercase tracking-wider"
                        >
                            Começar Agora
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-40 pb-20 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className={`space-y-8 transition-all duration-1000 delay-300 ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-20 opacity-0'}`}>
                        <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 px-4 py-2 rounded-full text-primary-400 text-xs font-black uppercase tracking-widest">
                            <Star size={14} className="fill-primary-400" /> O Futuro do Microcrédito
                        </div>

                        <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-[0.9] text-white">
                            Sua <span className="text-primary-400">Liberdade</span> <br />
                            Financeira Começa <br />
                            <span className="relative">
                                Aqui.
                                <div className="absolute bottom-2 left-0 w-full h-3 bg-primary-500/30 -z-10" />
                            </span>
                        </h1>

                        <p className="text-xl text-zinc-400 max-w-xl leading-relaxed">
                            Junte-se à maior comunidade de apoio mútuo do Brasil. Tecnologia, transparência e agilidade para você crescer.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => navigate('/auth')}
                                className="group bg-white text-black font-black py-5 px-10 rounded-3xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 text-lg"
                            >
                                Criar Conta Grátis
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </button>

                            <button className="bg-zinc-900 border border-white/5 text-white font-bold py-5 px-10 rounded-3xl transition-all hover:bg-zinc-800 flex items-center justify-center gap-3 text-lg">
                                <Download size={20} className="text-primary-400" />
                                Baixar App
                            </button>
                        </div>

                        <div className="flex items-center gap-6 pt-4">
                            <div className="flex -space-x-3">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="w-10 h-10 rounded-full border-2 border-[#050505] bg-zinc-800" />
                                ))}
                            </div>
                            <p className="text-sm text-zinc-500 font-medium">
                                <span className="text-white font-bold">+10k membros</span> ativos em todo o Brasil
                            </p>
                        </div>
                    </div>

                    <div className={`relative transition-all duration-1000 delay-500 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0'}`}>
                        <div className="relative z-10 bg-gradient-to-br from-zinc-800 to-zinc-950 p-4 rounded-[3rem] border border-white/10 shadow-3xl">
                            <div className="aspect-[9/16] bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-white/5 relative">
                                {/* Mock UI */}
                                <div className="absolute inset-0 p-6 space-y-6">
                                    <div className="flex justify-between items-center">
                                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
                                        <div className="w-8 h-8 bg-primary-500/20 rounded-xl" />
                                    </div>
                                    <div className="h-32 bg-primary-500 rounded-3xl p-6 flex flex-col justify-end">
                                        <p className="text-[10px] uppercase font-black opacity-60">Meu Saldo</p>
                                        <p className="text-2xl font-black italic">R$ 15.250,00</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="h-24 bg-zinc-800/50 rounded-2xl border border-white/5" />
                                        <div className="h-24 bg-zinc-800/50 rounded-2xl border border-white/5" />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="h-4 w-1/2 bg-zinc-800 rounded-full" />
                                        <div className="h-20 bg-zinc-800/30 rounded-2xl" />
                                        <div className="h-20 bg-zinc-800/30 rounded-2xl" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Decoration */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-primary-500/5 blur-[100px] -z-10 rounded-full" />
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 px-6 bg-zinc-900/30">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-4xl md:text-5xl font-black mb-6">Tudo que você precisa em um só <span className="text-primary-400">lugar</span>.</h2>
                        <p className="text-zinc-400 text-lg">Desenvolvido para oferecer a melhor experiência financeira digital para comunidades.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {features.map((feature, idx) => (
                            <div key={idx} className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2rem] hover:border-primary-500/30 transition-all duration-500 group">
                                <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                                <p className="text-zinc-400 leading-relaxed font-medium">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section id="testimonials" className="py-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
                        <div className="max-w-2xl">
                            <h2 className="text-4xl md:text-5xl font-black mb-6">A confiança de quem já faz parte do <span className="text-primary-400">clube</span>.</h2>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-12 h-12 bg-zinc-900 rounded-full border border-white/5" />
                            <div className="w-12 h-12 bg-zinc-900 rounded-full border border-white/5" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {testimonials.map((t, idx) => (
                            <div key={idx} className="bg-gradient-to-br from-zinc-900 to-black p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <Star size={100} />
                                </div>
                                <div className="flex gap-1 mb-6 text-yellow-500">
                                    {[...Array(t.rating)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                                </div>
                                <p className="text-xl text-zinc-300 italic mb-8 relative z-10">"{t.content}"</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-zinc-800 rounded-full" />
                                    <div>
                                        <h4 className="font-bold">{t.name}</h4>
                                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-black">{t.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-primary-500 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl shadow-primary-500/20">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent opacity-50" />

                        <h2 className="text-4xl md:text-6xl font-black text-black mb-8 relative z-10">
                            Pronto para transformar sua vida <br className="hidden md:block" /> financeira hoje?
                        </h2>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
                            <button
                                onClick={() => navigate('/auth')}
                                className="bg-black text-white font-black py-5 px-10 rounded-2xl transition-all hover:scale-105 active:scale-95 text-xl"
                            >
                                Criar Minha Conta
                            </button>
                            <button className="bg-white/20 backdrop-blur-md border border-white/30 text-black font-bold py-5 px-10 rounded-2xl transition-all hover:bg-white/30 text-xl">
                                Falar com Especialista
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 px-6 border-t border-white/5">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                    <div className="col-span-1 md:col-span-2 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-black">
                                <Rocket size={16} />
                            </div>
                            <span className="text-xl font-black tracking-tighter">Cred<span className="text-primary-400">30</span></span>
                        </div>
                        <p className="text-zinc-500 max-w-sm font-medium">
                            Transformando o acesso ao crédito no Brasil através da tecnologia e união comunitária.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-sm uppercase tracking-widest text-zinc-400">Legal</h4>
                        <ul className="space-y-2 text-zinc-500 font-medium">
                            <li><button onClick={() => navigate('/terms')} className="hover:text-primary-400 transition-colors">Termos de Uso</button></li>
                            <li><button onClick={() => navigate('/privacy')} className="hover:text-primary-400 transition-colors">Privacidade</button></li>
                            <li><button onClick={() => navigate('/security')} className="hover:text-primary-400 transition-colors">Segurança</button></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-sm uppercase tracking-widest text-zinc-400">Social</h4>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-center text-zinc-400 hover:text-primary-400 transition-colors cursor-pointer">
                                <Globe size={18} />
                            </div>
                            <div className="w-10 h-10 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-center text-zinc-400 hover:text-primary-400 transition-colors cursor-pointer">
                                <Users size={18} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.2em]">
                        © 2025 Cred30 Tecnologia S.A.
                    </p>
                    <div className="flex items-center gap-2 text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                        <Shield size={12} /> Proteção de dados garantida
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
