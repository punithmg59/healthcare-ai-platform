import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000, // 15 seconds strict timeout
});

// Simple custom retry logic interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    // Setup retry count
    if (!config) {
      return Promise.reject(error);
    }
    
    config.__retryCount = config.__retryCount || 0;
    
    // Max 2 retries
    if (config.__retryCount >= 2) {
      console.error('❌ API: Max retries reached. Backend may be offline or slow.');
      return Promise.reject(error);
    }
    
    // Only retry on network errors or 5xx server errors
    if (!error.response || (error.response.status >= 500 && error.response.status < 600)) {
      config.__retryCount += 1;
      console.warn(`⚠️ API: Retrying request (${config.__retryCount}/2)...`);
      
      // Delay before retry (1s, then 2s)
      const delay = new Promise((resolve) => setTimeout(resolve, config.__retryCount * 1000));
      await delay;
      return api(config);
    }
    
    return Promise.reject(error);
  }
);

// Safe wrapper for API calls to prevent UI crashes
const safeApiCall = async (apiFunc, fallbackData = null) => {
  try {
    const response = await apiFunc();
    return response;
  } catch (error) {
    console.error("API Call Failed:", error?.message || error);
    // Return a graceful fallback instead of throwing
    return { data: fallbackData, error: true, message: error?.message };
  }
};

// History
export const getHistory = (params = {}) => safeApiCall(() => api.get('/api/history/', { params }), []);
export const getHistoryDetail = (id) => safeApiCall(() => api.get(`/api/history/${id}`), null);
export const deleteHistory = (id) => safeApiCall(() => api.delete(`/api/history/${id}`), { success: false });
export const clearHistory = () => safeApiCall(() => api.delete('/api/history/'), { success: false });
export const getMriHistory = () => safeApiCall(() => api.get('/api/brain/history'), []);

// Analytics
export const getAnalyticsSummary = () => safeApiCall(() => api.get('/api/analytics/summary'), {
  total_predictions: 0,
  risk_distribution: { high: 0, moderate: 0, low: 0 },
  emergencies: 0,
  averages: { risk_score: 0, blood_pressure: 0, cholesterol: 0, heart_rate: 0 }
});
export const getRecentPredictions = (limit = 10) => safeApiCall(() => api.get('/api/analytics/recent', { params: { limit } }), { recent: [] });
export const getPredictionTrends = () => safeApiCall(() => api.get('/api/analytics/trends'), { trends: [] });

// Heart Prediction (No safe wrapper here because we want the UI to handle the specific error/loading state for predictions)
export const predictHeart = (formData) => api.post('/predict-heart-multimodal', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});

// Brain Tumor Prediction
export const predictBrainTumor = (formData) => api.post('/api/brain/predict', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});

// Auto-fill OCR Extraction
export const extractReport = (formData) => api.post('/api/extraction/auto-fill', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 30000, // Slightly longer timeout for OCR if needed
});

export default api;
