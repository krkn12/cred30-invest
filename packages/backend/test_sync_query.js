require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testSyncQuery() {
    try {
        const userId = 1; // Testing with user 1
        const result = await pool.query(`
      WITH user_stats AS (
        SELECT 
          u.balance,
          u.score,
          u.membership_type,
          u.is_verified,
          u.security_lock_until,
          (SELECT COUNT(*) FROM quotas WHERE user_id = u.id AND status = 'ACTIVE') as quota_count,
          (SELECT COALESCE(SUM(total_repayment), 0) FROM loans WHERE user_id = u.id AND status IN ('APPROVED', 'PAYMENT_PENDING')) as debt_total
        FROM users u WHERE u.id = $1
      ),
      recent_tx AS (
        SELECT json_agg(t) FROM (
          SELECT id, type, amount, created_at as date, description, status, metadata
          FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20
        ) t
      ),
      active_quotas AS (
        SELECT json_agg(q) FROM (
          SELECT id, user_id as "userId", purchase_price as "purchasePrice", current_value as "currentValue", purchase_date as "purchaseDate", status
          FROM quotas WHERE user_id = $1 ORDER BY purchase_date DESC
        ) q
      ),
      active_loans AS (
        SELECT json_agg(l) FROM (
          SELECT id, user_id as "userId", amount, total_repayment as "totalRepayment", installments, interest_rate as "interestRate", status, created_at as "createdAt", due_date as "dueDate"
          FROM loans WHERE user_id = $1 ORDER BY created_at DESC
        ) l
      )
      SELECT 
        (SELECT row_to_json(us) FROM user_stats us) as user_stats,
        (SELECT * FROM recent_tx) as transactions,
        (SELECT * FROM active_quotas) as quotas,
        (SELECT * FROM active_loans) as loans
    `, [userId]);
        console.log('Query Success!');
        console.log(JSON.stringify(result.rows[0], null, 2));
    } catch (err) {
        console.error('Query Failed:', err.message);
    } finally {
        await pool.end();
    }
}
testSyncQuery();
