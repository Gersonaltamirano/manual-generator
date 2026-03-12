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
  segments,
 }
}

export function sortPagesByUrl(pages){
 return [...pages].sort((a, b) => String(a.url).localeCompare(String(b.url)))
}

export function getPageType(url){
 const segments = getRelativeSegments(url).map((segment) => segment.toLowerCase())

 if(segments.includes("create")) return "create"
 if(segments.includes("edit")) return "edit"
 if(segments.length > 0 && /^\d+$/.test(segments[segments.length - 1])) return "detail"
 return "list"
}

export function buildSuggestedSteps(page){
 const type = getPageType(page.url)
 const actions = (page.actions || []).slice(0, 3)
 const fields = (page.fields || []).map((f) => f.name).slice(0, 4)

 if(type === "create"){
  return [
   "Revisa la pantalla y valida que estes en el formulario de registro correcto.",
   fields.length > 0
    ? `Completa los campos obligatorios y recomendados, por ejemplo: ${fields.join(", ")}.`
    : "Completa los campos obligatorios y valida el formato de los datos.",
   actions.length > 0
    ? `Ejecuta la accion principal (${actions[0]}) para guardar y confirma el resultado en la lista.`
    : "Guarda el registro y confirma que aparezca en la lista correspondiente.",
  ]
 }

 if(type === "edit"){
  return [
   "Ubica el registro que deseas actualizar y abre su formulario de edicion.",
   fields.length > 0
    ? `Ajusta solo los campos necesarios, por ejemplo: ${fields.join(", ")}.`
    : "Ajusta los valores necesarios y conserva la consistencia de la informacion.",
   actions.length > 0
    ? `Confirma los cambios con la accion principal (${actions[0]}) y valida el resultado.`
    : "Guarda cambios y verifica que el registro quede actualizado.",
  ]
 }

 return []
}

export function buildModuleSummaries(pages){
 const map = new Map()

 for(const page of pages){
  const hierarchy = getPageHierarchy(page.url)
  const key = hierarchy.level1

  if(!map.has(key)){
    map.set(key, {
      module: key,
      pages: 0,
      create: 0,
      edit: 0,
      detail: 0,
      list: 0,
    })
  }

  const item = map.get(key)
  item.pages += 1
  const type = getPageType(page.url)
  item[type] += 1
 }

 return Array.from(map.values()).sort((a, b) => a.module.localeCompare(b.module))
}

export function buildRoleChecklist(pages){
 const roleName = (config.manual?.roleName || "").trim()
 const loginEmail = (config.login?.email || "").trim()

 const modules = [...new Set(pages.map((page) => getPageHierarchy(page.url).level1))]
   .sort((a, b) => a.localeCompare(b))

 return {
  roleName,
  loginEmail,
  totalPages: pages.length,
  modules,
 }
}

export function buildGlossary(pages){
 const glossary = new Map()

 for(const page of pages){
  const hierarchy = getPageHierarchy(page.url)

  if(!glossary.has(hierarchy.level1)){
    glossary.set(
      hierarchy.level1,
      `Area funcional del sistema donde se concentran procesos relacionados con ${hierarchy.level1.toLowerCase()}.`
    )
  }

  for(const field of page.fields || []){
    const name = (field.name || "").trim()
    if(!name || name.length < 3 || glossary.has(name)){
      continue
    }

    glossary.set(
      name,
      `Campo operativo utilizado para registrar o consultar informacion dentro de esta plataforma.`
    )
  }
 }

 return Array.from(glossary.entries())
  .map(([term, definition]) => ({ term, definition }))
  .sort((a, b) => a.term.localeCompare(b.term))
  .slice(0, 40)
}
