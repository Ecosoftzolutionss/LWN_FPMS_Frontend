(function () {
  // Ee line matrame each deployment lo marchu:
  //   Customer PC IIS : "http://localhost:82/api"
  //   Cloud IIS       : "http://13.202.148.130:3041/api"
  var SITE_API = "http://localhost:82/api";
  // APK ki eppudu idhe (adb reverse valla PC API ki veltundi)
  var APK_API = "http://localhost:5000/api";
  var isApk =
    !!(window.Capacitor &&
       typeof window.Capacitor.isNativePlatform === "function" &&
       window.Capacitor.isNativePlatform());
 
  window.APP_CONFIG = {
    API_BASE_URL: isApk ? APK_API : SITE_API
  };
})();