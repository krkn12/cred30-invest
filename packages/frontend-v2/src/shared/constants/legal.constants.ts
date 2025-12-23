/**
 * CONSTANTES JURÍDICAS - BLINDAGEM LEGAL CRED30
 * ===============================================
 * Este arquivo centraliza todos os textos legais do sistema.
 * Atualizado em: Dezembro 2024
 * 
 * IMPORTANTE: Qualquer alteração neste arquivo deve ser revisada
 * por um advogado especializado em Direito Digital e Financeiro.
 */

// Natureza Jurídica Principal
export const LEGAL_ENTITY_TYPE = 'SOCIEDADE EM CONTA DE PARTICIPAÇÃO (SCP)';
export const LEGAL_BASE = 'Art. 991 a 996 do Código Civil Brasileiro';

// Disclaimers Padrão
export const DISCLAIMERS = {
    NOT_A_BANK: 'A Cred30 NÃO é um banco, NÃO é uma fintech regulada pelo Banco Central, NÃO é uma cooperativa de crédito (Lei 5.764/71) e NÃO é uma instituição financeira. Trata-se de um clube privado de benefícios operando sob o regime de Sociedade em Conta de Participação (Art. 991 CC).',

    NO_INVESTMENT: 'As participações (cotas) adquiridas NÃO configuram oferta de investimento, NÃO são valores mobiliários (Lei 6.385/76), NÃO têm garantia de rentabilidade e NÃO são reguladas pela CVM. Trata-se de contribuição associativa para participação em clube fechado.',

    MUTUAL_AID: 'Os apoios financeiros disponibilizados NÃO são empréstimos bancários. São operações de mútuo civil privado (Art. 586 CC) entre membros da comunidade, sujeitos a disponibilidade de caixa e análise de score interno.',

    RISK_DISCLOSURE: 'O membro declara ciência de que: (i) não há fundo garantidor de crédito; (ii) os valores aportados estão sujeitos a riscos inerentes a operações entre particulares; (iii) a plataforma atua apenas como facilitadora tecnológica, sem assumir obrigações financeiras próprias.',

    NOT_INTEREST_RATE: 'A "Taxa de Manutenção" cobrada sobre apoios mútuos NÃO configura juros bancários (Art. 591 CC). Trata-se de contribuição para manutenção da infraestrutura tecnológica e formação de reserva de proteção ao lastro comum.',

    SCORE_INTERNAL: 'O Score Cred30 é uma métrica interna e privada, utilizada exclusivamente para gestão de limites dentro do clube. NÃO é compartilhado com bureaus de crédito externos (SPC, Serasa, Boa Vista) e NÃO afeta a vida financeira do membro fora da plataforma.',

    AML_KYC: 'Em conformidade com a Lei 9.613/98 (Prevenção à Lavagem de Dinheiro), a Cred30 reserva-se o direito de solicitar documentação comprobatória de origem de recursos e bloquear contas com movimentação atípica, reportando às autoridades competentes quando necessário.',

    LGPD_COMPLIANCE: 'O tratamento de dados pessoais segue a Lei Geral de Proteção de Dados (Lei 13.709/2018). O membro pode exercer seus direitos de acesso, correção, exclusão e portabilidade a qualquer momento via configurações da conta.',

    ARBITRATION: 'Eventuais conflitos serão resolvidos preferencialmente por mediação entre as partes. Persistindo o impasse, fica eleito o foro da comarca de Belém/PA para dirimir questões relativas a este regulamento.',

    FOOTER_LEGAL: '© 2024 Cred30 - Clube de Benefícios Privado. CNPJ em processo de formalização. Operação sob regime de SCP (Art. 991 CC). Esta plataforma não realiza operações privativas de instituições financeiras. Dúvidas: suporte@cred30.site'
};

// Termos Específicos para Substituição (evitar palavras proibidas)
export const LEGAL_TERMINOLOGY = {
    // NUNCA USE                    // USE SEMPRE
    'empréstimo': 'Apoio Mútuo',
    'empréstimos': 'Apoios Mútuos',
    'emprestar': 'solicitar apoio',
    'juros': 'Taxa de Manutenção',
    'taxa de juros': 'contribuição de manutenção',
    'investimento': 'participação',
    'investir': 'participar',
    'investidor': 'membro participante',
    'rendimento': 'benefício',
    'rentabilidade': 'valorização de participação',
    'dividendos': 'distribuição de excedentes',
    'lucro': 'excedente operacional',
    'cliente': 'membro',
    'clientes': 'membros',
    'banco': 'clube',
    'conta bancária': 'conta de membro',
    'saldo bancário': 'saldo de participação',
    'crédito': 'apoio mútuo',
    'financiamento': 'apoio programado',
    'parcela': 'reposição',
    'parcelas': 'reposições',
    'dívida': 'compromisso social',
    'devedor': 'membro em reposição',
    'cobrança': 'lembrete de reposição',
    'inadimplência': 'atraso de reposição',
    'garantia': 'lastro',
    'colateral': 'lastro em participações'
};

// Cláusulas Obrigatórias no Contrato de Apoio Mútuo
export const MUTUAL_AID_CONTRACT_CLAUSES = {
    OBJECT: 'DO OBJETO: O presente instrumento particular de mútuo civil feneratício, regido pelo Art. 586 e seguintes do Código Civil Brasileiro, tem por objeto a transferência temporária de recursos entre MEMBROS PARTICIPANTES do clube de benefícios Cred30, operando sob o regime de Sociedade em Conta de Participação (SCP) conforme Art. 991 CC.',

    NATURE: 'DA NATUREZA JURÍDICA: As partes reconhecem expressamente que esta operação NÃO configura atividade privativa de instituição financeira (Art. 17 Lei 4.595/64), tratando-se de operação civil entre particulares, com lastro em participações ativas no clube.',

    MAINTENANCE_FEE: 'DA TAXA DE MANUTENÇÃO: A contribuição adicional de 20% (vinte por cento) sobre o valor principal destina-se exclusivamente à manutenção da infraestrutura tecnológica da plataforma, formação de reserva de proteção coletiva e custos operacionais, não configurando juros bancários.',

    GUARANTEE: 'DO LASTRO E EXECUÇÃO: O membro mutuário autoriza expressamente que, em caso de atraso superior a 5 (cinco) dias na reposição, suas participações ativas no clube sejam executadas para satisfação do compromisso, sem necessidade de notificação prévia adicional.',

    WAIVER: 'DA ISENÇÃO DE RESPONSABILIDADE: O membro declara ciência de que a plataforma Cred30 atua exclusivamente como facilitadora tecnológica, não assumindo qualquer responsabilidade por inadimplemento entre as partes ou por eventuais perdas decorrentes da operação.',

    VOLUNTARY: 'DA VOLUNTARIEDADE: O membro declara que está solicitando este apoio por livre e espontânea vontade, sem coação, estando ciente de todas as condições, taxas e prazos envolvidos.',

    JURISDICTION: 'DO FORO: As partes elegem o foro da comarca de Belém/PA para dirimir quaisquer controvérsias oriundas do presente instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.'
};

// Texto do Aceite de Termos (exibido no cadastro)
export const TERMS_ACCEPTANCE_TEXT = `
Ao criar minha conta na Cred30, declaro que:

1. TENHO CIÊNCIA de que a Cred30 NÃO é um banco, NÃO é uma fintech regulada e NÃO é uma instituição financeira.

2. COMPREENDO que estou ingressando como SÓCIO PARTICIPANTE em uma Sociedade em Conta de Participação (Art. 991 CC) com objetivo de ajuda mútua entre membros.

3. ACEITO que os apoios financeiros são operações de mútuo civil privado, sujeitas a disponibilidade de caixa e análise de score interno, sem garantia de aprovação.

4. DECLARO que os recursos aportados são de origem lícita e autorizo a Cred30 a solicitar comprovação quando necessário.

5. RECONHEÇO que não há fundo garantidor de crédito e que assumo integralmente os riscos inerentes às operações do clube.

6. AUTORIZO o tratamento dos meus dados pessoais nos termos da LGPD (Lei 13.709/2018) conforme Política de Privacidade.

7. CONCORDO que eventuais conflitos sejam resolvidos preferencialmente por mediação, elegendo o foro de Belém/PA.

Li e aceito integralmente o Regulamento Interno e a Política de Privacidade da Cred30.
`;

// Aviso de Risco para tela de Apoio Mútuo
export const MUTUAL_AID_RISK_WARNING = 'Ao solicitar um apoio mútuo, você está firmando um contrato de mútuo civil privado (Art. 586 CC) com lastro em suas participações ativas. Em caso de atraso na reposição, suas participações poderão ser executadas automaticamente. A disponibilidade está sujeita ao caixa do clube.';

// Footer Legal Padrão
export const LEGAL_FOOTER = `
Cred30 - Clube de Benefícios Privado e Apoio Mútuo
Operação sob regime de Sociedade em Conta de Participação (Art. 991 CC)
NÃO somos banco. NÃO somos fintech regulada. NÃO somos cooperativa de crédito.
© ${new Date().getFullYear()} Todos os direitos reservados.
`;
