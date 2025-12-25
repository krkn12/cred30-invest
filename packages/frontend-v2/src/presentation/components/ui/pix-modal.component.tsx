
import React from 'react';
import { QrCode, Copy, X as XIcon, CheckCircle2 } from 'lucide-react';

interface PIXModalProps {
    isOpen: boolean;
    onClose: () => void;
    qrCode: string;
    qrCodeBase64: string;
    amount: number;
    description: string;
}

export const PIXModal: React.FC<PIXModalProps> = ({
    isOpen,
    onClose,
    qrCode,
    qrCodeBase64,
    amount,
    description
}) => {
    const [copied, setCopied] = React.useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(qrCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[300] p-4 animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-surface border border-surfaceHighlight rounded-3xl p-6 w-full max-w-sm relative animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto flex flex-col items-stretch">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <QrCode className="text-emerald-400" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Pagamento PIX</h3>
                    <p className="text-zinc-400 text-sm mt-1">{description}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl mb-6 shadow-xl max-w-[200px] mx-auto w-full">
                    <img
                        src={`data:image/png;base64,${qrCodeBase64}`}
                        alt="QR Code PIX"
                        className="w-full aspect-square rounded-lg"
                    />
                </div>

                <div className="space-y-4">
                    <div className="bg-background border border-surfaceHighlight rounded-xl p-4">
                        <div className="flex justify-between text-xs text-zinc-500 mb-1 uppercase font-bold tracking-wider">
                            <span>Valor a Pagar</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                    </div>

                    <button
                        onClick={handleCopy}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${copied
                            ? 'bg-emerald-500 text-black'
                            : 'bg-primary-500 hover:bg-primary-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                            }`}
                    >
                        {copied ? (
                            <>
                                <CheckCircle2 size={18} />
                                Copiado com Sucesso!
                            </>
                        ) : (
                            <>
                                <Copy size={18} />
                                Copiar Código PIX
                            </>
                        )}
                    </button>

                    <p className="text-[11px] text-zinc-500 text-center leading-relaxed bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                        O sistema identificará o pagamento automaticamente em instantes.
                    </p>

                    <p className="text-[9px] text-zinc-600 text-center leading-relaxed mt-2">
                        Pagamento processado via gateway Asaas. O Cred30 não armazena dados bancários.
                    </p>

                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all shadow-lg mt-2"
                    >
                        Fechar Janela
                    </button>
                </div>
            </div>
        </div>
    );
};
