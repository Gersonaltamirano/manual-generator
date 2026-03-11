import { chromium } from "playwright"
import fs from "fs-extra"
import { config } from "./config.js"

function isDynamicSegment(segment){
  if(!segment){
    return false
  }

  const value = segment.toLowerCase()

  if(/^\d+$/.test(value)){
    return true
  }

  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)){
    return true
  }

  return false
}

function shouldSkipPath(pathname, appBase){
  const basePath = appBase.pathname.replace(/\/+$/, "") || "/"
  let relativePath = pathname

  if(basePath !== "/" && relativePath.startsWith(basePath)){
    relativePath = relativePath.slice(basePath.length) || "/"
  }

  const segments = relativePath
    .split("/")
    .filter(Boolean)

  if(segments.length === 0){
    return false
  }

  const lastSegment = segments[segments.length - 1]
  const prevSegment = segments[segments.length - 2] || ""

  const isEditPath = lastSegment.toLowerCase() === "edit" && isDynamicSegment(prevSegment)
  const isShowPath = isDynamicSegment(lastSegment)

  return isEditPath || isShowPath
}

function normalizeUrl(rawHref, appBase, ignoreRoutes){
  if(!rawHref){
    return null
  }

  const href = String(rawHref).trim()

  if(
    !href ||
    href.startsWith("#") ||
    href.startsWith("javascript:") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ){
    return null
  }

  let parsed

  try{
    parsed = new URL(href, appBase.href)
  }catch{
    return null
  }

  if(parsed.host !== appBase.host){
    return null
  }

  const basePath = appBase.pathname.replace(/\/+$/, "") || "/"
  const path = parsed.pathname

  if(basePath !== "/"){
    const insideBasePath = path === basePath || path.startsWith(`${basePath}/`)
    if(!insideBasePath){
      return null
    }
  }

  const normalizedPath = path.toLowerCase()
  const ignored = ignoreRoutes.some((segment) => normalizedPath.includes(segment.toLowerCase()))

  if(ignored){
    return null
  }

  if(shouldSkipPath(parsed.pathname, appBase)){
    return null
  }

  parsed.hash = ""
  parsed.search = ""

  if(parsed.pathname.length > 1){
    parsed.pathname = parsed.pathname.replace(/\/+$/, "")
  }

  return parsed.toString()
}

function getRouteFileName(url, appBase){
  const parsed = new URL(url)
  const basePath = appBase.pathname.replace(/\/+$/, "") || "/"

  let relativePath = parsed.pathname

  if(basePath !== "/" && relativePath.startsWith(basePath)){
    relativePath = relativePath.slice(basePath.length) || "/"
  }

  const clean = relativePath
    .replace(/^\/+/, "")
    .replace(/[{}]/g, "")
    .replace(/\//g, "_")
    .replace(/:/g, "")
    .replace(/\?/g, "")

  return clean || "home"
}

async function discoverLinks(page, appBase){
  const hrefs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]"))
      .map((a) => a.getAttribute("href"))
      .filter(Boolean)
  })

  const internalLinks = []

  for(const href of hrefs){
    const normalized = normalizeUrl(href, appBase, config.ignoreRoutes)
    if(normalized){
      internalLinks.push(normalized)
    }
  }

  return [...new Set(internalLinks)]
}

async function captureInParts(page, baseFileName){
  const viewportSize = page.viewportSize() || { width: 1920, height: 1080 }
  const viewportHeight = viewportSize.height || 1080
  const minOverflowPx = config.crawl.minOverflowPx || 0

  const totalHeight = await page.evaluate(() => {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    )
  })

  const maxScrollY = Math.max(0, totalHeight - viewportHeight)
  const positions = [0]

  if(maxScrollY > minOverflowPx){
    for(let y = viewportHeight; y < maxScrollY; y += viewportHeight){
      positions.push(y)
    }

    const lastPosition = positions[positions.length - 1]
    if((maxScrollY - lastPosition) > minOverflowPx){
      positions.push(maxScrollY)
    }
  }

  const images = []

  for(let i = 0; i < positions.length; i++){
    const scrollY = positions[i]
    await page.evaluate((y) => window.scrollTo(0, y), scrollY)
    await page.waitForTimeout(config.crawl.scrollDelayMs)

    const file = `docs/images/${baseFileName}_part_${i + 1}.png`

    await page.screenshot({
      path: file,
      fullPage: false,
    })

    images.push(file)
  }

  await page.evaluate(() => window.scrollTo(0, 0))

  return images
}

export async function crawlRoutes(){
  const appBase = new URL(config.baseURL)

  const browser = await chromium.launch({ headless: config.crawl.headless })

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: {
      width: config.viewport.width,
      height: config.viewport.height,
    },
  })

  const page = await context.newPage()

  console.log("Abriendo login...")

  await page.goto(config.baseURL + config.login.url, { waitUntil: "domcontentloaded" })

  await page.waitForSelector(config.login.emailSelector)

  console.log("Ingresando credenciales...")

  await page.fill(config.login.emailSelector, config.login.email)
  await page.fill(config.login.passwordSelector, config.login.password)

  console.log("Enviando login con ENTER...")

  await page.press(config.login.passwordSelector, "Enter")
  await page.waitForTimeout(4000)

  const currentUrl = page.url()

  if(currentUrl.includes("/login")){
    console.log("Login fallo")
    await browser.close()
    return []
  }

  console.log("Login exitoso")

  const pages = []
  const visited = new Set()
  const queue = []

  const normalizedCurrentUrl = normalizeUrl(currentUrl, appBase, config.ignoreRoutes)
  if(normalizedCurrentUrl){
    queue.push(normalizedCurrentUrl)
  }

  const initialLinks = await discoverLinks(page, appBase)
  for(const link of initialLinks){
    if(!queue.includes(link)){
      queue.push(link)
    }
  }

  while(queue.length > 0 && pages.length < config.crawl.maxRoutes){
    const url = queue.shift()

    if(!url || visited.has(url)){
      continue
    }

    visited.add(url)

    try{
      console.log(`Visitando: ${url}`)

      const response = await page.goto(url, {
        waitUntil: "networkidle",
        timeout: config.crawl.timeoutMs,
      })

      const status = response ? response.status() : 0
      if(status !== 200){
        console.log(`Saltando por estatus ${status}: ${url}`)
        continue
      }

      await page.waitForTimeout(config.crawl.visitDelayMs)

      const baseFileName = getRouteFileName(url, appBase)
      const images = await captureInParts(page, baseFileName)

      pages.push({
        url,
        images,
      })

      const links = await discoverLinks(page, appBase)

      for(const link of links){
        if(!visited.has(link) && !queue.includes(link)){
          queue.push(link)
        }
      }
    }catch{
      console.log(`Error en: ${url}`)
    }
  }

  await browser.close()

  return pages
}
