export const config = {

    baseURL: "https://lrv-12.local",
    viewport: {
        width: 1540,
        height: 825,
    },
    crawl: {
        headless: false,
        maxRoutes: 300,
        timeoutMs: 20000,
        visitDelayMs: 1200,
        scrollDelayMs: 250,
        minOverflowPx: 140,
    },

    login: {
        url: "/login",
        email: "superadmin@solucionesaltamirano.com",
        password: "SuperAdmin123.",

        emailSelector: "#email",
        passwordSelector: "#password",
        submitSelector: "#loginForm button.btn-primary",

        successUrl: "/dashboard" // cambiar si tu dashboard es otro
    },

    ignoreRoutes: [
        "logout",
        "register",
        "password",
        "sanctum",
        "_ignition",
        "storage",
        "debugbar",
        "telescope",
        "api",
        "broadcasting",
        "livewire",
        "vendor",
        "assets",
        "css",
        "js",
    ],
}
