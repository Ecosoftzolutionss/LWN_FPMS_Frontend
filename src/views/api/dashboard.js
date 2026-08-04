// src/api/dashboard.js
import API from '../../api'

export const getCustomerStatus = (search = '') =>
  API.get(`/dashboard/customer-status?search=${search}`)

export const getPlantSummary = () => API.get('/dashboard/plant-summary')

export const getBinDetails = (type) => API.get(`/dashboard/bin-details?type=${type}`)

export const getCustomerBinDetails = (customerId) =>
  API.get(`/dashboard/customer-bin-details?customerId=${customerId}`)
