import API from "./API";

let timer;

const resetTimer = () => {

    const user = JSON.parse(sessionStorage.getItem("user"));

    // User not logged in
    if (!user?.sessionId)
        return;

    clearTimeout(timer);

    API.post("/auth/heartbeat").catch(() => {});

    timer = setTimeout(() => {}, 600000);
};

export const startSessionTracking = () => {

    const user = JSON.parse(sessionStorage.getItem("user"));

    // Don't start on login page
    if (!user?.sessionId)
        return;

    [
        "click",
        "mousemove",
        "keypress",
        "scroll",
        "touchstart"
    ].forEach(event =>
        window.addEventListener(event, resetTimer)
    );

    resetTimer();
};