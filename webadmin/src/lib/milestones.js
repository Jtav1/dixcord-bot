import { apiFetch, apiFetchJson } from "./http.js";

/**
 * List all milestones.
 * @returns {Promise<Array<{id:number,quantity:number,type:string,item:string|null,message:string,object:string,achieved:boolean}>>}
 */
export async function fetchMilestones() {
  const data = await apiFetch("/milestones", undefined, "Milestones");
  return data.milestones;
}

/**
 * Fetch the dictionary of valid milestone type values.
 * @returns {Promise<Record<string,{itemRequired:boolean,description:string}>>}
 */
export async function fetchMilestoneTypes() {
  const data = await apiFetch("/milestones/types", undefined, "Milestone types");
  return data.types;
}

/**
 * @param {{quantity:number,type:string,item?:string|null,message:string,object:string}} payload
 * @returns {Promise<object>}
 */
export async function createMilestone(payload) {
  return apiFetchJson("POST", "/milestones", payload, "Create milestone");
}

/**
 * @param {number} id
 * @param {Partial<{quantity:number,type:string,item:string|null,message:string,object:string,achieved:boolean}>} payload
 * @returns {Promise<object>}
 */
export async function updateMilestone(id, payload) {
  return apiFetchJson("PUT", `/milestones/${id}`, payload, "Update milestone");
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteMilestone(id) {
  await apiFetch(`/milestones/${id}`, { method: "DELETE" }, "Delete milestone");
}
