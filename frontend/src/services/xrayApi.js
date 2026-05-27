import api from './api';

const BASE = '/api/xray';

/**
 * Uploads an X-ray image for AI analysis
 * @param {File} file - The X-ray image file
 * @returns {Promise<Object>} - The prediction result and AI report
 */
export const uploadXray = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await api.post(`${BASE}/predict`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading X-ray:', error);
    throw error.response?.data || { detail: 'Network error or backend is offline' };
  }
};

/**
 * Fetches all X-ray reports from the history
 * @returns {Promise<Array>} - List of reports
 */
export const getXrayHistory = async () => {
  try {
    const response = await api.get(`${BASE}/history`);
    return response.data;
  } catch (error) {
    console.error('Error fetching history:', error);
    // Return empty array as graceful fallback to prevent crash
    return [];
  }
};

/**
 * Fetches a single X-ray report by ID
 * @param {string} id - The report ID
 * @returns {Promise<Object>} - The report details
 */
export const getXrayReportById = async (id) => {
  try {
    const response = await api.get(`${BASE}/report/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching report:', error);
    throw error.response?.data || { detail: 'Report not found' };
  }
};
