import apiClient from './client.js';

export const loginRequest = (credentials) => apiClient.post('/auth/login', credentials);

export const getProfileRequest = () => apiClient.get('/auth/profile');
