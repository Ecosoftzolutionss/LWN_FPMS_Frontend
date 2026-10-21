import API from '../api';

// Get FIFO dashboard board data
export const getFifoBoard = async () => {
  const response = await API.get('/Dashboard/fifo-board');
  return response.data;
};

// Get data for a particular part
export const getPartBoard = async (itemId) => {
  if (!itemId || Number(itemId) <= 0) {
    throw new Error('A valid item ID is required.');
  }

  const response = await API.get(
    `/Dashboard/part/${encodeURIComponent(itemId)}`
  );

  return response.data;
};

// Get FIFO dashboard configuration
// Response: { displaySeconds, displayRows, inputPath, parts: [...] }
export const getFifoDashboardConfiguration = async () => {
  const response = await API.get('/FifoDashboardConfiguration');
  return response.data;
};

// Save FIFO dashboard configuration
// Payload: { displaySeconds, displayRows, inputPath, parts: [{ position, itemId }] }
export const saveFifoDashboardConfiguration = async (configuration) => {
  if (!configuration || typeof configuration !== 'object') {
    throw new Error('Dashboard configuration is required.');
  }

  if (
    typeof configuration.inputPath !== 'string' ||
    configuration.inputPath.trim() === ''
  ) {
    throw new Error('Input path is required.');
  }

  const response = await API.put('/FifoDashboardConfiguration', {
    ...configuration,
    inputPath: configuration.inputPath.trim(),
  });

  return response.data;
};

// Open the native Windows folder dialog (File Explorer style) and return the full path.
// Response: { cancelled: boolean, path: string }
export const pickServerFolder = async (initialPath = '') => {
  const response = await API.get('/FifoDashboardConfiguration/pick-folder', {
    params: { initialPath: initialPath || '' },
    timeout: 130000, // the user may take a while to choose a folder
  });
  return response.data;
};

// Browse folders on the API server for the input path picker.
// An empty path returns the list of drives.
// Response: { current, parent, folders: [{ name, path }] }
export const browseServerFolders = async (path = '') => {
  const response = await API.get('/FifoDashboardConfiguration/browse', {
    params: { path: path || '' },
  });
  return response.data;
};

// Optional default export for other dashboard requests
export default API;
