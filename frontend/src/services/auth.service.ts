import { api } from "@/lib/api-client";

export const AuthService = {
  async login(email: string, password: string) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response?.data?.token) {
      api.setToken(response.data.token);
    }

    return response?.data;
  },

  async getCurrentUser() {
    if (!api.getToken()) {
      return null;
    }

    const response = await api.fetchWithRetry(`${api.baseURL}/api/auth/me`);
    return response?.data;
  },

  async updateProfile(data: { nome?: string; avatar?: string }) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/auth/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response?.data;
  },

  logout() {
    api.setToken(null);
  },

  async forgotPassword(email: string) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return response?.data;
  },

  async resetPassword(token: string, newPassword: string) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    return response?.data;
  },
};
