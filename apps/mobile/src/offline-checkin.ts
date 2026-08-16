import * as SQLite from "expo-sqlite";

type QueuedScan = {
  id?: number;
  eventId: string;
  ticketUuid: string;
  deviceId: string;
  scannedAt: string;
  rawPayload: string;
};

const db = SQLite.openDatabaseSync("eventflow-checkin.db");

export async function initDatabase() {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS checkin_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      ticket_uuid TEXT NOT NULL,
      device_id TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      raw_payload TEXT NOT NULL,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_checkin_queue_event_synced ON checkin_queue(event_id, synced_at);
  `);
}

export async function queueScan(scan: QueuedScan) {
  await db.runAsync(
    "INSERT INTO checkin_queue (event_id, ticket_uuid, device_id, scanned_at, raw_payload) VALUES (?, ?, ?, ?, ?)",
    scan.eventId,
    scan.ticketUuid,
    scan.deviceId,
    scan.scannedAt,
    scan.rawPayload
  );
}

export async function listQueuedScans(eventId?: string) {
  const params = eventId ? [eventId] : [];
  const where = eventId ? "AND event_id = ?" : "";
  return db.getAllAsync<QueuedScanRow>(`SELECT * FROM checkin_queue WHERE synced_at IS NULL ${where} ORDER BY scanned_at ASC`, params);
}

export async function syncQueuedScans({ apiUrl, token, eventId, deviceId }: { apiUrl: string; token: string; eventId: string; deviceId: string }) {
  const queued = await listQueuedScans(eventId);
  if (!queued.length) return { acceptedScans: 0, conflictScans: 0 };

  const response = await fetch(`${apiUrl}/enterprise/mobile/checkin-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      eventId,
      deviceId,
      startedAt: queued[0].scanned_at,
      finishedAt: queued[queued.length - 1].scanned_at,
      scans: queued.map((scan) => ({
        ticketUuid: scan.ticket_uuid,
        scannedAt: scan.scanned_at,
        rawPayload: scan.raw_payload
      }))
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Falha ao sincronizar." }));
    throw new Error(error.message ?? "Falha ao sincronizar.");
  }

  const result = await response.json();
  const ids = queued.map((scan) => scan.id).filter(Boolean);
  if (ids.length) {
    await db.runAsync(`UPDATE checkin_queue SET synced_at = ? WHERE id IN (${ids.map(() => "?").join(",")})`, new Date().toISOString(), ...ids);
  }
  return result;
}

type QueuedScanRow = {
  id: number;
  event_id: string;
  ticket_uuid: string;
  device_id: string;
  scanned_at: string;
  raw_payload: string;
  synced_at?: string;
};
