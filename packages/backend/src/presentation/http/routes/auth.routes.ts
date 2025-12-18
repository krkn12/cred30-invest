import { Hono } from 'hono';
import { sign } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { getDbPool, generateReferralCode } from '../../../infrastructure/database/postgresql/connection/pool';
import { authRateLimit } from '../middleware/rate-limit.middleware';

const authRoutes = new Hono();

// Aplicar rate limiting às rotas de autenticação
authRoutes.post('/login', authRateLimit);
authRoutes.post('/register', authRateLimit);
authRoutes.post('/reset-password', authRateLimit);

// Esquemas de validação
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  secretPhrase: z.string().min(3),
});

const registerSchema = z.object({
  name: z.string().min(3),
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

    // Buscar usuário no banco
    console.log('Buscando usuário com email:', validatedData.email);
    const result = await pool.query(
      'SELECT id, name, email, password_hash, secret_phrase, pix_key, referral_code, is_admin, balance, score, created_at FROM users WHERE email = $1',
      [validatedData.email]
    );

    console.log('Resultado da consulta:', result.rows);

    if (result.rows.length === 0) {
      console.log('Usuário não encontrado no banco');
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    const user = result.rows[0];

    // Verificar senha e frase secreta
    console.log('Verificando credenciais para usuário:', user.email);
    const isPasswordValid = user.password_hash ?
      await bcrypt.compare(validatedData.password, user.password_hash) :
      validatedData.password === user.password_hash;

    console.log('Senha válida:', isPasswordValid);
    console.log('Frase secreta DB:', user.secret_phrase);
    console.log('Frase secreta enviada:', validatedData.secretPhrase);
    console.log('Frase secreta válida:', user.secret_phrase === validatedData.secretPhrase);

    if (!isPasswordValid || user.secret_phrase !== validatedData.secretPhrase) {
      console.log('Credenciais inválidas');
      return c.json({ success: false, message: 'Credenciais inválidas' }, 401);
    }

    // Gerar token JWT
    const token = sign(
      { userId: user.id, isAdmin: user.is_admin },
      process.env.JWT_SECRET || 'default_secret',
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
          balance: parseFloat(user.balance),
          joinedAt: user.created_at,
          referralCode: user.referral_code,
          isAdmin: user.is_admin,
          score: user.score,
        },
        token,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
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

    // Verificar se já existe um administrador no sistema
    // Considerando tanto o admin hardcoded quanto usuários no banco
    const adminCheck = await pool.query(
      'SELECT id FROM users WHERE is_admin = true LIMIT 1'
    );

    console.log('Admin check result:', adminCheck.rows);
    console.log('Admin check count:', adminCheck.rows.length);
    console.log('Email being registered:', validatedData.email);

    // Modificação: Primeiro usuário será admin se não existirem admins no banco
    // O admin hardcoded não conta para esta verificação, pois ele não está no banco
    const isFirstUser = adminCheck.rows.length === 0;

    console.log('Is first user:', isFirstUser);

    // Hash da senha
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Verificar código de indicação e aplicar bônus
    if (validatedData.referralCode) {
      const referrerResult = await pool.query(
        'SELECT id FROM users WHERE referral_code = $1',
        [validatedData.referralCode.toUpperCase()]
      );

      if (referrerResult.rows.length > 0) {
        const referrerId = referrerResult.rows[0].id;

        // Aplicar bônus de indicação
        await pool.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [5.00, referrerId]
        );

        // Registrar transação de bônus
        await pool.query(
          'INSERT INTO transactions (user_id, type, amount, description, status) VALUES ($1, $2, $3, $4, $5)',
          [referrerId, 'REFERRAL_BONUS', 5.00, `Bônus indicação: ${validatedData.name}`, 'APPROVED']
        );
      }
    }

    // Criar novo usuário
    const referralCode = generateReferralCode();

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, balance, referral_code, is_admin, score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, email, pix_key, balance, score, created_at, referral_code, is_admin`,
      [
        validatedData.name,
        validatedData.email,
        hashedPassword,
        validatedData.secretPhrase,
        validatedData.pixKey,
        0,
        referralCode,
        isFirstUser, // Define como administrador se for o primeiro usuário
        300
      ]
    );

    const newUser = result.rows[0];

    // Gerar token JWT
    const token = sign(
      { userId: newUser.id, isAdmin: newUser.is_admin },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    // Mensagem personalizada se for o primeiro usuário (administrador)
    const message = isFirstUser
      ? 'Usuário criado com sucesso! Você foi definido como o primeiro administrador do sistema.'
      : 'Usuário criado com sucesso';

    return c.json({
      success: true,
      message,
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          pixKey: newUser.pix_key,
          balance: parseFloat(newUser.balance),
          joinedAt: newUser.created_at,
          referralCode: newUser.referral_code,
          isAdmin: newUser.is_admin,
        },
        token,
      },
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
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

    return c.json({
      success: true,
      message: 'Senha redefinida com sucesso',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    console.error('Erro no reset de senha:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
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