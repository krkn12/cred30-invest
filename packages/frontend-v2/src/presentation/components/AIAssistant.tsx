import React, { useState, useEffect, useRef } from 'react';
import { User, MessageSquare, X, Send, Star } from 'lucide-react';
import { apiService } from '../../application/services/api.service';

interface AIAssistantProps {
  appState: any;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ appState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatStatus, setChatStatus] = useState<'AI_ONLY' | 'PENDING_HUMAN' | 'ACTIVE_HUMAN' | 'CLOSED'>('AI_ONLY');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadHistory = async () => {
    try {
      const data = await apiService.getChatHistory();
      if (data && data.messages) {
        setMessages(data.messages);
        setChatStatus(data.chat.status);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Polling para atualizar mensagens (A cada 5s se estiver aberto)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen && chatStatus !== 'CLOSED') {
      loadHistory();
      interval = setInterval(loadHistory, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, chatStatus]);

  const handleSend = async (manualContent?: string) => {
    const contentToSend = manualContent || message;
    if (!contentToSend.trim() || isLoading) return;

    if (chatStatus === 'CLOSED') {
      alert('Este atendimento foi encerrado.');
      return;
    }

    const userContent = contentToSend;
    setMessage('');
    setIsLoading(true);

    // Otimismo: adicionar mensagem do usuário na UI
    setMessages(prev => [...prev, { role: 'user', content: userContent }]);

    try {
      const result = await apiService.sendChatMessage(userContent);
      if (result.success) {
        if (result.aiMessage) {
          setMessages(prev => [...prev, result.aiMessage]);
        }
        setChatStatus(result.chatStatus);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEscalate = async () => {
    try {
      setIsLoading(true);
      await apiService.escalateChat();
      setChatStatus('PENDING_HUMAN');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Solicitação de atendimento humano enviada! Um atendente irá falar com você em breve nesta mesma conversa.'
      }]);
    } catch (error) {
      console.error('Erro ao escalonar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendFeedback = async () => {
    if (feedbackRating === 0) return;
    try {
      // Como o endpoint espera o chat ID, e nesta view simplificada pegamos o chat atual implicitamente
      // precisamos do ID do chat.
      const chatData = await apiService.getChatHistory();
      if (chatData?.chat?.id) {
        await apiService.sendSupportFeedback(chatData.chat.id, feedbackRating, feedbackComment);
        setFeedbackSent(true);
        // Resetar após alguns segundos para permitir novo chat futuramente?
        // Ou apenas dizer "Obrigado"
      }
    } catch (error) {
      console.error('Erro ao enviar feedback', error);
    }
  };

  const EDY_AVATAR = "https://randomuser.me/api/portraits/men/62.jpg";

  return (
    <div className="fixed bottom-[180px] right-4 md:bottom-6 md:right-6 z-[150] print:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-primary-500 hover:bg-primary-400 text-black p-0 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center w-14 h-14 overflow-hidden border-2 border-primary-400`}
        title="Falar com o Edy"
      >
        {isOpen ? <X size={24} /> : (
          <div className="relative w-full h-full">
            <img src={EDY_AVATAR} alt="Edy" className="w-full h-full object-cover" />
            <span className="absolute bottom-1 right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-primary-500"></span>
            </span>
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[calc(100vw-2rem)] md:w-96 bg-surface border border-surfaceHighlight rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh] md:max-h-[500px] animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex justify-between items-center p-4 border-b border-surfaceHighlight bg-surfaceAccent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center border border-primary-500/30 overflow-hidden">
                <img src={EDY_AVATAR} alt="Edy" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-white font-bold flex items-center gap-2">
                  Edy
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${chatStatus === 'CLOSED' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                    {chatStatus === 'CLOSED' ? 'Offline' : 'Online'}
                  </span>
                </h3>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest">
                  {chatStatus === 'AI_ONLY' ? 'Assistente Virtual' : chatStatus === 'CLOSED' ? 'Atendimento Encerrado' : 'Atendimento Humano'}
                </p>
              </div>
            </div>
            {chatStatus === 'AI_ONLY' && (
              <button
                onClick={handleEscalate}
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded border border-zinc-700 transition"
              >
                Falar com Humano
              </button>
            )}
            {chatStatus === 'PENDING_HUMAN' && (
              <button
                onClick={() => handleSend('cancelar')}
                className="text-[10px] bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded border border-red-900/50 transition border-dashed"
              >
                Cancelar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-zinc-400 py-8 px-4">
                <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700 overflow-hidden shadow-lg shadow-black/50">
                  <img src={EDY_AVATAR} alt="Edy" className="w-full h-full object-cover" />
                </div>
                <p className="text-lg mb-2 font-bold text-white">Olá! Sou o Edy. 👋</p>
                <p className="text-sm">Estou aqui para tirar suas dúvidas sobre o Cred30 de forma rápida e segura.</p>
                <p className="text-xs mt-4 text-zinc-500 bg-zinc-800/50 p-2 rounded-lg inline-block">
                  Pergunte sobre: Licenças, Apoios ou Resgates.
                </p>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                    ? 'bg-primary-500 text-black rounded-tr-none shadow-sm'
                    : 'bg-surfaceHighlight text-white rounded-tl-none border border-zinc-800 shadow-sm'
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-surfaceHighlight p-3 rounded-2xl rounded-tl-none animate-pulse text-zinc-500 text-xs">
                  Digitando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {chatStatus === 'CLOSED' ? (
            <div className="p-4 border-t border-surfaceHighlight bg-surface">
              {feedbackSent ? (
                <div className="text-center py-4 animate-in fade-in zoom-in">
                  <p className="text-emerald-400 font-bold mb-1">Obrigado pela avaliação!</p>
                  <p className="text-xs text-zinc-500 mb-4">Sua opinião nos ajuda a melhorar.</p>
                  <button
                    onClick={() => {
                      setFeedbackSent(false);
                      setFeedbackRating(0);
                      setFeedbackComment('');
                      setMessages([]);
                      setChatStatus('AI_ONLY');
                    }}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg border border-zinc-700 transition"
                  >
                    Iniciar Novo Atendimento
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2">
                  <p className="text-xs text-zinc-400 text-center font-bold uppercase">Como foi seu atendimento?</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setFeedbackRating(star)}
                        className={`p-1 transition ${star <= feedbackRating ? 'text-yellow-400 scale-110' : 'text-zinc-600 hover:text-yellow-400/50'}`}
                      >
                        <Star size={24} fill={star <= feedbackRating ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Deixe um comentário (opcional)..."
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    className="w-full bg-black/20 border border-zinc-800 rounded-lg p-2 text-xs text-white resize-none"
                    rows={2}
                  />
                  <button
                    onClick={handleSendFeedback}
                    disabled={feedbackRating === 0}
                    className="w-full bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-black font-bold text-xs py-2 rounded-lg transition"
                  >
                    Enviar Avaliação
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 border-t border-surfaceHighlight bg-surface">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSend();
                    }
                  }}
                  placeholder="Como posso ajudar?"
                  className="flex-1 bg-background border border-surfaceHighlight rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-primary-500 transition-all shadow-inner"
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || !message.trim()}
                  className="bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-black p-2 rounded-xl font-medium transition shadow-lg"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
