import { apiFetch, apiFetchJson } from "./http.js";

/**
 * Top/bottom plusplus scores.
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{ top: Array<{string:string,typestr:string,total:number}>, bottom: Array<{string:string,typestr:string,total:number}> }>}
 */
export async function fetchPlusplusLeaderboard({ limit = 10 } = {}) {
  return apiFetchJson("POST", "/leaderboards/plusplus", { app: "discord", limit }, "PlusPlus leaderboard");
}

/**
 * Top plusplus voters by vote count.
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{ topVoters: Array<{voter:string,total:number}> }>}
 */
export async function fetchPlusplusTopVoters({ limit = 10 } = {}) {
  return apiFetchJson("POST", "/leaderboards/plusplus/top-voters", { app: "discord", limit }, "Top voters");
}

/**
 * Top used emojis, paginated.
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<{ items: Array<{emoji:{emoid:string,app:string,emoji:string,frequency:number,animated:number,type:string}}>, total: number }>} `emoji` is the full guild_emojis row — use `.emoji.emoji` for display name, not `.emoji.emoid`.
 */
export async function fetchEmojiLeaderboard({ limit = 10, offset = 0 } = {}) {
  const data = await apiFetchJson("POST", "/leaderboards/emoji", { limit, offset }, "Emoji leaderboard");
  return { items: data.top, total: data.total };
}

/**
 * Top users by emoji usage, paginated.
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<{ items: Array<{userid:string,name:string,total:number}>, total: number }>}
 */
export async function fetchEmojiUserLeaderboard({ limit = 10, offset = 0 } = {}) {
  const data = await apiFetchJson(
    "POST",
    "/leaderboards/emoji/users",
    { app: "discord", limit, offset },
    "Emoji user leaderboard",
  );
  return { items: data.users, total: data.total };
}

/**
 * Top used stickers, paginated.
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<{ items: Array<{emoji:{emoid:string,app:string,emoji:string,frequency:number,animated:number,type:string}}>, total: number }>} `emoji` is the full guild_emojis row — use `.emoji.emoji` for display name, not `.emoji.emoid`.
 */
export async function fetchStickerLeaderboard({ limit = 10, offset = 0 } = {}) {
  const data = await apiFetchJson("POST", "/leaderboards/sticker", { limit, offset }, "Sticker leaderboard");
  return { items: data.top, total: data.total };
}

/**
 * Top users by sticker usage, paginated.
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<{ items: Array<{userid:string,name:string,total:number}>, total: number }>}
 */
export async function fetchStickerUserLeaderboard({ limit = 10, offset = 0 } = {}) {
  const data = await apiFetchJson(
    "POST",
    "/leaderboards/sticker/users",
    { app: "discord", limit, offset },
    "Sticker user leaderboard",
  );
  return { items: data.users, total: data.total };
}

/**
 * Top reposters by accusation count.
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{ top: Array<{userid:string,count:number}> }>}
 */
export async function fetchRepostLeaderboard({ limit = 10 } = {}) {
  return apiFetchJson("POST", "/leaderboards/repost", { app: "discord", limit }, "Repost leaderboard");
}
