import fs from "fs-extra"
import { getPageHierarchy, sortPagesByUrl } from "./doc-structure.js"

export function generateMarkdown(pages, outputPath = "docs/manual_usuario.md"){

 let md=`# Manual de Usuario del Sistema

Este documento describe las funcionalidades principales del sistema.

`

 let currentLevel1 = ""
 let currentLevel2 = ""
 let currentLevel3 = ""

 const sortedPages = sortPagesByUrl(pages)

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

  images.forEach((image, index) => {
   const imageName = image.split("/").pop()
   md += `![Pantalla ${index + 1}](./images/${imageName})\n\n`
  })
 })

 fs.writeFileSync(outputPath,md)

}
