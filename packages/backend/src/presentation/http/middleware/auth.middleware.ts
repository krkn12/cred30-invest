import { MiddlewareHandler } from 'hono';
import { verify } from 'jsonwebtoken';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');

    console.log('authMiddleware - Header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('authMiddleware - Token não fornecido');
      return c.json({ success: false, message: 'Token não fornecido' }, 401);
    }

    const token = authHeader.substring(7); // Remove "Bearer " do início

    console.log('authMiddleware - Token extraído:', token.substring(0, 20) + '...');

    let decoded: any = null;

    try {
      decoded = verify(token, process.env.JWT_SECRET || 'default_secret') as any;

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
      'SELECT id, name, email, balance, referral_code, is_admin, score, created_at, pix_key FROM users WHERE id = $1',
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

    // Adicionar usuário ao contexto da requisição
    const userContext: UserContext = {
      id: user.id, // Manter como UUID string
      name: user.name,
      email: user.email,
      balance: parseFloat(user.balance),
      joinedAt: new Date(user.created_at).getTime(),
      referralCode: user.referral_code,
      isAdmin: Boolean(user.is_admin), // Garantir que seja booleano
      score: user.score || 0,
      pixKey: user.pix_key,
    };

    // Log para depuração
    console.log('Usuário autenticado:', {
      id: userContext.id,
      name: userContext.name,
      isAdmin: userContext.isAdmin,
      isAdminType: typeof userContext.isAdmin
    });

    c.set('user', userContext);

    // Verificar se foi setado corretamente
    const userAfterSet = c.get('user');
    console.log('Usuário após set:', {
      exists: !!userAfterSet,
      id: userAfterSet?.id,
      isAdmin: userAfterSet?.isAdmin
    });

    await next();
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ success: false, message: 'Token inválido ou expirado' }, 401);
    }

    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
};

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');

  // Logs detalhados para depuração
  console.log('adminMiddleware - Verificação:', {
    userExists: !!user,
    userId: user?.id,
    userEmail: user?.email,
    userIsAdmin: user?.isAdmin,
    userIsAdminType: typeof user?.isAdmin,
    isAdminCheck: user?.isAdmin !== true
  });

  // Verificação apenas por isAdmin === true
  const isAdminUser = user?.isAdmin === true;

  if (!user || !isAdminUser) {
    console.log('adminMiddleware - Acesso negado:', {
      reason: !user ? 'Usuário não encontrado no contexto' : 'isAdmin não é true',
      userIsAdmin: user?.isAdmin,
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