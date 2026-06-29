import * as api from "./client.js";

/**
 * Fetch all configurations from the web API.
 * GET /api/config returns { entries: [ { config, value } ] }.
 * @returns {Promise<Array<{ config: string, value: string }>>}
 */
export const getAllConfigurations = async () => {
  const { data } = await api.get("/api/config");
  if (!data?.ok || !Array.isArray(data.entries)) {
    throw new Error(data?.error || "Failed to load configuration from API");
  }
  return data.entries;
};

/**
 * Add configuration via POST /api/config.
 * @param {string} config - Configuration item name
 * @param {string} value - Value
 * @returns {Promise<void>}
 */
export const addConfiguration = async (config, value) => {
  try {
    const { data } = await api.post("/api/config", {
      config,
      value: value ?? "",
    });
    if (!data?.ok) {
      throw new Error(data?.error || "Failed to create configuration");
    }
  } catch (err) {
    const message = err.response?.data?.error || err.message;
    throw new Error(message);
  }
};

/**
 * Update configuration value by name via the web API.
 * PUT /api/config with body { config, value }. Only updates if the item exists.
 * @param {string} config - Configuration item name
 * @param {string} value - New value
 * @returns {Promise<void>}
 * @throws {Error} If the API returns an error (e.g. 404 when item does not exist)
 */
export const updateConfigurationByName = async (config, value) => {
  try {
    const { data } = await api.put("/api/config", {
      config,
      value: value ?? "",
    });
    if (!data?.ok) {
      throw new Error(data?.error || "Failed to update configuration");
    }
  } catch (err) {
    const message = err.response?.data?.error || err.message;
    throw new Error(message);
  }
};
