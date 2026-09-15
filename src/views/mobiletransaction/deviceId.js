// src/features/mobiletransaction/deviceId.js
//
// One stable ID per physical device/browser install, persisted in
// localStorage (NOT sessionStorage — sessionStorage clears per tab/
// session, which would mean a "new device" every login and break the
// whole point of a stable idempotency key). Generated once, reused
// forever until local storage is cleared.

const DEVICE_ID_KEY = 'fpms_device_id';

export const getDeviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);

    if (!id) {
      id =
        (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      localStorage.setItem(DEVICE_ID_KEY, id);
    }

    return id;
  } catch {
    // localStorage unavailable (private browsing, disabled storage, etc.)
    // — fall back to a per-load id. Idempotency across reloads is lost
    // in this edge case, but sync will still work.
    return `dev-fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};