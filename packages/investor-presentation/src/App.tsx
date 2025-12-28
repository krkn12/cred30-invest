import React, { useState, useEffect } from 'react';
import {
    ArrowRight, Shield, TrendingUp, Zap, Star, Users,
    BarChart3, Globe, Rocket, ShieldCheck, Target,
    ChevronRight, Download, Mail, PieChart, Coins
} from 'lucide-react';
import { motion } from 'framer-motion';

const App = () => {
    const [activeTab, setActiveTab] = useState('problem');

    const stats = [
        { label: "Mercado Endereçável", value: "R$ 450B", icon: <Globe size={20} /> },
        { label: "Crescimento MoM", value: "25%", icon: <TrendingUp size={20} /> },
        { label: "Retenção", value: "92%", icon: <Users size={20} /> },
        { label: "ROI Médio", value: "18%", icon: <BarChart3 size={20} /> }
    ];

    const roadmap = [
        { phase: "Q1 2025", title: "Lançamento V2", desc: "Nova infraestrutura escalável e marketplace de cotas." },
        { phase: "Q2 2025", title: "Expansão Nacional", desc: "Operação em todas as capitais brasileiras." },
        { phase: "Q3 2025", title: "Cred30 Card", desc: "Cartão de crédito próprio vinculado ao capital social." },
        { phase: "Q4 2025", title: "Série A", desc: "Rodada de captação para escala internacional." }
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
            {/* Background Aurora */}
            <div className="fixed inset-0 pointer-events-none opacity-40">
                <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-cyan-500/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[150px] rounded-full" />
            </div>

            {/* Nav */}
            <nav className="fixed top-0 inset-x-0 z-50 p-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center bg-zinc-900/40 backdrop-blur-2xl border border-white/5 p-4 rounded-3xl shadow-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <Rocket size={20} className="text-black" />
                        </div>
                        <span className="text-2xl font-black tracking-tighter">Cred<span className="text-cyan-400">30</span><span className="text-xs uppercase ml-2 text-zinc-500 tracking-widest font-bold">Invest</span></span>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#vision" className="text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Visão</a>
                        <a href="#metrics" className="text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Métricas</a>
                        <a href="#roadmap" className="text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Roadmap</a>
                    </div>

                    <button className="bg-white text-black text-xs font-black uppercase tracking-widest px-6 py-3 rounded-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                        Pitch Deck <Download size={14} />
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section id="vision" className="relative pt-48 pb-24 px-6">
                <div className="max-w-7xl mx-auto text-center space-y-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 px-6 py-2 rounded-full text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em]"
                    >
                        <Star size={12} className="fill-cyan-400" /> Shaping the Future of Micro-Finance
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-6xl md:text-9xl font-black tracking-tighter leading-[0.85] text-white"
                    >
                        DEMOCRATIZANDO O <br />
                        <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent italic">CAPITAL SOCIAL.</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed border-l-2 border-cyan-500/30 pl-8"
                    >
                        O Cred30 é uma plataforma de microcrédito e apoio mútuo baseada em tecnologia peer-to-peer que está revolucionando a economia colaborativa no Brasil.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12"
                    >
                        {stats.map((stat, i) => (
                            <div key={i} className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2rem] text-left group hover:border-cyan-500/30 transition-all">
                                <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
                                    {stat.icon}
                                </div>
                                <p className="text-3xl font-black mb-1">{stat.value}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{stat.label}</p>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* The Problem & Solution */}
            <section className="py-24 px-6 bg-zinc-950/50 border-y border-white/5">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-20">
                    <div className="flex-1 space-y-8">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
                            O Problema é a <span className="text-zinc-600">Exclusão</span>. <br />
                            Nossa Solução é a <span className="text-cyan-400">União</span>.
                        </h2>

                        <div className="space-y-4">
                            <div
                                className={`p-6 rounded-3xl cursor-pointer transition-all border ${activeTab === 'problem' ? 'bg-zinc-900 border-white/10' : 'border-transparent opacity-50'}`}
                                onMouseEnter={() => setActiveTab('problem')}
                            >
                                <h3 className="text-xl font-bold mb-2 flex items-center gap-3">
                                    <PieChart size={20} className="text-red-500" />
                                    Burocracia & Juros Altos
                                </h3>
                                <p className="text-sm text-zinc-400">Bancos tradicionais excluem 40% da população economicamente ativa por falta de score ou garantias.</p>
                            </div>

                            <div
                                className={`p-6 rounded-3xl cursor-pointer transition-all border ${activeTab === 'solution' ? 'bg-zinc-900 border-white/10' : 'border-transparent opacity-50'}`}
                                onMouseEnter={() => setActiveTab('solution')}
                            >
                                <h3 className="text-xl font-bold mb-2 flex items-center gap-3">
                                    <ShieldCheck size={20} className="text-emerald-500" />
                                    P2P Social Credit
                                </h3>
                                <p className="text-sm text-zinc-400">Utilizamos o capital da própria comunidade para remunerar quem investe e apoiar quem precisa, com taxas 70% menores.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 relative lg:block hidden">
                        <div className="absolute inset-0 bg-cyan-500/5 blur-[100px] rounded-full" />
                        <div className="relative z-10 bg-zinc-900 border border-white/10 rounded-[3rem] p-10 h-full overflow-hidden">
                            <div className="flex justify-between mb-8">
                                <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
                                <div className="flex gap-1">
                                    {[1, 2, 3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-zinc-800" />)}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="h-4 w-3/4 bg-zinc-800 rounded-full" />
                                <div className="h-4 w-1/2 bg-zinc-800 rounded-full" />
                                <div className="grid grid-cols-2 gap-4 py-8">
                                    <div className="aspect-square bg-cyan-500/20 rounded-3xl border border-cyan-500/30 flex items-center justify-center">
                                        <Coins size={40} className="text-cyan-400" />
                                    </div>
                                    <div className="aspect-square bg-zinc-800 rounded-3xl" />
                                </div>
                                <div className="h-12 w-full bg-cyan-500 rounded-2xl" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Traction & Roadmap */}
            <section id="roadmap" className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-end mb-16">
                        <div>
                            <p className="text-cyan-400 text-xs font-black uppercase tracking-widest mb-4">Milestones</p>
                            <h2 className="text-4xl md:text-5xl font-black">Nosso Caminho para o <span className="italic">Bilhão</span>.</h2>
                        </div>
                        <div className="hidden md:flex gap-4">
                            <button className="p-4 bg-zinc-900 rounded-full border border-white/5"><Mail size={20} /></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {roadmap.map((step, i) => (
                            <div key={i} className="relative group">
                                <div className="absolute -top-4 -left-4 text-6xl font-black text-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {i + 1}
                                </div>
                                <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2rem] hover:bg-zinc-900 transition-all h-full">
                                    <p className="text-cyan-400 font-bold mb-4">{step.phase}</p>
                                    <h3 className="text-xl font-bold mb-4">{step.title}</h3>
                                    <p className="text-sm text-zinc-500 leading-relaxed">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Investor */}
            <section className="py-32 px-6">
                <div className="max-w-5xl mx-auto rounded-[4rem] bg-gradient-to-br from-cyan-500 to-blue-600 p-12 md:p-24 text-center relative overflow-hidden shadow-2xl shadow-cyan-500/20">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent opacity-50" />

                    <div className="relative z-10 space-y-8">
                        <h2 className="text-5xl md:text-7xl font-black text-black tracking-tighter leading-none">
                            VAMOS ESCALAR <br />
                            ESSA REVOLUÇÃO?
                        </h2>
                        <p className="text-black/70 text-lg font-bold max-w-xl mx-auto">
                            Estamos selecionando parceiros estratégicos para a rodada Early Stage.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                            <button className="bg-black text-white px-10 py-5 rounded-3xl font-black uppercase tracking-widest text-lg hover:scale-105 active:scale-95 transition-all">
                                Falar com Founders
                            </button>
                            <button className="bg-white/20 backdrop-blur-md border border-white/30 text-black px-10 py-5 rounded-3xl font-black uppercase tracking-widest text-lg">
                                Fazer Download deck
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="py-20 px-6 border-t border-white/5 text-center">
                <p className="text-zinc-600 text-xs font-black uppercase tracking-[0.4em]">© 2025 Cred30 Technologies • Confidential & Proprietary</p>
            </footer>
        </div>
    );
};

export default App;
