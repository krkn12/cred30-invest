import { Hono } from 'hono';
import { sign } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { getDbPool, generateReferralCode } from '../../../infrastructure/database/postgresql/connection/pool';
import { authRateLimit } from '../middleware/rate-limit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { twoFactorService } from '../../../application/services/two-factor.service';

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
    console.log('Buscando usuário com email:', validatedData.email);
    const result = await pool.query(
      'SELECT id, name, email, password_hash, secret_phrase, pix_key, referral_code, is_admin, balance, score, created_at, is_email_verified, two_factor_enabled, two_factor_secret FROM users WHERE email = $1',
      [validatedData.email]
    );

    let user = result.rows[0];
    let isAdmin = user?.is_admin || false;

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

      if (!user.two_factor_enabled && user.secret_phrase !== validatedData.secretPhrase) {
        return c.json({ success: false, message: 'Frase secreta incorreta' }, 401);
      }
    }

    // Gerar token JWT
    const token = sign(
      { userId: user.id, isAdmin: isAdmin },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

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
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Rota de registro
authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = registerSchema.parse(body);

    const pool = getDbPool(c);

    // Verificar se email já existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [validatedData.email]
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
      `INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, balance, referral_code, is_admin, score, two_factor_secret, two_factor_enabled, is_email_verified, accepted_terms_at)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 0, $8, FALSE, TRUE, CURRENT_TIMESTAMP)
       RETURNING id, name, email, pix_key, balance, score, created_at, referral_code, is_admin`,
      [
        validatedData.name,
        validatedData.email,
        hashedPassword,
        validatedData.secretPhrase,
        validatedData.pixKey,
        referralCode,
        isAdminEmail,
        tfaSecret
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

    // Atualizar senha
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, userId]
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

    await pool.query(
      'UPDATE users SET two_factor_enabled = TRUE WHERE id = $1',
      [id]
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

export { authRoutes };