import axios from "axios";
import Swal from "sweetalert2";

const API = axios.create({
    baseURL: window.APP_CONFIG.API_BASE_URL,
});

console.log("API URL:", window.APP_CONFIG.API_BASE_URL);

let isSessionExpired = false;

// ===============================
// REQUEST INTERCEPTOR
// ===============================
API.interceptors.request.use(
    (config) => {
        const storedUser = sessionStorage.getItem("user");

        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);

                if (user?.sessionId) {
                    config.headers["SessionId"] = user.sessionId;
                }
            } catch (error) {
                console.error("Invalid user session:", error);
            }
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// ===============================
// RESPONSE INTERCEPTOR
// ===============================
API.interceptors.response.use(
    (response) => response,

    async (error) => {

        // Ignore heartbeat error when user is already logged out
        if (
            error.config?.url?.includes("/auth/heartbeat") &&
            !sessionStorage.getItem("user")
        ) {
            return Promise.reject(error);
        }

        // ===============================
        // SESSION EXPIRED
        // ===============================
        if (error.response?.status === 401) {

            // Prevent multiple popup messages
            if (isSessionExpired) {
                return Promise.reject(error);
            }

            isSessionExpired = true;

            // Remove logged-in user
            sessionStorage.removeItem("user");

            // Tell App.js that login state changed
            window.dispatchEvent(new Event("authChange"));

            await Swal.fire({
                icon: "warning",
                title: "Session Expired",
                text: "Your session has expired",
                confirmButtonText: "OK",
                allowOutsideClick: false,
                allowEscapeKey: false,
            });

            // ===============================
            // HASH ROUTER REDIRECT
            // ===============================
            window.location.replace(
                `${window.location.pathname}#/login`
            );

            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

export default API;