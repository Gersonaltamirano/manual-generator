import "dotenv/config"

function firstEnv(...keys) {
    for (const key of keys) {
        const value = process.env[key]
        if (typeof value === "string" && value.trim() !== "") {
            return value
        }
    }
    return ""
}

export const config = {

    baseURL: process.env.BASE_URL || "localhost:8000",
    ai: {
        enabled: true,
        provider: process.env.PROVIDER || "deepseek", // deepseek | openai | gemini
        timeoutMs: 45000,
        chunkSize: 20,
        temperature: 1.3,
        providers: {
            deepseek: {
                apiKey: process.env.DEEPSEEK_API_KEY || "",
                model: "deepseek-chat",
                baseURL: "https://api.deepseek.com",
            },
            openai: {
                apiKey: process.env.OPENAI_API_KEY || "",
                model: "gpt-4o-mini",
                baseURL: "https://api.openai.com/v1",
            },
            gemini: {
                apiKey: process.env.GEMINI_API_KEY || "",
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
        url: firstEnv("URL_LOGIN") || "/login",
        email: firstEnv("LOGIN_EMAIL", "EMAIL", "USERNAME"),
        password: firstEnv("LOGIN_PASSWORD", "PASSWORD"),

        emailSelector: firstEnv("EMAIL_SELECTOR") || "#email",
        passwordSelector: firstEnv("PASSWORD_SELECTOR") || "#password",
        submitSelector: firstEnv("SUBMIT_SELECTOR") || "#loginForm button.btn-primary",

        successUrl: firstEnv("SUCCESS_URL") || "/dashboard" // cambiar si tu dashboard es otro
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
