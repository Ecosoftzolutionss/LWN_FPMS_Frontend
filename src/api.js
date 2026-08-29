// import axios from "axios";
// import Swal from "sweetalert2";

// const API = axios.create({
//   baseURL: window.APP_CONFIG.API_BASE_URL,
// });

// console.log(
//   "API URL:",
//   window.APP_CONFIG.API_BASE_URL
// );

// let isSessionExpired = false;

// // ========================================
// // REQUEST INTERCEPTOR
// // ========================================

// API.interceptors.request.use(
//   (config) => {

//     const storedUser =
//       sessionStorage.getItem("user");

//     if (storedUser) {

//       try {

//         const user =
//           JSON.parse(storedUser);

//         if (user?.sessionId) {

//           config.headers =
//             config.headers || {};

//           config.headers["SessionId"] =
//             user.sessionId;
//         }

//       } catch (error) {

//         console.error(
//           "Invalid user session:",
//           error
//         );
//       }
//     }

//     return config;
//   },

//   (error) => {
//     return Promise.reject(error);
//   }
// );

// // ========================================
// // RESPONSE INTERCEPTOR
// // ========================================

// API.interceptors.response.use(

//   (response) => {

//     // Request succeeded, session is valid
//     isSessionExpired = false;

//     return response;
//   },

//   async (error) => {

//     const requestUrl =
//       error.config?.url || "";

//     // ====================================
//     // Ignore heartbeat error if logged out
//     // ====================================

//     if (
//       requestUrl.toLowerCase().includes(
//         "/auth/heartbeat"
//       ) &&
//       !sessionStorage.getItem("user")
//     ) {
//       return Promise.reject(error);
//     }

//     // ====================================
//     // 401 - SESSION EXPIRED
//     // ====================================

//     if (
//       error.response?.status === 401
//     ) {

//       // Prevent multiple popups
//       if (isSessionExpired) {
//         return Promise.reject(error);
//       }

//       isSessionExpired = true;

//       console.error(
//         "401 Unauthorized:",
//         {
//           url: requestUrl,
//           response:
//             error.response?.data,
//         }
//       );

//       // Remove invalid session
//       sessionStorage.removeItem("user");

//       // Notify application
//       window.dispatchEvent(
//         new Event("authChange")
//       );

//       await Swal.fire({
//         icon: "warning",
//         title: "Session Expired",
//         text: "Your session has expired",
//         confirmButtonText: "OK",
//         allowOutsideClick: false,
//         allowEscapeKey: false,
//       });

//       // Redirect to login
//       window.location.replace(
//         `${window.location.pathname}#/login`
//       );
//     }

//     return Promise.reject(error);
//   }
// );

// export default API;


import axios from "axios";

const API = axios.create({
  baseURL: window.APP_CONFIG.API_BASE_URL,
});

export default API;