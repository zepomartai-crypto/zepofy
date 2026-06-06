import api from "./api";

// get all flows
export const getFlows = () => api.get("/flows");

// get single flow
export const getFlowById = (id) => api.get(`/flows/${id}`);

// create flow
export const createFlow = (data) => api.post("/flows", data);

// update flow
export const updateFlow = (id, data) =>
  api.put(`/flows/${id}`, data);
