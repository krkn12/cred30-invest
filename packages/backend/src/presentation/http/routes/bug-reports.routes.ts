import { Hono } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

export const bugReportsRoutes = new Hono();

// Schema de validação para criar bug report
const createBugReportSchema = z.object({
    title: z.string().min(5, 'Título muito curto').max(255),
    description: z.string().min(20, 'Descrição muito curta'),
    category: z.enum(['general', 'payment', 'ui', 'performance', 'other']).optional().default('general'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional().default('low'),
    deviceInfo: z.string().optional(),
});

// POST /bugs - Criar um bug report (usuário autenticado)
bugReportsRoutes.post('/', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const body = await c.req.json();

        const validatedData = createBugReportSchema.parse(body);

        const result = await getDbPool().query(
            `INSERT INTO bug_reports (user_id, user_email, user_name, title, description, category, severity, device_info)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
                user.id,
                user.email,
                user.name,
                validatedData.title,
                validatedData.description,
                validatedData.category,
                validatedData.severity,
                validatedData.deviceInfo || null
            ]
        );

        return c.json({
            success: true,
            message: 'Bug reportado com sucesso! Nossa equipe irá analisar.',
            data: { id: result.rows[0].id }
        });
    } catch (error: any) {
        console.error('Erro ao criar bug report:', error);
        if (error instanceof z.ZodError) {
            return c.json({ success: false, message: error.errors[0].message }, 400);
        }
        return c.json({ success: false, message: error.message || 'Erro interno' }, 500);
    }
});

// GET /bugs/my - Listar meus bugs reportados (usuário autenticado)
bugReportsRoutes.get('/my', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;

        const result = await getDbPool().query(
            `SELECT id, title, category, severity, status, created_at, admin_notes, resolved_at
             FROM bug_reports
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [user.id]
        );

        return c.json({ success: true, data: result.rows });
    } catch (error: any) {
        console.error('Erro ao listar bugs:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});

// ==================== ROTAS ADMINISTRATIVAS ====================

// GET /bugs/admin - Listar todos os bugs (admin)
bugReportsRoutes.get('/admin', authMiddleware, adminMiddleware, async (c) => {
    try {
        const status = c.req.query('status') || 'open';

        const result = await getDbPool().query(
            `SELECT br.*, 
                    (SELECT COUNT(*) FROM bug_reports WHERE status = 'open') as total_open,
                    (SELECT COUNT(*) FROM bug_reports WHERE status = 'in_progress') as total_in_progress
             FROM bug_reports br
             WHERE ($1 = 'all' OR br.status = $1)
             ORDER BY 
                CASE br.severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    ELSE 4 
                END,
                br.created_at DESC
             LIMIT 100`,
            [status]
        );

        return c.json({
            success: true,
            data: result.rows,
            counts: {
                open: result.rows[0]?.total_open || 0,
                inProgress: result.rows[0]?.total_in_progress || 0
            }
        });
    } catch (error: any) {
        console.error('Erro ao listar bugs (admin):', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});

// PATCH /bugs/admin/:id - Atualizar status de um bug (admin)
bugReportsRoutes.patch('/admin/:id', authMiddleware, adminMiddleware, async (c) => {
    try {
        const admin = c.get('user') as any;
        const bugId = parseInt(c.req.param('id'));
        const body = await c.req.json();

        const { status, adminNotes } = body;

        if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
            return c.json({ success: false, message: 'Status inválido' }, 400);
        }

        const resolvedAt = status === 'resolved' || status === 'closed' ? 'CURRENT_TIMESTAMP' : 'NULL';
        const resolvedBy = status === 'resolved' || status === 'closed' ? admin.id : null;

        await getDbPool().query(
            `UPDATE bug_reports 
             SET status = $1, 
                 admin_notes = COALESCE($2, admin_notes),
                 resolved_by = COALESCE($3, resolved_by),
                 resolved_at = ${status === 'resolved' || status === 'closed' ? 'CURRENT_TIMESTAMP' : 'resolved_at'},
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [status, adminNotes, resolvedBy, bugId]
        );

        return c.json({ success: true, message: 'Bug atualizado com sucesso!' });
    } catch (error: any) {
        console.error('Erro ao atualizar bug:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});

// DELETE /bugs/admin/:id - Excluir um bug (admin)
bugReportsRoutes.delete('/admin/:id', authMiddleware, adminMiddleware, async (c) => {
    try {
        const bugId = parseInt(c.req.param('id'));

        await getDbPool().query('DELETE FROM bug_reports WHERE id = $1', [bugId]);

        return c.json({ success: true, message: 'Bug excluído com sucesso!' });
    } catch (error: any) {
        console.error('Erro ao excluir bug:', error);
        return c.json({ success: false, message: error.message }, 500);
    }
});
