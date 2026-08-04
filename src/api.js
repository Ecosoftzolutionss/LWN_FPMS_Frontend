import axios from "axios";
import Swal from "sweetalert2";

const API = axios.create({
    baseURL: window.APP_CONFIG.API_BASE_URL,
});
console.log("API URL:", window.APP_CONFIG.API_BASE_URL);
API.interceptors.request.use((config) => {
    const user = JSON.parse(sessionStorage.getItem("user"));
    if (user?.sessionId) {
        config.headers["SessionId"] = user.sessionId;
    }
    return config;
});

API.interceptors.response.use(
    response => response,
    async error => {

        if (
            error.config?.url?.includes("/auth/heartbeat") &&
            !sessionStorage.getItem("user")
        ) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401) {

            sessionStorage.clear();

            await Swal.fire({
                icon: "warning",
                title: "Session Expired",
                text: "Your session has expired",
            });

            window.location.href = "/#/login";
        }

        return Promise.reject(error);
    }
);
export default API;