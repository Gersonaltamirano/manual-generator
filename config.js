export const config = {

    baseURL: "https://lrv-12.local",
    ai: {
        enabled: true,
        provider: "deepseek", // deepseek | openai | gemini
        timeoutMs: 45000,
        chunkSize: 20,
        temperature: 1.3,
        providers: {
            deepseek: {
                apiKey: process.env.DEEPSEEK_API_KEY || "sk-fa011f7bebbc4111a9626adc1d0b0cad",
                model: "deepseek-chat",
                baseURL: "https://api.deepseek.com",
            },
            openai: {
                apiKey: process.env.OPENAI_API_KEY || "",
                model: "gpt-4o-mini",
                baseURL: "https://api.openai.com/v1",
            },
            gemini: {
                apiKey: process.env.GEMINI_API_KEY || "AIzaSyDoVFUgfp3WzunRIk4YWD-xG78JGYUt0h8",
                model: "gemini-3.1-pro-preview",
                baseURL: "https://generativelanguage.googleapis.com/v1beta",
            },
        },
    },
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
