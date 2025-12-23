
import React, { useState, useEffect } from 'react';
import { CreditCard, X as XIcon, Loader2, ShieldCheck, MapPin, Phone, User as UserIcon } from 'lucide-react';

interface CardModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: number;
    userEmail: string;
    currentUser?: any;
    onSubmit: (formData: any) => Promise<void>;
}

export const CardModal: React.FC<CardModalProps> = ({
    isOpen,
    onClose,
    amount,
    userEmail,
    currentUser,
    onSubmit
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Card Data
    const [cardNumber, setCardNumber] = useState('');
    const [holderName, setHolderName] = useState('');
    const [expiry, setExpiry] = useState(''); // MM/YY
    const [cvv, setCvv] = useState('');
    const [installments, setInstallments] = useState('1');

    // Holder Info
    const [cpf, setCpf] = useState(currentUser?.cpf || '');
    const [postalCode, setPostalCode] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        if (currentUser?.cpf && !cpf) {
            setCpf(currentUser.cpf);
        }
    }, [currentUser, isOpen]);

    if (!isOpen) return null;

    const formatCardNumber = (value: string) => {
        const v = value.replace(/\D/g, '').substring(0, 16);
        const parts = v.match(/.{1,4}/g) || [];
        return parts.join(' ');
    };

    const formatExpiry = (value: string) => {
        const v = value.replace(/\D/g, '').substring(0, 4);
        if (v.length > 2) return `${v.substring(0, 2)}/${v.substring(2)}`;
        return v;
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const [expiryMonth, expiryYear] = expiry.split('/');

            const formData = {
                creditCard: {
                    holderName,
                    number: cardNumber.replace(/\D/g, ''),
                    expiryMonth,
                    expiryYear: `20${expiryYear}`,
                    ccv: cvv,
                },
                creditCardHolderInfo: {
                    name: holderName,
                    email: userEmail,
                    cpfCnpj: cpf.replace(/\D/g, ''),
                    postalCode: postalCode.replace(/\D/g, ''),
                    addressNumber,
                    phone: phone.replace(/\D/g, ''),
                },
                installments: parseInt(installments)
            };

            await onSubmit(formData);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erro ao processar pagamento');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[250] p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget && !loading) onClose();
            }}
        >
            <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-5 sm:p-8 w-full max-w-lg relative animate-in zoom-in duration-300 my-auto shadow-[0_0_50px_rgba(0,0,0,1)]">
                <button
                    onClick={onClose}
                    disabled={loading}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-800 p-2 rounded-full transition-all z-[260]"
                >
                    <XIcon size={20} />
                </button>

                <div className="text-center mb-6 pt-2">
                    <div className="w-14 h-14 bg-primary-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-primary-500/20">
                        <CreditCard className="text-primary-400" size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Checkout Seguro</h3>
                    <p className="text-zinc-500 text-xs mt-1 uppercase font-black tracking-widest">Powered by Asaas</p>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 mb-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Total do Pagamento</p>
                        <p className="text-2xl font-black text-primary-400">
                            {amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                    <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl flex items-center gap-2">
                        <ShieldCheck size={20} />
                        <span className="text-[9px] font-black uppercase tracking-tighter">SSL <br />Encrypted</span>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-xs mb-6 animate-in slide-in-from-top-2">
                        {error}
                    </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-5">
                    {/* Card Preview Simulation Style */}
                    <div className="space-y-4">
                        {/* Payment Flags & Badges */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-2 px-1">
                            <div className="flex items-center gap-2">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/Visa_Logo.png" alt="Visa" className="h-4 object-contain" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-4 object-contain" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/f/f1/Elo_logo.png" alt="Elo" className="h-4 object-contain bg-white rounded-sm px-0.5" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_%282018%29.svg" alt="Amex" className="h-4 object-contain" />
                            </div>
                            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1">
                                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Processado por</span>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                    <span className="text-[10px] font-black text-white tracking-tighter">asaas</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1 mb-1 block" htmlFor="cardNumber">Número do Cartão</label>
                            <div className="relative">
                                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                <input
                                    id="cardNumber"
                                    name="cardNumber"
                                    autoComplete="cc-number"
                                    type="text"
                                    required
                                    placeholder="0000 0000 0000 0000"
                                    value={cardNumber}
                                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-4 text-white focus:border-primary-500 outline-none transition-all placeholder:text-zinc-700"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1 mb-1 block" htmlFor="cardName">Nome como no cartão</label>
                            <div className="relative">
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                <input
                                    id="cardName"
                                    name="cardName"
                                    autoComplete="cc-name"
                                    type="text"
                                    required
                                    placeholder="NOME COMPLETO"
                                    value={holderName}
                                    onChange={(e) => setHolderName(e.target.value.toUpperCase())}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-4 text-white focus:border-primary-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1 mb-1 block" htmlFor="cardExpiry">Validade (MM/YY)</label>
                                <input
                                    id="cardExpiry"
                                    name="cardExpiry"
                                    autoComplete="cc-exp"
                                    type="text"
                                    required
                                    placeholder="MM/YY"
                                    value={expiry}
                                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 px-4 text-white focus:border-primary-500 outline-none transition-all text-center"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1 mb-1 block" htmlFor="cardCvv">CVV</label>
                                <input
                                    id="cardCvv"
                                    name="cardCvv"
                                    autoComplete="cc-csc"
                                    type="text"
                                    required
                                    placeholder="000"
                                    maxLength={4}
                                    value={cvv}
                                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 px-4 text-white focus:border-primary-500 outline-none transition-all text-center"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-zinc-900">
                            <h4 className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] mb-4 text-center">Dados de Cobrança</h4>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1 mb-1 block" htmlFor="holderCpf">CPF do Titular</label>
                                    <input
                                        id="holderCpf"
                                        name="holderCpf"
                                        type="text"
                                        required
                                        placeholder="000.000.000-00"
                                        value={cpf}
                                        onChange={(e) => setCpf(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1 mb-1 block" htmlFor="billingZip">CEP</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                                        <input
                                            id="billingZip"
                                            name="billingZip"
                                            autoComplete="postal-code"
                                            type="text"
                                            required
                                            placeholder="00000-000"
                                            value={postalCode}
                                            onChange={(e) => setPostalCode(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-9 pr-4 text-white focus:border-primary-500 outline-none transition-all text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1 mb-1 block" htmlFor="addressNumber">Nº</label>
                                    <input
                                        id="addressNumber"
                                        name="addressNumber"
                                        type="text"
                                        required
                                        placeholder="123"
                                        value={addressNumber}
                                        onChange={(e) => setAddressNumber(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:border-primary-500 outline-none transition-all text-sm"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1 mb-1 block" htmlFor="contactPhone">Celular com DDD</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                                        <input
                                            id="contactPhone"
                                            name="contactPhone"
                                            autoComplete="tel"
                                            type="tel"
                                            required
                                            placeholder="(00) 00000-0000"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-9 pr-4 text-white focus:border-primary-500 outline-none transition-all text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black rounded-2xl transition-all shadow-lg shadow-primary-500/10 flex items-center justify-center gap-3 uppercase tracking-widest text-sm active:scale-[0.98]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Processando...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={20} />
                                    Confirmar Pagamento
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <p className="text-[9px] text-zinc-600 text-center mt-6 leading-relaxed uppercase font-bold tracking-tight">
                    Pagamento Transparente Asaas. <br />
                    Ambiente 100% criptografado e seguro.
                </p>
            </div>
        </div>
    );
};
