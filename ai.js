import { config } from "./config.js"

function chunkArray(items, size){
  const chunks = []

  for(let i = 0; i < items.length; i += size){
    chunks.push(items.slice(i, i + size))
  }

  return chunks
}

function safeJsonParse(text){
  const raw = String(text || "").trim()

  try{
    return JSON.parse(raw)
  }catch{
    const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i)
    if(fenced && fenced[1]){
      try{
        return JSON.parse(fenced[1].trim())
      }catch{
        return null
      }
    }

    const start = raw.indexOf("[")
    const end = raw.lastIndexOf("]")
    if(start !== -1 && end !== -1 && end > start){
      try{
        return JSON.parse(raw.slice(start, end + 1))
      }catch{
        return null
      }
    }

    return null
  }
}

function providerOrder(configuredProvider){
  const all = [configuredProvider, "deepseek", "openai", "gemini"]
  const unique = []

  for(const provider of all){
    if(!provider || unique.includes(provider)){
      continue
    }
    unique.push(provider)
  }

  return unique
}

function getEnabledProviders(){
  const providers = providerOrder(config.ai.provider)

  return providers.filter((provider) => {
    const apiKey = config.ai.providers?.[provider]?.apiKey
    return Boolean(apiKey)
  })
}

function buildPrompt(pages){
  const input = pages.map((page) => ({
    url: page.url,
    title: page.title || "",
    section: page.section || "",
  }))

  return [
    "Eres un redactor tecnico para manuales de usuario final en espanol.",
    "Para cada item devuelve una descripcion clara y natural de uso.",
    "No inventes funciones no evidentes en la URL/titulo.",
    "Respuesta SOLO en JSON valido (sin markdown):",
    '[{"url":"...","description":"..."}]',
    "La descripcion debe tener entre 1 y 2 oraciones y maximo 220 caracteres.",
    "Si la URL no da suficiente contexto, describe de forma neutral y util.",
    `Items: ${JSON.stringify(input)}`,
  ].join("\n")
}

async function callOpenAICompatible({ baseURL, apiKey, model, prompt, temperature, timeoutMs }){
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try{
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          {
            role: "system",
            content: "Responde solo en JSON valido sin texto adicional.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    })

    if(!response.ok){
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return data?.choices?.[0]?.message?.content || ""
  } finally {
    clearTimeout(timer)
  }
}

async function callGemini({ baseURL, apiKey, model, prompt, temperature, timeoutMs }){
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try{
    const endpoint = `${baseURL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
      signal: controller.signal,
    })

    if(!response.ok){
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
  } finally {
    clearTimeout(timer)
  }
}

async function callProvider(provider, prompt){
  const providerConfig = config.ai.providers[provider]

  if(!providerConfig?.apiKey){
    throw new Error(`No API key for provider ${provider}`)
  }

  if(provider === "gemini"){
    return callGemini({
      baseURL: providerConfig.baseURL,
      apiKey: providerConfig.apiKey,
      model: providerConfig.model,
      prompt,
      temperature: config.ai.temperature,
      timeoutMs: config.ai.timeoutMs,
    })
  }

  return callOpenAICompatible({
    baseURL: providerConfig.baseURL,
    apiKey: providerConfig.apiKey,
    model: providerConfig.model,
    prompt,
    temperature: config.ai.temperature,
    timeoutMs: config.ai.timeoutMs,
  })
}

function buildDescriptionMap(items, chunk){
  const byUrl = new Map()

  for(const row of items || []){
    if(!row || typeof row !== "object"){
      continue
    }

    const url = typeof row.url === "string" ? row.url.trim() : ""
    const description = typeof row.description === "string" ? row.description.trim() : ""

    if(url && description){
      byUrl.set(url, description)
    }
  }

  const fallback = new Map()
  for(const page of chunk){
    const section = page.section || "modulo"
    fallback.set(page.url, `Permite consultar y operar la seccion ${section} del sistema segun los permisos del usuario.`)
  }

  return { byUrl, fallback }
}

export async function enrichPagesWithAI(pages){
  if(!config.ai?.enabled || !Array.isArray(pages) || pages.length === 0){
    return pages
  }

  const providers = getEnabledProviders()

  if(providers.length === 0){
    console.log("IA deshabilitada: no hay API keys configuradas")
    return pages
  }

  const chunks = chunkArray(pages, Math.max(1, config.ai.chunkSize || 20))
  const descriptionByUrl = new Map()

  console.log(`IA activa. Proveedores disponibles: ${providers.join(", ")}`)

  for(let index = 0; index < chunks.length; index++){
    const chunk = chunks[index]
    const prompt = buildPrompt(chunk)
    let parsed = null

    for(const provider of providers){
      try{
        const raw = await callProvider(provider, prompt)
        parsed = safeJsonParse(raw)

        if(Array.isArray(parsed)){
          console.log(`IA chunk ${index + 1}/${chunks.length} generado con ${provider}`)
          break
        }
      }catch(error){
        console.log(`IA fallo con ${provider} en chunk ${index + 1}: ${error.message}`)
      }
    }

    if(!Array.isArray(parsed)){
      parsed = []
    }

    const { byUrl, fallback } = buildDescriptionMap(parsed, chunk)

    for(const page of chunk){
      descriptionByUrl.set(page.url, byUrl.get(page.url) || fallback.get(page.url))
    }
  }

  return pages.map((page) => ({
    ...page,
    description: descriptionByUrl.get(page.url) || page.description || "Acceso a esta seccion del sistema.",
  }))
}
