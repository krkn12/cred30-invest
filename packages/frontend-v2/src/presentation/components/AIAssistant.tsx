import React, { useState, useEffect, useRef } from 'react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userContent = message;
    setMessage('');
    setIsLoading(true);

    // Otimismo: adicionar mensagem do usuário na UI
    setMessages(prev => [...prev, { role: 'user', content: userContent }]);

    try {
      const result = await apiService.sendChatMessage(userContent);
      if (result.success) {
        // Se houver resposta da IA, ela virá no data
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

  return (
    <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-[150] print:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-primary-500 hover:bg-primary-400 text-black p-3.5 rounded-full shadow-lg transition-all ${isOpen ? 'rotate-90' : ''}`}
        title="Assistente IA"
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[calc(100vw-2rem)] md:w-96 bg-surface border border-surfaceHighlight rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh] md:max-h-[500px]">
          <div className="flex justify-between items-center p-4 border-b border-surfaceHighlight bg-surfaceAccent">
            <div>
              <h3 className="text-white font-bold">Suporte Cred30</h3>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest">
                {chatStatus === 'AI_ONLY' ? '🤖 Atendimento via IA' : '👥 Atendimento Humano'}
              </p>
            </div>
            {chatStatus === 'AI_ONLY' && (
              <button
                onClick={handleEscalate}
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded border border-zinc-700 transition"
              >
                Falar com Atendente
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-zinc-400 py-8">
                <p className="text-lg mb-2">👋 Olá!</p>
                <p>Sou o assistente virtual do Cred30.</p>
                <p className="text-sm mt-2">Dúvidas sobre aportes, apoios ou saques? Digite abaixo.</p>
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
                onClick={handleSend}
                disabled={isLoading || !message.trim()}
                className="bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-black p-2 rounded-xl font-medium transition shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
