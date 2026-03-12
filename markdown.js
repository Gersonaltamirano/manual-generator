import fs from "fs-extra"
import { config } from "./config.js"
import {
  buildGlossary,
  buildModuleSummaries,
  buildRoleChecklist,
  buildSuggestedSteps,
  getPageHierarchy,
  sortPagesByUrl,
} from "./doc-structure.js"

export function generateMarkdown(pages, outputPath = "docs/manual_usuario.md"){

 const sortedPages = sortPagesByUrl(pages)
 const moduleSummaries = buildModuleSummaries(sortedPages)
 const roleChecklist = buildRoleChecklist(sortedPages)
 const glossary = buildGlossary(sortedPages)

 let md=`# Manual de Usuario del Sistema

Este documento describe las funcionalidades principales del sistema y la forma recomendada de uso para usuarios finales.

## Tabla de contenido

1. Resumen por modulo
2. Checklist por rol
3. Detalle de pantallas
4. Glosario

## Resumen por modulo

`

 moduleSummaries.forEach((summary) => {
  md += `- **${summary.module}**: ${summary.pages} pantallas (crear: ${summary.create}, editar: ${summary.edit}, detalle: ${summary.detail}, consulta/listado: ${summary.list})\n`
 })

 md += `\n\n## Checklist por rol\n\n`
 md += `- Usuario evaluado: ${roleChecklist.loginEmail || "no definido"}\n`
 md += `- Rol declarado: ${roleChecklist.roleName || "no definido"}\n`
 md += `- Total de pantallas documentadas: ${roleChecklist.totalPages}\n`
 md += `- Modulos con acceso: ${roleChecklist.modules.join(", ") || "N/A"}\n`

 md += `\n\n## Detalle de pantallas\n`

 let currentLevel1 = ""
 let currentLevel2 = ""
 let currentLevel3 = ""

 sortedPages.forEach((p) => {
  const hierarchy = getPageHierarchy(p.url)
  const images = Array.isArray(p.images)
   ? p.images
   : (p.image ? [p.image] : [])
  const description = (p.description || "Acceso a esta seccion del sistema.").trim()

  if(hierarchy.level1 !== currentLevel1){
   md += `\n\n# ${hierarchy.level1}\n`
   currentLevel1 = hierarchy.level1
   currentLevel2 = ""
   currentLevel3 = ""
  }

  if(hierarchy.level2 !== currentLevel2){
   md += `\n\n## ${hierarchy.level2}\n`
   currentLevel2 = hierarchy.level2
   currentLevel3 = ""
  }

  if(hierarchy.level3 !== currentLevel3){
   md += `\n\n### ${hierarchy.level3}\n`
   currentLevel3 = hierarchy.level3
  }

  md += `\n\n**URL de referencia:** ${p.url}\n\n${description}\n\n`

  if(hierarchy.extraPath){
   md += `**Ruta adicional:** ${hierarchy.extraPath}\n\n`
  }

  if(config.manual?.includeUiExtractedDetails){
   const fieldNames = (p.fields || []).map((field) => field.name).slice(0, 8)
   if(fieldNames.length > 0){
    md += `**Campos principales:** ${fieldNames.join(", ")}\n\n`
   }

   const actions = (p.actions || []).slice(0, 8)
   if(actions.length > 0){
    md += `**Acciones disponibles:** ${actions.join(", ")}\n\n`
   }
  }

  const steps = buildSuggestedSteps(p)
  if(steps.length > 0){
   md += `**Flujo sugerido:**\n\n`
   steps.forEach((step, index) => {
    md += `${index + 1}. ${step}\n`
   })
   md += `\n`
  }

  images.forEach((image, index) => {
   const imageName = image.split("/").pop()
   md += `![Pantalla ${index + 1}](./images/${imageName})\n\n`
  })
 })

 md += `\n\n## Glosario\n\n`
 glossary.forEach((item) => {
  md += `- **${item.term}:** ${item.definition}\n`
 })

 fs.writeFileSync(outputPath,md)

}
