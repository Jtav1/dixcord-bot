import { apiFetch } from "./http.js";

/**
 * Raw plusplus tracking events, paginated.
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<{ items: Array<{id:number,type:string,string:string|null,value:string|null,voterPlatformId:string|null,timestamp:string}>, total: number }>}
 */
export async function fetchPlusplusEvents({ limit = 25, offset = 0 } = {}) {
  const data = await apiFetch(
    `/events/plusplus?app=discord&limit=${limit}&offset=${offset}`,
    undefined,
    "PlusPlus events",
  );
  return { items: data.events, total: data.total };
}

/**
 * Raw repost accusation events, paginated.
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<{ items: Array<{id:number,msgid:string,msgcontents:string|null,useridPlatformId:string,accuserPlatformId:string,timestamp:string}>, total: number }>}
 */
export async function fetchRepostEvents({ limit = 25, offset = 0 } = {}) {
  const data = await apiFetch(
    `/events/reposts?app=discord&limit=${limit}&offset=${offset}`,
    undefined,
    "Repost events",
  );
  return { items: data.events, total: data.total };
}
