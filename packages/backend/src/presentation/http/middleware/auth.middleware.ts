import { MiddlewareHandler } from 'hono';
import { verify } from 'jsonwebtoken';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Tentar pegar do query param (usado em EventSource/SSE)
      token = c.req.query('token') || '';
    }

    if (!token) {
      console.log('authMiddleware - Token não fornecido');
      return c.json({ success: false, message: 'Token não fornecido' }, 401);
    }

    console.log('authMiddleware - Token extraído:', token.substring(0, 20) + '...');

    let decoded: any = null;

    try {
      decoded = verify(token, process.env.JWT_SECRET as string) as any;

      console.log('authMiddleware - Token decodificado:', {
        userId: decoded?.userId,
        isAdmin: decoded?.isAdmin,
        hasUserId: !!decoded?.userId
      });

      if (!decoded || !decoded.userId) {
        console.log('authMiddleware - Token inválido ou sem userId');
        return c.json({ success: false, message: 'Token inválido' }, 401);
      }
    } catch (error) {
      console.log('authMiddleware - Erro ao verificar token:', error);
      return c.json({ success: false, message: 'Token inválido' }, 401);
    }

    // Log para depuração do token
    console.log('Token decodificado:', {
      userId: decoded.userId,
      isAdmin: decoded.isAdmin,
      isAdminType: typeof decoded.isAdmin
    });

    // Buscar usuário no banco de dados para obter informações atualizadas
    const pool = getDbPool(c);
    const result = await pool.query(
      'SELECT id, name, email, balance, referral_code, is_admin, role, status, score, created_at, pix_key, two_factor_enabled, cpf, security_lock_until, membership_type FROM users WHERE id = $1',
      [decoded.userId]
    );

    console.log('Resultado do banco:', {
      querySuccess: result.rows.length > 0,
      userFound: result.rows[0] || null
    });

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    const user = result.rows[0];

    // Verificar se o usuário está bloqueado
    if (user.status !== 'ACTIVE') {
      return c.json({
        success: false,
        message: 'Conta suspensa ou bloqueada. Entre em contato com o suporte.'
      }, 403);
    }

    // Adicionar usuário ao contexto da requisição
    const userContext: UserContext = {
      id: user.id, // Manter como UUID string
      name: user.name,
      email: user.email,
      balance: parseFloat(user.balance),
      joinedAt: new Date(user.created_at).getTime(),
      referralCode: user.referral_code,
      isAdmin: Boolean(user.is_admin), // Garantir que seja booleano
      role: user.role || 'MEMBER',
      status: user.status || 'ACTIVE',
      score: user.score || 0,
      pixKey: user.pix_key,
      twoFactorEnabled: Boolean(user.two_factor_enabled),
      cpf: user.cpf || null,
      securityLockUntil: user.security_lock_until ? new Date(user.security_lock_until).getTime() : undefined,
      membership_type: user.membership_type || 'FREE'
    };

    // Log para depuração
    console.log('Usuário autenticado:', {
      id: userContext.id,
      name: userContext.name,
      isAdmin: userContext.isAdmin,
      role: userContext.role,
      status: userContext.status,
      lockUntil: user.security_lock_until
    });

    c.set('user', userContext);

    // Verificar se foi setado corretamente
    const userAfterSet = c.get('user');
    console.log('Usuário após set:', {
      exists: !!userAfterSet,
      id: userAfterSet?.id,
      isAdmin: userAfterSet?.isAdmin,
      role: userAfterSet?.role
    });

    await next();
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ success: false, message: 'Token inválido ou expirado' }, 401);
    }

    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
};

// Middleware para bloquear ações sensíveis se houver trava de segurança ativa
export const securityLockMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');

  if (user?.securityLockUntil) {
    const now = Date.now();
    if (now < user.securityLockUntil) {
      const remainingHours = Math.ceil((user.securityLockUntil - now) / (1000 * 60 * 60));
      return c.json({
        success: false,
        message: `Por segurança, sua conta está em modo 'Apenas Visualização' por mais ${remainingHours} horas após o recente reset de segurança. Suas transações e saques serão liberados após este período.`,
        lockRemainingHours: remainingHours
      }, 403);
    }
  }

  await next();
};

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');

  // Logs detalhados para depuração
  console.log('adminMiddleware - Verificação:', {
    userExists: !!user,
    userId: user?.id,
    userEmail: user?.email,
    userIsAdmin: user?.isAdmin,
    userRole: user?.role,
    isAdminCheck: user?.isAdmin !== true && user?.role !== 'ADMIN'
  });

  // Verificação por isAdmin === true ou role === 'ADMIN'
  const isAdminUser = user?.isAdmin === true || user?.role === 'ADMIN';

  if (!user || !isAdminUser) {
    console.log('adminMiddleware - Acesso negado:', {
      reason: !user ? 'Usuário não encontrado no contexto' : 'Ação proibida para este nível de acesso',
      userIsAdmin: user?.isAdmin,
      userRole: user?.role,
      userEmail: user?.email,
      isAdminUser
    });

    return c.json({
      success: false,
      message: 'Acesso negado. Permissão de administrador necessária.'
    }, 403);
  }

  console.log('adminMiddleware - Acesso permitido para:', user.email);
  await next();
};

export const attendantMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');

  // Atendentes ou Admins podem acessar áreas de atendimento
  const hasAccess = user?.role === 'ATTENDANT' || user?.role === 'ADMIN' || user?.isAdmin === true;

  if (!user || !hasAccess) {
    return c.json({
      success: false,
      message: 'Acesso negado. Permissão de atendente necessária.'
    }, 403);
  }

  await next();
};
