import apiClient from './client.js';

export const getResource = (path, params = {}) => apiClient.get(path, { params });

export const createResource = (path, data) => apiClient.post(path, data);

export const updateResource = (path, data) => apiClient.patch(path, data);

export const deleteResource = (path) => apiClient.delete(path);
