import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

/**
 * Count consumers attributed to a campus using the same logic as GET /admin/users?campusId=:
 * primary campus = campus of barbers they've booked most often, fallback to signup campusId.
 */
export async function countCampusConsumers(campusId: string): Promise<number> {
  const result = await pool.query(
    `WITH consumer_booking_campuses AS (
       SELECT
         bk."consumerId",
         bu."campusId" AS barber_campus_id,
         COUNT(*) AS booking_count
       FROM bookings bk
       JOIN barbers b ON bk."barberId" = b.id
       JOIN users bu ON b."userId" = bu.id
       WHERE bk.status IN ('COMPLETED', 'PAID', 'ACCEPTED', 'IN_PROGRESS')
       GROUP BY bk."consumerId", bu."campusId"
     ),
     primary_campus AS (
       SELECT DISTINCT ON ("consumerId")
         "consumerId",
         barber_campus_id AS primary_campus_id
       FROM consumer_booking_campuses
       ORDER BY "consumerId", booking_count DESC
     )
     SELECT COUNT(*) AS total
     FROM users u
     LEFT JOIN primary_campus pc ON u.id = pc."consumerId"
     WHERE u.role = 'CONSUMER'
       AND COALESCE(pc.primary_campus_id, u."campusId") = $1::uuid`,
    [campusId]
  );
  return parseInt(result.rows[0]?.total || '0', 10);
}

/**
 * Admins may access any campus. Campus managers may access only their campus.
 */
export async function assertCampusMetricsAccess(req: AuthRequest, campusId: string): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Not authenticated');

  if (!campusId || campusId === 'undefined') {
    throw new ApiError(400, 'Valid campusId is required');
  }

  const userResult = await pool.query(`SELECT role, "campusId" FROM users WHERE id = $1`, [userId]);
  if (userResult.rows.length === 0) throw new ApiError(401, 'User not found');

  const { role, campusId: userCampusId } = userResult.rows[0];
  if (role === 'ADMIN') return;
  if (role === 'CAMPUS_MANAGER' && userCampusId === campusId) return;

  const managerCheck = await pool.query(
    `SELECT b.id FROM barbers b
     JOIN users u ON b."userId" = u.id
     WHERE b."userId" = $1
       AND b."campusId" = $2
       AND (b."isCampusManager" = true OR u.role = 'CAMPUS_MANAGER')`,
    [userId, campusId]
  );

  if (managerCheck.rows.length === 0) {
    throw new ApiError(403, 'Campus manager access required');
  }
}
