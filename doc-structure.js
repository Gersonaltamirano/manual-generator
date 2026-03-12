import { config } from "./config.js"

function toTitleCase(value){
 return value
  .replace(/[-_]+/g, " ")
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ")
}

function getBasePathname(){
 try{
  const base = new URL(config.baseURL)
  return base.pathname.replace(/\/+$/, "") || "/"
 }catch{
  return "/"
 }
}

function getRelativeSegments(url){
 try{
  const parsed = new URL(url)
  const basePath = getBasePathname()
  let pathname = parsed.pathname

  if(basePath !== "/" && pathname.startsWith(basePath)){
   pathname = pathname.slice(basePath.length) || "/"
  }

  return pathname
   .split("/")
   .filter(Boolean)
   .map((segment) => decodeURIComponent(segment))
 }catch{
  return []
 }
}

export function getPageHierarchy(url){
 const segments = getRelativeSegments(url)

 return {
  level1: toTitleCase(segments[0] || "general"),
  level2: toTitleCase(segments[1] || "inicio"),
  level3: toTitleCase(segments[2] || "vista principal"),
  extraPath: segments.slice(3).map(toTitleCase).join(" / "),
 }
}

export function sortPagesByUrl(pages){
 return [...pages].sort((a, b) => String(a.url).localeCompare(String(b.url)))
}
