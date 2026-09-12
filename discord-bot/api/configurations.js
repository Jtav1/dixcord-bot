import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * Fetch all configurations from the web API.
 * GET /api/config?app=&guildId= returns { entries: [ { config, value } ] }.
 * @returns {Promise<Array<{ config: string, value: string }>>}
 */
export const getAllConfigurations = async () => {
  const { data } = await api.get("/api/config", {
    params: { app: "discord", guildId },
  });
  if (!data?.ok || !Array.isArray(data.entries)) {
    throw new Error(data?.error || "Failed to load configuration from API");
  }
  return data.entries;
};
