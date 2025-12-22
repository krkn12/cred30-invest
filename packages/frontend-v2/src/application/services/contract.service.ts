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
 * Gera o PDF do Contrato de Empréstimo
 */
const generateLoanContractPDF = async (data: LoanContractData): Promise<any> => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 25;

    // Helpers
    const centerText = (text: string, yPos: number, size = 12) => {
        doc.setFontSize(size);
        const textWidth = doc.getStringUnitWidth(text) * size / (doc.internal as any).scaleFactor;
        doc.text(text, (pageWidth - textWidth) / 2, yPos);
    };

    const addLine = (text: string, yPos: number, bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.text(text, margin, yPos);
        return yPos + 7;
    };

    const formatCurrency = (val: number) =>
        val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // --- CABEÇALHO ---
    doc.setFillColor(0, 150, 200);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    centerText('CRED30 - COOPERATIVA DE CRÉDITO', 15, 16);
    centerText('CONTRATO DE EMPRÉSTIMO PESSOAL', 28, 14);

    // --- NÚMERO DO CONTRATO ---
    doc.setTextColor(0, 0, 0);
    y = 50;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Contrato Nº: ${data.contractNumber}`, margin, y);
    doc.text(`Data: ${data.contractDate}`, pageWidth - margin - 50, y);

    // --- PARTES ---
    y = 65;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    y = addLine('1. DAS PARTES', y, true);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y = addLine('CREDORA: CRED30 - Sistema de Cooperação Financeira Mútua', y);
    y = addLine(`DEVEDOR(A): ${data.userName}`, y);
    y = addLine(`E-mail: ${data.userEmail}`, y);
    y = addLine(`Chave PIX: ${data.userPixKey}`, y);
    y += 5;

    // --- OBJETO DO CONTRATO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    y = addLine('2. DO OBJETO', y, true);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const objetoText = 'O presente instrumento tem por objeto a concessão de empréstimo pessoal pela CREDORA ao DEVEDOR, nas condições abaixo especificadas.';
    const objetoLines = doc.splitTextToSize(objetoText, pageWidth - 2 * margin);
    doc.text(objetoLines, margin, y);
    y += objetoLines.length * 5 + 5;

    // --- CONDIÇÕES ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    y = addLine('3. DAS CONDIÇÕES FINANCEIRAS', y, true);
    y += 3;

    // Tabela de valores (aumentada para incluir data)
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, pageWidth - 2 * margin, 60, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, pageWidth - 2 * margin, 60, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const tableY = y + 10;
    const col1 = margin + 5;
    const col2 = pageWidth / 2;

    doc.text('Data de Concessão:', col1, tableY);
    doc.setFont('helvetica', 'bold');
    doc.text(data.contractDate, col2, tableY);

    doc.setFont('helvetica', 'normal');
    doc.text('Valor do Empréstimo:', col1, tableY + 10);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(data.loanAmount), col2, tableY + 10);

    doc.setFont('helvetica', 'normal');
    doc.text('Taxa de Juros:', col1, tableY + 20);
    doc.setFont('helvetica', 'bold');
    doc.text(`${(data.interestRate * 100).toFixed(0)}%`, col2, tableY + 20);

    doc.setFont('helvetica', 'normal');
    doc.text('Valor Total a Pagar:', col1, tableY + 30);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(data.totalRepayment), col2, tableY + 30);

    doc.setFont('helvetica', 'normal');
    doc.text('Número de Parcelas:', col1, tableY + 40);
    doc.setFont('helvetica', 'bold');
    doc.text(`${data.installments}x de ${formatCurrency(data.installmentValue)}`, col2, tableY + 40);

    y += 70;

    // --- VENCIMENTO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    y = addLine('4. DO VENCIMENTO', y, true);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y = addLine(`Data de Vencimento Final: ${data.dueDate}`, y);
    y += 5;

    // --- INADIMPLÊNCIA ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    y = addLine('5. DA INADIMPLÊNCIA', y, true);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const inadText = 'O não pagamento nas datas acordadas resultará em: (a) bloqueio de novos empréstimos; (b) redução do score de crédito; (c) possível exclusão da cooperativa.';
    const inadLines = doc.splitTextToSize(inadText, pageWidth - 2 * margin);
    doc.text(inadLines, margin, y);
    y += inadLines.length * 5 + 5;

    // --- FORO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    y = addLine('6. DO FORO', y, true);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const foroText = 'Fica eleito o foro da comarca de residência do DEVEDOR para dirimir quaisquer controvérsias oriundas deste contrato.';
    const foroLines = doc.splitTextToSize(foroText, pageWidth - 2 * margin);
    doc.text(foroLines, margin, y);
    y += foroLines.length * 5 + 15;

    // --- ASSINATURA DIGITAL ---
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, pageWidth - 2 * margin, 40, 'F');
    doc.setDrawColor(0, 150, 200);
    doc.setLineWidth(1);
    doc.rect(margin, y, pageWidth - 2 * margin, 40, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 100, 150);
    doc.text('ASSINATURA DIGITAL', margin + 5, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Assinado eletronicamente por: ${data.userName}`, margin + 5, y + 22);
    doc.text(`E-mail: ${data.userEmail}`, margin + 5, y + 30);
    doc.text(`ID do Empréstimo: ${data.loanId}`, margin + 5, y + 38);

    // --- RODAPÉ ---
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Este documento foi gerado eletronicamente pelo sistema Cred30 e possui validade jurídica.', margin, 280);
    doc.text(`Contrato Nº ${data.contractNumber} - ${data.contractDate}`, margin, 286);

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
