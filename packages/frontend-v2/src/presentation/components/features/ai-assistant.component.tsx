import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, X, MessageSquare } from 'lucide-react';
import { AppState } from '../../../domain/types/common.types';

interface AIAssistantProps {
  appState: AppState;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ appState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);

  const getAdvice = async () => {
    setLoading(true);
    try {
      if (!process.env.API_KEY) {
        setAdvice("Chave de API não configurada. Por favor, configure o ambiente.");
        setLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const userContext = {
        name: appState?.currentUser?.name,
        balance: appState?.currentUser?.balance,
        quotas: appState?.quotas?.length ?? 0,
        totalInvested: appState?.quotas?.reduce((acc, q) => acc + q.purchasePrice, 0) ?? 0,
        currentValue: appState?.quotas?.reduce((acc, q) => acc + q.currentValue, 0) ?? 0,
        activeLoans: appState?.loans?.filter(l => l.status === 'APPROVED').length ?? 0,
        loanDebt: appState?.loans?.filter(l => l.status === 'APPROVED').reduce((acc, l) => acc + l.totalRepayment, 0) ?? 0
      };

      const prompt = `
        Aja como um consultor financeiro sênior de uma Fintech chamada Cred30.
        Analise os dados do usuário abaixo e dê um conselho curto, motivador e estratégico (max 3 frases).
        Fale em Português do Brasil. Use emojis.
        
        Dados do Usuário:
        ${JSON.stringify(userContext)}
        
        Contexto da Plataforma:
        - Cotas rendem diariamente (variável).
        - Empréstimos custam 20% ao mês.
        - Venda antes de 1 ano tem 40% de multa.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setAdvice(response.text || "Não foi possível gerar um conselho.");
    } catch (error) {
      console.error(error);
      setAdvice("Não foi possível gerar um conselho agora. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          if (!advice) getAdvice();
        }}
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 bg-gradient-to-r from-primary-600 to-emerald-500 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all z-40 flex items-center gap-2 group"
      >
        <Sparkles className="animate-pulse" />
        <span className="hidden group-hover:block whitespace-nowrap font-medium">Dica IA</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 bg-white rounded-lg shadow-xl z-50 w-80 max-h-96 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-primary-600" />
          <h3 className="font-bold text-lg">Assistente IA</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Fechar assistente"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="text-gray-700">
            {advice || "Clique no botão abaixo para obter um conselho financeiro personalizado."}
          </div>
        )}
      </div>

      <div className="p-4 border-t">
        <button
          onClick={getAdvice}
          disabled={loading}
          className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Gerando...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Gerar Novo Conselho
            </>
          )}
        </button>
      </div>
    </div>
  );
};