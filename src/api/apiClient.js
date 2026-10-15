// Demo-only API client.
// The application is now a pure frontend demo: every request is routed to the
// in-browser mock backend (src/mock/mockApi.js) backed by localStorage.
// The surface it exposes matches the previous axios instance exactly, so the
// services layer is unchanged.

import i18n from '../i18n';
import { mockRequest } from '../mock/mockApi';

function buildConfig(config = {}, data) {
  const headers = { ...(config.headers || {}) };

  // Request interceptor (previously axios): JWT token + Accept-Language
  const token = localStorage.getItem('token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const lang = i18n.language?.split('-')[0] || localStorage.getItem('bms_language') || 'en';
  headers['Accept-Language'] = lang;

  return { ...config, headers, data };
}

async function request(method, url, data, config) {
  const cfg = buildConfig(config, data);
  let res;
  try {
    res = await mockRequest(method, url, cfg);
  } catch (error) {
    return Promise.reject(withFriendlyMessage(error));
  }
  return res;
}

// Response interceptor (previously axios): surface friendly messages.
function withFriendlyMessage(error) {
  const status = error.response?.status;
  const backendMessage = error.response?.data?.message;

  // Handle JWT Expiration / Unauthorized Access
  if (status === 401) {
    // Prevent infinite redirect loop if already on the login page
    if (!window.location.pathname.includes('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    error.friendlyMessage = backendMessage || i18n.t('errors:unauthorized');
    return error;
  }

  // Role/privilege denied — the session is still valid, the caller just
  // lacks the required role. Don't log the user out; surface the message.
  if (status === 403) {
    error.friendlyMessage = backendMessage || i18n.t('errors:forbidden');
    return error;
  }

  // Handle other known errors with friendly messages
  let friendlyMessage;
  if (!error.response) {
    friendlyMessage = i18n.t('errors:cannot_reach_server');
  } else if (status === 409) {
    friendlyMessage = backendMessage || i18n.t('errors:conflict');
  } else if (status === 400) {
    friendlyMessage = backendMessage || i18n.t('errors:check_form');
  } else if (status >= 500) {
    friendlyMessage = i18n.t('errors:unexpected_error');
  } else {
    friendlyMessage = backendMessage || i18n.t('errors:generic');
  }

  error.friendlyMessage = friendlyMessage;
  return error;
}

const apiClient = {
  get: (url, config) => request('GET', url, undefined, config),
  post: (url, data, config) => request('POST', url, data, config),
  put: (url, data, config) => request('PUT', url, data, config),
  patch: (url, data, config) => request('PATCH', url, data, config),
  delete: (url, config) => request('DELETE', url, undefined, config),
};

export default apiClient;