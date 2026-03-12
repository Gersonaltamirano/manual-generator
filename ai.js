import fs from "fs"
import path from "path"
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

function normalizeParsedItems(parsed){
  if(Array.isArray(parsed)){
    return parsed
  }

  if(parsed && typeof parsed === "object"){
    if(Array.isArray(parsed.items)){
      return parsed.items
    }

    if(Array.isArray(parsed.results)){
      return parsed.results
    }
  }

  return null
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

function mimeFromPath(filePath){
  const ext = path.extname(filePath).toLowerCase()
  if(ext === ".png") return "image/png"
  if(ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if(ext === ".webp") return "image/webp"
  return "application/octet-stream"
}

function buildPrompt(pages){
  const input = pages.map((page) => ({
    url: page.url,
    title: page.title || "",
    heading: page.heading || "",
    section: page.section || "",
    path: (() => {
      try{
        return new URL(page.url).pathname
      }catch{
        return ""
      }
    })(),
    fields: (page.fields || []).map((field) => field.name).slice(0, 8),
    actions: (page.actions || []).slice(0, 8),
  }))

  return [
    "Eres un redactor tecnico para manuales de usuario final en espanol.",
    "Para cada item devuelve una explicacion clara, natural y util para una persona no tecnica.",
    "No inventes funciones no evidentes en la URL, titulo, heading, campos o acciones.",
    "Cada descripcion debe incluir objetivo de la pantalla, acciones del usuario, datos que suele llenar o consultar y resultado esperado.",
    "Respuesta SOLO en JSON valido (sin markdown):",
    '[{"url":"...","description":"..."}]',
    "La descripcion debe tener entre 3 y 5 oraciones y entre 350 y 900 caracteres.",
    "Si hay imagenes adjuntas, usalas para mejorar precision del lenguaje funcional.",
    "Si la URL no da suficiente contexto, describe de forma neutral y util.",
    `Items: ${JSON.stringify(input)}`,
  ].join("\n")
}

function collectVisionAssets(chunk){
  const visionConfig = config.ai?.vision || {}

  if(!visionConfig.enabled){
    return []
  }

  const maxImages = Math.max(0, Number(visionConfig.maxImagesPerChunk || 0))
  const maxBytes = Math.max(1, Number(visionConfig.maxImageBytes || 350000))

  if(maxImages === 0){
    return []
  }

  const assets = []

  for(const page of chunk){
    if(assets.length >= maxImages){
      break
    }

    const images = Array.isArray(page.images) ? page.images : []
    const firstImage = images[0]

    if(!firstImage){
      continue
    }

    const absPath = path.resolve(firstImage)

    if(!fs.existsSync(absPath)){
      continue
    }

    const stat = fs.statSync(absPath)
    if(stat.size > maxBytes){
      continue
    }

    const buffer = fs.readFileSync(absPath)
    const mimeType = mimeFromPath(absPath)

    assets.push({
      pageUrl: page.url,
      mimeType,
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
      bytes: stat.size,
    })
  }

  return assets
}

async function callOpenAICompatible({ baseURL, apiKey, model, prompt, temperature, timeoutMs, visionAssets }){
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const hasVision = Array.isArray(visionAssets) && visionAssets.length > 0

  const mappedVisionText = hasVision
    ? [
        "Imagenes adjuntas (una por URL):",
        ...visionAssets.map((asset, index) => `${index + 1}. ${asset.pageUrl}`),
      ].join("\n")
    : ""

  const userContent = hasVision
    ? [
        { type: "text", text: `${prompt}\n\n${mappedVisionText}` },
        ...visionAssets.map((asset) => ({
          type: "image_url",
          image_url: {
            url: asset.dataUrl,
          },
        })),
      ]
    : prompt

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
            content: userContent,
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

async function callGemini({ baseURL, apiKey, model, prompt, temperature, timeoutMs, visionAssets }){
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const parts = [{ text: prompt }]

  if(Array.isArray(visionAssets) && visionAssets.length > 0){
    parts.push({
      text: [
        "Imagenes adjuntas (una por URL):",
        ...visionAssets.map((asset, index) => `${index + 1}. ${asset.pageUrl}`),
      ].join("\n"),
    })

    for(const asset of visionAssets){
      parts.push({
        inlineData: {
          mimeType: asset.mimeType,
          data: asset.dataUrl.split(",")[1],
        },
      })
    }
  }

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
            parts,
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

async function callProvider(provider, prompt, visionAssets){
  const providerConfig = config.ai.providers[provider]

  if(!providerConfig?.apiKey){
    throw new Error(`No API key for provider ${provider}`)
  }

  const visionEnabledForProvider = Boolean(
    config.ai?.vision?.enabled && config.ai?.vision?.providers?.[provider]
  )

  const providerVisionAssets = visionEnabledForProvider ? visionAssets : []

  const runCall = async (assets) => {
    if(provider === "gemini"){
      return callGemini({
        baseURL: providerConfig.baseURL,
        apiKey: providerConfig.apiKey,
        model: providerConfig.model,
        prompt,
        temperature: config.ai.temperature,
        timeoutMs: config.ai.timeoutMs,
        visionAssets: assets,
      })
    }

    return callOpenAICompatible({
      baseURL: providerConfig.baseURL,
      apiKey: providerConfig.apiKey,
      model: providerConfig.model,
      prompt,
      temperature: config.ai.temperature,
      timeoutMs: config.ai.timeoutMs,
      visionAssets: assets,
    })
  }

  const hasVisionAttempt = providerVisionAssets.length > 0

  if(!hasVisionAttempt){
    return runCall([])
  }

  try{
    return await runCall(providerVisionAssets)
  }catch(error){
    console.log(`IA ${provider}: fallo en modo vision, reintentando en texto (${error.message})`)
    return runCall([])
  }
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

    fallback.set(
      page.url,
      `Esta pantalla corresponde al modulo ${section}. Desde aqui el usuario puede consultar informacion y ejecutar acciones segun sus permisos. El resultado esperado es mantener el proceso actualizado con datos correctos.`
    )
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
    const visionAssets = collectVisionAssets(chunk)
    let parsed = null

    if(visionAssets.length > 0){
      const totalKb = Math.round(visionAssets.reduce((acc, item) => acc + item.bytes, 0) / 1024)
      console.log(`IA chunk ${index + 1}/${chunks.length} con ${visionAssets.length} imagen(es), ${totalKb}KB`)
    }

    for(const provider of providers){
      try{
        const raw = await callProvider(provider, prompt, visionAssets)
        parsed = normalizeParsedItems(safeJsonParse(raw))

        if(parsed){
          console.log(`IA chunk ${index + 1}/${chunks.length} generado con ${provider}`)
          break
        }
      }catch(error){
        console.log(`IA fallo con ${provider} en chunk ${index + 1}: ${error.message}`)
      }
    }

    if(!parsed){
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
