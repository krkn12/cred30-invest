import { MUTUAL_AID_CONTRACT_CLAUSES, DISCLAIMERS } from '../../shared/constants/legal.constants';

interface LoanContractData {
    loanId: string;
    userName: string;
    userEmail: string;
    userPixKey: string;
    loanAmount: number;
    interestRate: number;
    totalRepayment: number;
    installments: number;
    installmentValue: number;
    dueDate: string;
    contractDate: string;
    contractNumber: string;
}

/**
 * Gera o PDF do Contrato de Mútuo Civil (Apoio Mútuo)
 * BLINDAGEM JURÍDICA: Documento segue padrões de SCP e Mútuo Civil
 */
const generateLoanContractPDF = async (data: LoanContractData): Promise<any> => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    // Helpers
    const centerText = (text: string, yPos: number, size = 12) => {
        doc.setFontSize(size);
        const textWidth = doc.getStringUnitWidth(text) * size / (doc.internal as any).scaleFactor;
        doc.text(text, (pageWidth - textWidth) / 2, yPos);
    };

    const addLine = (text: string, yPos: number, bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.text(text, margin, yPos);
        return yPos + 6;
    };

    const addParagraph = (text: string, yPos: number, maxWidth = pageWidth - 2 * margin) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, margin, yPos);
        return yPos + lines.length * 4 + 3;
    };

    const formatCurrency = (val: number) =>
        val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // --- CABEÇALHO ---
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    centerText('CRED30 - CLUBE DE BENEFÍCIOS E APOIO MÚTUO', 12, 14);
    doc.setFontSize(11);
    centerText('INSTRUMENTO PARTICULAR DE MÚTUO CIVIL FENERATÍCIO', 22, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    centerText('Sociedade em Conta de Participação - Art. 991 a 996 do Código Civil', 30, 8);

    // --- NÚMERO DO CONTRATO ---
    doc.setTextColor(0, 0, 0);
    y = 42;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Contrato Nº: ${data.contractNumber}`, margin, y);
    doc.text(`Data: ${data.contractDate}`, pageWidth - margin - 35, y);

    // --- AVISO IMPORTANTE ---
    y = 52;
    doc.setFillColor(254, 243, 199); // Amber-100
    doc.rect(margin, y, pageWidth - 2 * margin, 18, 'F');
    doc.setDrawColor(245, 158, 11); // Amber-500
    doc.rect(margin, y, pageWidth - 2 * margin, 18, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(146, 64, 14); // Amber-800
    doc.text('AVISO LEGAL OBRIGATÓRIO:', margin + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    const avisoText = 'Este NÃO é um empréstimo bancário. Trata-se de operação de MÚTUO CIVIL PRIVADO (Art. 586 CC) entre membros de clube fechado, operando sob regime de SCP (Art. 991 CC). A Cred30 NÃO é banco, NÃO é fintech regulada e NÃO é instituição financeira.';
    const avisoLines = doc.splitTextToSize(avisoText, pageWidth - 2 * margin - 6);
    doc.text(avisoLines, margin + 3, y + 10);

    y = 75;
    doc.setTextColor(0, 0, 0);

    // --- PARTES ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    y = addLine('1. DAS PARTES CONTRATANTES', y, true);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y = addLine('SÓCIO OSTENSIVO (Facilitador): CRED30 - Clube de Benefícios e Apoio Mútuo', y);
    y = addLine(`SÓCIO PARTICIPANTE (Mutuário): ${data.userName}`, y);
    y = addLine(`Identificação Digital: ${data.userEmail}`, y);
    y = addLine(`Chave PIX para Reposição: ${data.userPixKey}`, y);
    y += 3;

    // --- CLÁUSULA 2: OBJETO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    y = addLine('2. DO OBJETO DO CONTRATO', y, true);
    y = addParagraph(MUTUAL_AID_CONTRACT_CLAUSES.OBJECT, y);

    // --- CLÁUSULA 3: NATUREZA JURÍDICA ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    y = addLine('3. DA NATUREZA JURÍDICA', y, true);
    y = addParagraph(MUTUAL_AID_CONTRACT_CLAUSES.NATURE, y);

    // --- CLÁUSULA 4: CONDIÇÕES FINANCEIRAS ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    y = addLine('4. DAS CONDIÇÕES DO APOIO MÚTUO', y, true);
    y += 2;

    // Tabela de valores
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.rect(margin, y, pageWidth - 2 * margin, 35, 'F');
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.rect(margin, y, pageWidth - 2 * margin, 35, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const tableY = y + 7;
    const col1 = margin + 3;
    const col2 = pageWidth / 2 + 10;

    doc.text('Valor do Apoio Mútuo:', col1, tableY);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(data.loanAmount), col2, tableY);

    doc.setFont('helvetica', 'normal');
    doc.text('Taxa de Manutenção (20%):', col1, tableY + 8);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(data.totalRepayment - data.loanAmount), col2, tableY + 8);

    doc.setFont('helvetica', 'normal');
    doc.text('Valor Total a Repor:', col1, tableY + 16);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(data.totalRepayment), col2, tableY + 16);

    doc.setFont('helvetica', 'normal');
    doc.text('Reposições:', col1, tableY + 24);
    doc.setFont('helvetica', 'bold');
    doc.text(`${data.installments}x de ${formatCurrency(data.installmentValue)}`, col2, tableY + 24);

    y += 42;

    // --- CLÁUSULA 5: TAXA DE MANUTENÇÃO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    y = addLine('5. DA TAXA DE MANUTENÇÃO', y, true);
    y = addParagraph(MUTUAL_AID_CONTRACT_CLAUSES.MAINTENANCE_FEE, y);

    // --- CLÁUSULA 6: LASTRO E EXECUÇÃO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    y = addLine('6. DO LASTRO E EXECUÇÃO AUTOMÁTICA', y, true);
    y = addParagraph(MUTUAL_AID_CONTRACT_CLAUSES.GUARANTEE, y);

    // --- NOVA PÁGINA ---
    doc.addPage();
    y = 20;

    // --- CLÁUSULA 7: ISENÇÃO DE RESPONSABILIDADE ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    y = addLine('7. DA ISENÇÃO DE RESPONSABILIDADE', y, true);
    y = addParagraph(MUTUAL_AID_CONTRACT_CLAUSES.WAIVER, y);

    // --- CLÁUSULA 8: DECLARAÇÃO DE VOLUNTARIEDADE ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    y = addLine('8. DA VOLUNTARIEDADE E CIÊNCIA', y, true);
    y = addParagraph(MUTUAL_AID_CONTRACT_CLAUSES.VOLUNTARY, y);

    // --- CLÁUSULA 9: VENCIMENTO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    y = addLine('9. DO VENCIMENTO E MORA', y, true);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y = addLine(`Data de Vencimento Final: ${data.dueDate}`, y);
    y = addParagraph('O atraso na reposição superior a 5 (cinco) dias autoriza a execução automática do lastro em participações, sem necessidade de notificação adicional.', y);

    // --- CLÁUSULA 10: FORO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    y = addLine('10. DO FORO', y, true);
    y = addParagraph(MUTUAL_AID_CONTRACT_CLAUSES.JURISDICTION, y);

    // --- ASSINATURA DIGITAL ---
    y += 5;
    doc.setFillColor(240, 253, 244); // Emerald-50
    doc.rect(margin, y, pageWidth - 2 * margin, 35, 'F');
    doc.setDrawColor(16, 185, 129); // Emerald-500
    doc.setLineWidth(0.5);
    doc.rect(margin, y, pageWidth - 2 * margin, 35, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(6, 95, 70); // Emerald-800
    doc.text('ASSINATURA ELETRÔNICA', margin + 3, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Assinado digitalmente por: ${data.userName}`, margin + 3, y + 16);
    doc.text(`E-mail vinculado: ${data.userEmail}`, margin + 3, y + 22);
    doc.text(`ID do Contrato: ${data.contractNumber}`, margin + 3, y + 28);
    doc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, margin + 3, y + 34);

    y += 45;

    // --- DISCLAIMER FINAL ---
    doc.setFillColor(254, 226, 226); // Red-100
    doc.rect(margin, y, pageWidth - 2 * margin, 25, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(127, 29, 29); // Red-900
    doc.text('DISCLAIMER LEGAL:', margin + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    const disclaimerLines = doc.splitTextToSize(DISCLAIMERS.RISK_DISCLOSURE, pageWidth - 2 * margin - 6);
    doc.text(disclaimerLines, margin + 3, y + 10);

    // --- RODAPÉ ---
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Documento gerado eletronicamente pelo sistema Cred30 - Validade jurídica conforme MP 2.200-2/2001', margin, 285);
    doc.text(`${data.contractNumber} | SCP Art. 991 CC | Mútuo Civil Art. 586 CC | ${data.contractDate}`, margin, 290);

    return doc;
};


/**
 * Baixa o PDF do contrato
 */
export const downloadLoanContract = async (data: LoanContractData) => {
    const doc = await generateLoanContractPDF(data);
    doc.save(`contrato_mutuo_${data.contractNumber}.pdf`);
};

/**
 * Gera os dados do contrato a partir de um empréstimo
 */
export const createContractData = (
    loan: {
        id: string;
        amount: number;
        totalRepayment: number;
        installments: number;
        interestRate: number;
        dueDate?: number | string;
        requestDate?: number;
        createdAt?: string;
        created_at?: string;
    },
    user: {
        name: string;
        email: string;
        pixKey: string;
    }
): LoanContractData => {
    const contractNumber = `CRD30-${loan.id.toString().padStart(6, '0')}`;

    // Tentar obter a data do empréstimo de várias fontes possíveis
    let loanDate: Date;
    if (loan.requestDate) {
        loanDate = new Date(loan.requestDate);
    } else if (loan.createdAt) {
        loanDate = new Date(loan.createdAt);
    } else if (loan.created_at) {
        loanDate = new Date(loan.created_at);
    } else {
        loanDate = new Date(); // fallback para data atual
    }

    const contractDate = loanDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    // Data de vencimento
    let dueDateFormatted = 'Não definida';
    if (loan.dueDate) {
        const dueDateTime = typeof loan.dueDate === 'string' ? new Date(loan.dueDate) : new Date(loan.dueDate);
        dueDateFormatted = dueDateTime.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    const installmentValue = loan.totalRepayment / loan.installments;

    return {
        loanId: loan.id,
        userName: user.name,
        userEmail: user.email,
        userPixKey: user.pixKey || 'Não informado',
        loanAmount: loan.amount,
        interestRate: loan.interestRate,
        totalRepayment: loan.totalRepayment,
        installments: loan.installments,
        installmentValue,
        dueDate: dueDateFormatted,
        contractDate,
        contractNumber,
    };
};
