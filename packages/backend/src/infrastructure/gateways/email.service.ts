import nodemailer from 'nodemailer';

export class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private isMock: boolean = true;

    constructor() {
        const host = process.env.SMTP_HOST;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (host && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user,
                    pass,
                },
            });
            this.isMock = false;
            console.log('EmailService: Configurado com SMTP real.');
        } else {
            console.log('EmailService: Credenciais SMTP não encontradas. Usando MOCK (logs no console).');
        }
    }

    async sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
        if (this.isMock || !this.transporter) {
            console.log('---------------------------------------------------');
            console.log(`[MOCK EMAIL] Enviando para: ${to}`);
            console.log(`[MOCK EMAIL] Assunto: ${subject}`);
            console.log(`[MOCK EMAIL] Corpo: ${text}`);
            console.log('---------------------------------------------------');
            return true;
        }

        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"Cred30" <noreply@cred30.com>',
                to,
                subject,
                text,
                html: html || text,
            });
            console.log(`Email enviado com sucesso para ${to}`);
            return true;
        } catch (error) {
            console.error('Erro ao enviar email:', error);
            return false;
        }
    }

    async sendVerificationCode(to: string, code: string): Promise<boolean> {
        const subject = 'Sua Chave de Verificação - Cred30';
        const text = `Seu código de verificação é: ${code}`;
        const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #06b6d4;">Bem-vindo à Cred30</h2>
        <p>Para confirmar seu cadastro, use o código abaixo:</p>
        <h1 style="background: #f4f4f5; padding: 10px; border-radius: 8px; display: inline-block;">${code}</h1>
        <p>Se você não solicitou este código, ignore este email.</p>
        <p style="font-size: 12px; color: #71717a; margin-top: 20px;">Cred30 - Cooperativa Digital</p>
      </div>
    `;
        return this.sendEmail(to, subject, text, html);
    }

    async sendWithdrawalToken(to: string, token: string, amount: number): Promise<boolean> {
        const subject = 'Confirmação de Saque - Cred30';
        const text = `Confirme seu saque de R$ ${amount.toFixed(2)} com o código: ${token}`;
        const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #f97316;">Confirmação de Saque</h2>
        <p>Você solicitou um saque de <strong>R$ ${amount.toFixed(2)}</strong>.</p>
        <p>Para autorizar, use o código de segurança:</p>
        <h1 style="background: #fff7ed; color: #ea580c; padding: 10px; border-radius: 8px; display: inline-block;">${token}</h1>
        <p>Nunca compartilhe este código com ninguém.</p>
      </div>
    `;
        return this.sendEmail(to, subject, text, html);
    }
}

export const emailService = new EmailService();
