import { apiFetch } from "./http.js";

/**
 * Paginated audit log of admin mutations.
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<{ items: Array<{id:number,user_id:number,user_email:string|null,action:string,resource:string,resource_id:string|null,details:object,created_at:string}>, total: number }>}
 */
export async function fetchAuditLog({ limit = 25, offset = 0 } = {}) {
  const data = await apiFetch(`/audit-log?limit=${limit}&offset=${offset}`, undefined, "Audit log");
  return { items: data.auditLog, total: data.total };
}
