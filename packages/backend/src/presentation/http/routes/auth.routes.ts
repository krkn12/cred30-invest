import { Hono } from 'hono';
import { sign } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { getDbPool, generateReferralCode } from '../../../infrastructure/database/postgresql/connection/pool';
import { authRateLimit } from '../middleware/rate-limit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { twoFactorService } from '../../../application/services/two-factor.service';
import { notificationService } from '../../../application/services/notification.service';

const authRoutes = new Hono();

// Aplicar rate limiting às rotas de autenticação
authRoutes.post('/login', authRateLimit);
authRoutes.post('/register', authRateLimit);
authRoutes.post('/reset-password', authRateLimit);

// Esquemas de validação
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  secretPhrase: z.string().optional().or(z.literal('')),
  twoFactorCode: z.string().length(6).optional().or(z.literal('')),
});

const registerSchema = z.object({
  name: z.string().min(5).refine(val => val.trim().split(/\s+/).length >= 2, "Informe seu Nome e Sobrenome reais"),
  email: z.string().email(),
  password: z.string().min(6),
  secretPhrase: z.string().min(3),
  pixKey: z.string().min(5),
  referralCode: z.string().optional(),
  cpf: z.string().min(11).max(14).optional(), // CPF opcional no cadastro
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  secretPhrase: z.string().min(3),
  newPassword: z.string().min(6),
});

// Rota de login
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = loginSchema.parse(body);

    const pool = getDbPool(c);

    // VERIFICAÇÃO DE SUPER-ADMIN VIA ENV
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPass = process.env.ADMIN_PASSWORD;
    const adminSecret = process.env.ADMIN_SECRET_PHRASE;

    const isSuperAdminEnv = adminEmail && adminPass && adminSecret &&
      validatedData.email.toLowerCase() === adminEmail.toLowerCase() &&
      validatedData.password === adminPass &&
      validatedData.secretPhrase === adminSecret;

    // Buscar usuário no banco
    const userEmail = validatedData.email.toLowerCase();
    console.log('Buscando usuário com email:', userEmail);
    const result = await pool.query(
      'SELECT id, name, email, password_hash, secret_phrase, panic_phrase, is_under_duress, safe_contact_phone, pix_key, referral_code, is_admin, balance, score, created_at, is_email_verified, two_factor_enabled, two_factor_secret, status, role FROM users WHERE email = $1',
      [userEmail]
    );

    let user = result.rows[0];
    let isAdmin = user?.is_admin || false;
    let isPanicLogin = false;

    // Lista de gatilhos universais (caso o usuário esqueça o dele no susto)
    const universalPanicTriggers = ['190', 'SOS', 'COACAO'];
    const enteredSecret = validatedData.secretPhrase?.trim().toUpperCase();

    if (user && enteredSecret &&
      (user.panic_phrase === validatedData.secretPhrase || universalPanicTriggers.includes(enteredSecret))) {
      console.log('!!! LOGIN EM MODO PÂNICO DETECTADO (CUSTOM OU UNIVERSAL) !!!');
      isPanicLogin = true;
      // Ativar flag de coação no banco
      await pool.query('UPDATE users SET is_under_duress = TRUE WHERE id = $1', [user.id]);

      // Enviar alerta para contato seguro se existir
      if (user.safe_contact_phone) {
        notificationService.sendDuressAlert(user.name, user.safe_contact_phone);
      }
    }

    if (isSuperAdminEnv) {
      console.log('Login de Super-Admin detectado via .env');
      isAdmin = true;

      // Se o usuário não existir no banco, criamos ele agora para evitar erros nos middlewares
      if (!user) {
        console.log('Criando Super-Admin no banco de dados...');
        const hashedPassword = await bcrypt.hash(adminPass, 10);
        const insertResult = await pool.query(
          `INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, referral_code, is_admin, balance, score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, name, email, pix_key, referral_code, is_admin, balance, score, created_at`,
          [
            'Super Administrador',
            adminEmail,
            hashedPassword,
            adminSecret,
            process.env.ADMIN_PIX_KEY || 'Não configurada',
            'ADMIN',
            true,
            0,
            1000
          ]
        );
        user = insertResult.rows[0];
      }
    } else if (!user) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    // Verificar se o usuário está bloqueado
    if (user.status && user.status !== 'ACTIVE') {
      return c.json({
        success: false,
        message: 'Esta conta está suspensa ou bloqueada. Entre em contato com o suporte.'
      }, 403);
    }

    // Só executa as verificações normais se NÃO for login de Super-Admin via ENV
    if (!isSuperAdminEnv) {
      // Verificar se 2FA está habilitado
      if (user.two_factor_enabled) {
        if (!validatedData.twoFactorCode) {
          return c.json({
            success: false,
            message: 'Código de autenticação necessário',
            data: { requires2FA: true }
          }, 200);
        }

        const isValid = twoFactorService.verifyToken(validatedData.twoFactorCode, user.two_factor_secret);
        if (!isValid) {
          return c.json({ success: false, message: 'Código de autenticação inválido' }, 401);
        }
      }

      // Verificar senha e frase secreta
      const isPasswordValid = user.password_hash ?
        await bcrypt.compare(validatedData.password, user.password_hash) :
        validatedData.password === user.password_hash;

      if (!isPasswordValid) {
        return c.json({ success: false, message: 'Senha incorreta' }, 401);
      }

      if (!user.two_factor_enabled &&
        user.secret_phrase !== validatedData.secretPhrase &&
        user.panic_phrase !== validatedData.secretPhrase) {
        return c.json({ success: false, message: 'Frase secreta incorreta' }, 401);
      }
    }

    // Gerar token JWT
    const token = sign(
      { userId: user.id, isAdmin: isAdmin },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    // Registrar IP e data do login (Assíncrono para não travar resposta)
    const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
    pool.query('UPDATE users SET last_ip = $1, last_login_at = NOW() WHERE id = $2', [ip, user.id]);

    return c.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          pixKey: user.pix_key,
          balance: parseFloat(user.balance || 0),
          joinedAt: user.created_at,
          referralCode: user.referral_code,
          isAdmin: isAdmin,
          score: user.score,
          role: user.role || 'MEMBER',
          status: user.status || 'ACTIVE',
          twoFactorEnabled: user.two_factor_enabled
        },
        token,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]?.message || 'Dados de login inválidos';
      return c.json({ success: false, message: firstError, errors: error.errors }, 400);
    }
    console.error('Erro no login:', error);
    return c.json({ success: false, message: 'Erro interno do servidor', debug: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 500);
  }
});

// Rota de registro
authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = registerSchema.parse(body);

    const pool = getDbPool(c);

    const userEmail = validatedData.email.toLowerCase();

    // Verificar se email já existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [userEmail]
    );

    if (existingUser.rows.length > 0) {
      return c.json({ success: false, message: 'Email já cadastrado' }, 409);
    }

    // Verificar se chave PIX já existe
    const existingPix = await pool.query(
      'SELECT id FROM users WHERE pix_key = $1',
      [validatedData.pixKey]
    );

    if (existingPix.rows.length > 0) {
      return c.json({ success: false, message: 'Esta chave PIX já está vinculada a outra conta' }, 409);
    }

    // Verificar se o email sendo registrado é o do administrador definido no .env
    const isAdminEmail = validatedData.email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase();

    console.log('Email sendo registrado:', validatedData.email);
    console.log('É email de admin:', isAdminEmail);

    // Hash da senha
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Forçar uso de código de indicação (Modelo Clube Fechado)
    // Exceção: O administrador definido no .env não precisa de código
    if (!isAdminEmail) {
      if (!validatedData.referralCode || validatedData.referralCode.trim() === '') {
        return c.json({ success: false, message: 'Código de indicação é obrigatório para novos membros.' }, 403);
      }

      const inputCode = validatedData.referralCode.trim().toUpperCase();
      let referrerId = null;
      let referrerName = null;

      // 1. Tentar indicação orgânica (de outros membros)
      const userReferrerResult = await pool.query(
        'SELECT id, name FROM users WHERE referral_code = $1',
        [inputCode]
      );

      if (userReferrerResult.rows.length > 0) {
        referrerId = userReferrerResult.rows[0].id;
        referrerName = userReferrerResult.rows[0].name;
      } else {
        // 2. Tentar código administrativo
        const adminCodeResult = await pool.query(
          'SELECT * FROM referral_codes WHERE code = $1 AND is_active = TRUE',
          [inputCode]
        );

        if (adminCodeResult.rows.length > 0) {
          const adminCode = adminCodeResult.rows[0];

          // Verificar limites
          if (adminCode.max_uses !== null && adminCode.current_uses >= adminCode.max_uses) {
            return c.json({ success: false, message: 'Este código de convite expirou ou atingiu o limite de usos.' }, 403);
          }

          referrerId = adminCode.created_by;
          referrerName = 'Sistema (Admin Code)';

          // Incrementar uso do código administrativo
          await pool.query(
            'UPDATE referral_codes SET current_uses = current_uses + 1 WHERE id = $1',
            [adminCode.id]
          );
        }
      }

      if (!referrerId) {
        return c.json({ success: false, message: 'Código de indicação inválido. O Cred30 é exclusivo para convidados.' }, 403);
      }

      // 3. NÃO PAGAR BÔNUS IMEDIATAMENTE (Para evitar quebra de caixa)
      // O bônus será pago apenas quando o indicado comprar sua primeira cota.
      // Apenas garantimos que o referrerId foi encontrado para vincular ao usuário.
    }

    // Criar novo usuário
    const referralCode = generateReferralCode();

    // GERAR 2FA (No lugar do código de email)
    const tfaSecret = twoFactorService.generateSecret();
    const otpUri = twoFactorService.generateOtpUri(validatedData.email, tfaSecret);
    const qrCode = await twoFactorService.generateQrCode(otpUri);

    const newUserResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, balance, referral_code, is_admin, score, two_factor_secret, two_factor_enabled, is_email_verified, accepted_terms_at, cpf)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 0, $8, FALSE, TRUE, CURRENT_TIMESTAMP, $9)
       RETURNING id, name, email, pix_key, balance, score, created_at, referral_code, is_admin, cpf`,
      [
        validatedData.name,
        userEmail,
        hashedPassword,
        validatedData.secretPhrase,
        validatedData.pixKey,
        referralCode,
        isAdminEmail,
        tfaSecret,
        validatedData.cpf || null
      ]
    );

    const newUser = newUserResult.rows[0];

    // Gerar token JWT
    const token = sign(
      { userId: newUser.id, email: newUser.email, isAdmin: newUser.is_admin },
      process.env.JWT_SECRET!
    );

    return c.json({
      success: true,
      message: 'Cadastro iniciado! Configure seu autenticador para ativar a conta.',
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          pixKey: newUser.pix_key,
          balance: 0,
          joinedAt: newUser.created_at,
          referralCode: newUser.referral_code,
          isAdmin: newUser.is_admin,
          twoFactorEnabled: false
        },
        twoFactor: {
          secret: tfaSecret,
          qrCode: qrCode,
          otpUri: otpUri
        },
        token,
      },
    }, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]?.message || 'Dados de registro inválidos';
      return c.json({ success: false, message: firstError, errors: error.errors }, 400);
    }

    console.error('Erro no registro:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Rota de reset de senha
authRoutes.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = resetPasswordSchema.parse(body);

    const pool = getDbPool(c);

    // Buscar usuário
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND secret_phrase = $2',
      [validatedData.email, validatedData.secretPhrase]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado ou frase secreta incorreta' }, 404);
    }

    const userId = result.rows[0].id;

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10);

    // Atualizar senha e colocar trava de 48h (Segurança Reforçada)
    const lockDate = new Date();
    lockDate.setHours(lockDate.getHours() + 48);

    await pool.query(
      'UPDATE users SET password_hash = $1, security_lock_until = $2 WHERE id = $3',
      [hashedPassword, lockDate, userId]
    );

    return c.json({ success: true, message: 'Senha redefinida com sucesso' });
  } catch (error: any) {
    console.error('Erro no reset de senha:', error);
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: error.errors[0].message }, 400);
    }
    return c.json({ success: false, message: 'Erro ao redefinir senha' }, 500);
  }
});

// Rota de verificação de 2FA (Ativação)
authRoutes.post('/verify-2fa', async (c) => {
  try {
    const { email, code } = await c.req.json();
    const pool = getDbPool(c);

    const result = await pool.query(
      'SELECT id, two_factor_secret FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    const { id, two_factor_secret } = result.rows[0];

    const isValid = twoFactorService.verifyToken(code, two_factor_secret);

    if (!isValid) {
      return c.json({ success: false, message: 'Código inválido' }, 400);
    }

    const lockDate = new Date();
    lockDate.setHours(lockDate.getHours() + 48);

    await pool.query(
      'UPDATE users SET two_factor_enabled = TRUE, security_lock_until = $1 WHERE id = $2',
      [lockDate, id]
    );

    return c.json({ success: true, message: 'Autenticação de 2 fatores ativada com sucesso!' });
  } catch (error) {
    console.error('Erro na verificação 2FA:', error);
    return c.json({ success: false, message: 'Erro ao verificar código' }, 500);
  }
});

// Rota para obter dados de configuração de 2FA (Para usuários existentes)
authRoutes.get('/2fa/setup', authMiddleware, async (c) => {
  try {
    const userPayload = c.get('user');
    const pool = getDbPool(c);

    // Buscar usuário para verificar se já tem 2FA
    const result = await pool.query(
      'SELECT email, two_factor_enabled, two_factor_secret FROM users WHERE id = $1',
      [userPayload.id]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    const user = result.rows[0];
    let secret = user.two_factor_secret;

    // Se não tiver segredo ainda, gera um
    if (!secret) {
      secret = twoFactorService.generateSecret();
      await pool.query(
        'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
        [secret, userPayload.id]
      );
    }

    const otpUri = twoFactorService.generateOtpUri(user.email, secret);
    const qrCode = await twoFactorService.generateQrCode(otpUri);

    return c.json({
      success: true,
      data: {
        secret,
        qrCode,
        otpUri,
        enabled: user.two_factor_enabled
      }
    });
  } catch (error) {
    console.error('Erro ao buscar configuração 2FA:', error);
    return c.json({ success: false, message: 'Erro ao gerar dados 2FA' }, 500);
  }
});

// Rota de logout (no backend, apenas invalidar token no frontend)
authRoutes.post('/logout', async (c) => {
  return c.json({
    success: true,
    message: 'Logout realizado com sucesso',
  });
});

// Rota para registrar aceite de termos (Blindagem Jurídica)
const termsAcceptanceSchema = z.object({
  termsVersion: z.string().default('2.0'),
  privacyVersion: z.string().default('1.0'),
  acceptedAgeRequirement: z.boolean().default(true),
  acceptedRiskDisclosure: z.boolean().default(true),
  acceptedTerms: z.boolean().default(true),
  acceptedPrivacy: z.boolean().default(true),
});

authRoutes.post('/accept-terms', authMiddleware, async (c) => {
  try {
    const userPayload = c.get('user');
    const body = await c.req.json();
    const data = termsAcceptanceSchema.parse(body);

    const pool = getDbPool(c);

    // Coletar informações do cliente
    const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1';
    const userAgent = c.req.header('user-agent') || 'Unknown';

    // Registrar aceite de termos
    await pool.query(
      `INSERT INTO terms_acceptance 
       (user_id, terms_version, privacy_version, ip_address, user_agent, 
        accepted_age_requirement, accepted_risk_disclosure, accepted_terms, accepted_privacy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, terms_version, privacy_version) 
       DO UPDATE SET 
         ip_address = EXCLUDED.ip_address,
         user_agent = EXCLUDED.user_agent,
         accepted_at = CURRENT_TIMESTAMP`,
      [
        userPayload.id,
        data.termsVersion,
        data.privacyVersion,
        ipAddress,
        userAgent,
        data.acceptedAgeRequirement,
        data.acceptedRiskDisclosure,
        data.acceptedTerms,
        data.acceptedPrivacy
      ]
    );

    // Também atualizar o campo simples na tabela users
    await pool.query(
      'UPDATE users SET accepted_terms_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userPayload.id]
    );

    console.log(`[LEGAL] Aceite de termos registrado para usuário ${userPayload.id} - IP: ${ipAddress}`);

    return c.json({
      success: true,
      message: 'Aceite de termos registrado com sucesso',
      data: {
        termsVersion: data.termsVersion,
        privacyVersion: data.privacyVersion,
        acceptedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro ao registrar aceite de termos:', error);
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }
    return c.json({ success: false, message: 'Erro ao registrar aceite' }, 500);
  }
});

// Rota para verificar se usuário aceitou termos atuais
authRoutes.get('/terms-status', authMiddleware, async (c) => {
  try {
    const userPayload = c.get('user');
    const pool = getDbPool(c);

    const result = await pool.query(
      `SELECT terms_version, privacy_version, accepted_at, 
              accepted_age_requirement, accepted_risk_disclosure
       FROM terms_acceptance 
       WHERE user_id = $1 
       ORDER BY accepted_at DESC 
       LIMIT 1`,
      [userPayload.id]
    );

    if (result.rows.length === 0) {
      return c.json({
        success: true,
        data: {
          hasAccepted: false,
          needsUpdate: true,
          currentTermsVersion: '2.0',
          currentPrivacyVersion: '1.0'
        }
      });
    }

    const acceptance = result.rows[0];
    const needsUpdate = acceptance.terms_version !== '2.0' || acceptance.privacy_version !== '1.0';

    return c.json({
      success: true,
      data: {
        hasAccepted: true,
        needsUpdate,
        acceptedTermsVersion: acceptance.terms_version,
        acceptedPrivacyVersion: acceptance.privacy_version,
        acceptedAt: acceptance.accepted_at,
        currentTermsVersion: '2.0',
        currentPrivacyVersion: '1.0'
      }
    });
  } catch (error) {
    console.error('Erro ao verificar status de termos:', error);
    return c.json({ success: false, message: 'Erro ao verificar status' }, 500);
  }
});

// ============================================
// ROTA DE RECUPERAÇÃO DE 2FA
// Permite desabilitar 2FA usando email + senha + frase secreta
// ============================================
const recover2FASchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  secretPhrase: z.string().min(3),
});

authRoutes.post('/recover-2fa', async (c) => {
  try {
    const body = await c.req.json();
    const data = recover2FASchema.parse(body);

    const pool = getDbPool(c);

    // Buscar usuário pelo email
    const userResult = await pool.query(
      'SELECT id, password_hash, secret_phrase, two_factor_enabled, name FROM users WHERE email = $1',
      [data.email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      // Resposta genérica para não revelar se email existe
      return c.json({
        success: false,
        message: 'Credenciais inválidas. Verifique email, senha e frase secreta.'
      }, 400);
    }

    const user = userResult.rows[0];

    // Verificar senha
    const passwordMatch = await bcrypt.compare(data.password, user.password_hash);
    if (!passwordMatch) {
      return c.json({
        success: false,
        message: 'Credenciais inválidas. Verifique email, senha e frase secreta.'
      }, 400);
    }

    // Verificar frase secreta (case insensitive)
    if (user.secret_phrase.toLowerCase() !== data.secretPhrase.toLowerCase()) {
      return c.json({
        success: false,
        message: 'Credenciais inválidas. Verifique email, senha e frase secreta.'
      }, 400);
    }

    // Verificar se 2FA está habilitado
    if (!user.two_factor_enabled) {
      return c.json({
        success: false,
        message: 'A autenticação de dois fatores não está ativada nesta conta.'
      }, 400);
    }

    // GERAR NOVO 2FA e desabilitar o antigo
    const newSecret = twoFactorService.generateSecret();
    const qrCode = await twoFactorService.generateQrCode(twoFactorService.generateOtpUri(data.email, newSecret));

    // Trava de segurança de 48h após recuperação
    const lockDate = new Date();
    lockDate.setHours(lockDate.getHours() + 48);

    // Atualizar usuário com novo segredo e MANTER 2FA DESABILITADO
    // O usuário precisará ativar novamente após escanear o QR Code
    await pool.query(
      `UPDATE users 
       SET two_factor_secret = $1, 
           two_factor_enabled = FALSE,
           security_lock_until = $2
       WHERE id = $3`,
      [newSecret, lockDate, user.id]
    );

    // Log de segurança
    console.log(`[SECURITY] 2FA recuperado para usuário ${user.id} (${data.email})`);

    return c.json({
      success: true,
      message: '2FA desabilitado com sucesso! Configure novamente para maior segurança.',
      data: {
        twoFactor: {
          secret: newSecret,
          qrCode: qrCode,
          otpUri: `otpauth://totp/Cred30:${data.email}?secret=${newSecret}&issuer=Cred30`
        }
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }
    console.error('Erro ao recuperar 2FA:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Rota para admin desabilitar 2FA de um usuário
authRoutes.post('/admin/disable-2fa', authMiddleware, async (c) => {
  try {
    const userPayload = c.get('user');

    // Verificar se é admin
    if (!userPayload?.isAdmin) {
      return c.json({ success: false, message: 'Acesso negado' }, 403);
    }

    const { userId } = await c.req.json();

    if (!userId) {
      return c.json({ success: false, message: 'ID do usuário é obrigatório' }, 400);
    }

    const pool = getDbPool(c);

    // Trava de segurança de 48h após intervenção administrativa
    const lockDate = new Date();
    lockDate.setHours(lockDate.getHours() + 48);

    // Desabilitar 2FA do usuário
    const result = await pool.query(
      `UPDATE users 
       SET two_factor_enabled = FALSE, 
           two_factor_secret = NULL,
           security_lock_until = $1
       WHERE id = $2 
       RETURNING email`,
      [lockDate, userId]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    console.log(`[ADMIN] 2FA desabilitado pelo admin ${userPayload.id} para usuário ${userId}`);

    return c.json({
      success: true,
      message: `2FA desabilitado para ${result.rows[0].email}`
    });

  } catch (error) {
    console.error('Erro ao desabilitar 2FA:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Rota para admin resetar segurança de um usuário (Senha, Frase e 2FA)
authRoutes.post('/admin/reset-user-security', authMiddleware, async (c) => {
  try {
    const userPayload = c.get('user');

    // Verificar se é admin
    if (!userPayload?.isAdmin) {
      return c.json({ success: false, message: 'Acesso negado' }, 403);
    }

    const { userId, newPassword, newSecretPhrase, disable2FA } = await c.req.json();

    if (!userId) {
      return c.json({ success: false, message: 'ID do usuário é obrigatório' }, 400);
    }

    const pool = getDbPool(c);
    const updates: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    // Trava de segurança de 48h SEMPRE que o admin intervém em segurança
    const lockDate = new Date();
    lockDate.setHours(lockDate.getHours() + 48);

    updates.push(`security_lock_until = $${pIdx++}`);
    params.push(lockDate);

    if (newPassword) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updates.push(`password_hash = $${pIdx++}`);
      params.push(hashedPassword);
    }

    if (newSecretPhrase) {
      updates.push(`secret_phrase = $${pIdx++}`);
      params.push(newSecretPhrase);
    }

    if (disable2FA) {
      updates.push(`two_factor_enabled = FALSE`);
      updates.push(`two_factor_secret = NULL`);
    }

    if (updates.length <= 1) { // Só a trava (que já adicionamos)
      return c.json({ success: false, message: 'Nenhuma alteração solicitada' }, 400);
    }

    params.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${pIdx} RETURNING email`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    console.log(`[ADMIN] Reset de segurança realizado pelo admin ${userPayload.id} para usuário ${userId}: ${updates.join(', ')}`);

    return c.json({
      success: true,
      message: `Segurança atualizada para ${result.rows[0].email}. Conta em modo de segurança por 48h.`,
      lockUntil: lockDate.getTime()
    });

  } catch (error) {
    console.error('Erro no reset de segurança admin:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

export { authRoutes };