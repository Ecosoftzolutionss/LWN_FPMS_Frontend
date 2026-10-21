
import axios from 'axios';

const API = axios.create({
  baseURL: window.APP_CONFIG?.API_BASE_URL || '',
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export default API;
