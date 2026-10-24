import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001/api';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
});

const isPublicAuthUrl = (url) => {
  if (!url) return false;
  return (
    url.includes('/accounts/login/') ||
    url.includes('/accounts/token/refresh/') ||
    url.includes('/accounts/forgot-password/') ||
    url.includes('/accounts/reset-password/')
  );
};

// Request Interceptor: Attach JWT Token from Session Storage & anti-cache headers
axiosClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token');
    if (token && !isPublicAuthUrl(config.url)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.headers['Expires'] = '0';
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto-refresh expired tokens
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isPublic = isPublicAuthUrl(originalRequest?.url);
    if (error.response?.status === 401 && !originalRequest._retry && !isPublic) {
      originalRequest._retry = true;
      try {
        const refreshToken = sessionStorage.getItem('refresh_token');
        if (refreshToken) {
          const res = await axios.post(`${API_BASE_URL}/accounts/token/refresh/`, {
            refresh: refreshToken,
          });
          if (res.status === 200) {
            sessionStorage.setItem('access_token', res.data.access);
            axiosClient.defaults.headers.common['Authorization'] = `Bearer ${res.data.access}`;
            return axiosClient(originalRequest);
          }
        }
      } catch (refreshError) {
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
        sessionStorage.removeItem('user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
