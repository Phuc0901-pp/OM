import api from './api';
import { syncQueue } from './offline';

export const authService = {
 login: async (email: string, password: string) => {
 const response = await api.post('/auth/login', {
 email,
 password
 });
 // Clear the token-expired flag so the offline sync queue resumes automatically
 syncQueue.resetTokenExpired();
 return response.data;
 },

 logout: async () => {
 try {
 await api.post('/auth/logout');
 } catch {
 // Best-effort — ignore network errors on logout
 }
 }
};
