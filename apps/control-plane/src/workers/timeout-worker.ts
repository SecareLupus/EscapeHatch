import { withDb } from "../db/client.js";
import { setUserMuted } from "../matrix/synapse-adapter.js";

export async function processExpiredTimeouts(): Promise<void> {
  await withDb(async (db) => {
    // Find all expired but still active restrictions
    const expiredResult = await db.query<{ id: string, hub_id: string | null, server_id: string | null, channel_id: string | null, target_user_id: string }>(
      "select id, hub_id, server_id, channel_id, target_user_id from moderation_time_restrictions where status = 'active' and expires_at <= now()"
    );

    if (expiredResult.rows.length === 0) {
      return;
    }

    // Process each timeout removal
    for (const record of expiredResult.rows) {
      const roomIds: string[] = [];

      if (record.channel_id) {
        // Room-level timeout
        const chRow = await db.query<{ matrix_room_id: string }>(
          "select matrix_room_id from channels where id = $1",
          [record.channel_id]
        );
        if (chRow.rows[0]?.matrix_room_id) roomIds.push(chRow.rows[0].matrix_room_id);
      } else if (record.server_id) {
        // Space-level timeout
        const srvRow = await db.query<{ matrix_space_id: string }>(
          "select matrix_space_id from servers where id = $1",
          [record.server_id]
        );
        if (srvRow.rows[0]?.matrix_space_id) roomIds.push(srvRow.rows[0].matrix_space_id);
        
        const chRow = await db.query<{ matrix_room_id: string }>(
          "select matrix_room_id from channels where server_id = $1 and matrix_room_id is not null",
          [record.server_id]
        );
        roomIds.push(...chRow.rows.map(r => r.matrix_room_id));
      } else if (record.hub_id) {
        // Hub-level timeout
        const servers = await db.query<{ id: string, matrix_space_id: string }>(
          "select id, matrix_space_id from servers where hub_id = $1",
          [record.hub_id]
        );
        for (const srv of servers.rows) {
          if (srv.matrix_space_id) roomIds.push(srv.matrix_space_id);
          const chRow = await db.query<{ matrix_room_id: string }>(
            "select matrix_room_id from channels where server_id = $1 and matrix_room_id is not null",
            [srv.id]
          );
          roomIds.push(...chRow.rows.map(r => r.matrix_room_id));
        }
      }

      // 2. Unmute them
      const uniqueRoomIds = [...new Set(roomIds)];
      if (uniqueRoomIds.length > 0) {
        await Promise.allSettled(
          uniqueRoomIds.map(roomId => setUserMuted(roomId, record.target_user_id, false))
        );
      }

      // 3. Mark as expired
      await db.query(
        "update moderation_time_restrictions set status = 'expired', updated_at = now() where id = $1",
        [record.id]
      );
    }
    
    console.log(`[Timeout Worker] Processed ${expiredResult.rows.length} expired timeouts.`);
  });
}

let workerInterval: NodeJS.Timeout | null = null;

export function startTimeoutWorker(intervalMs = 60000) {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    void processExpiredTimeouts().catch(err => {
      console.error("[Timeout Worker] Error processing timeouts:", err);
    });
  }, intervalMs);
  
  // Also run once on startup
  setTimeout(() => {
    void processExpiredTimeouts().catch(console.error);
  }, 5000);
}

export function stopTimeoutWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
