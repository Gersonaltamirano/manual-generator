import fs from "fs"
import path from "path"
import { config } from "./config.js"
import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TableOfContents,
  TextRun,
} from "docx"
import {
  buildGlossary,
  buildModuleSummaries,
  buildRoleChecklist,
  buildSuggestedSteps,
  getPageHierarchy,
  sortPagesByUrl,
} from "./doc-structure.js"

function getPngDimensions(filePath){
 const buffer = fs.readFileSync(filePath)

 if(buffer.length < 24){
  return { width: 1280, height: 720 }
 }

 const signature = buffer.slice(0, 8).toString("hex")
 const expected = "89504e470d0a1a0a"

 if(signature !== expected){
  return { width: 1280, height: 720 }
 }

 const width = buffer.readUInt32BE(16)
 const height = buffer.readUInt32BE(20)

 return { width, height }
}

function buildImageParagraph(imagePath){
 const imageBuffer = fs.readFileSync(imagePath)
 const { width, height } = getPngDimensions(imagePath)

 const maxWidth = 560
 const ratio = width > 0 ? (maxWidth / width) : 1
 const scaledWidth = Math.max(1, Math.round(width * ratio))
 const scaledHeight = Math.max(1, Math.round(height * ratio))

 return new Paragraph({
  children: [
   new ImageRun({
    data: imageBuffer,
    transformation: {
     width: scaledWidth,
     height: scaledHeight,
    },
   }),
  ],
  spacing: {
   after: 200,
  },
 })
}

function bullet(text){
 return new Paragraph({
  text,
  bullet: {
   level: 0,
  },
 })
}

export async function generateWord(pages, options = {}){
 const children = []
 const sortedPages = sortPagesByUrl(pages)
 const moduleSummaries = buildModuleSummaries(sortedPages)
 const roleChecklist = buildRoleChecklist(sortedPages)
 const glossary = buildGlossary(sortedPages)

 children.push(
  new Paragraph({
   text: "Manual de Usuario del Sistema",
   heading: HeadingLevel.TITLE,
  })
 )

 children.push(
  new Paragraph({
   children: [
    new TextRun("Este documento describe las funcionalidades principales del sistema y la forma recomendada de uso para usuarios finales."),
   ],
   spacing: {
    after: 240,
   },
  })
 )

 children.push(
  new Paragraph({
   text: "Tabla de Contenido",
   heading: HeadingLevel.HEADING_1,
  })
 )

 children.push(
  new Paragraph({
   children: [
    new TableOfContents("Contenido", {
     hyperlink: true,
     headingStyleRange: "1-3",
    }),
   ],
  })
 )

 children.push(
  new Paragraph({
   text: "Resumen por Modulo",
   heading: HeadingLevel.HEADING_1,
  })
 )

 for(const summary of moduleSummaries){
  children.push(
   bullet(`${summary.module}: ${summary.pages} pantallas (crear: ${summary.create}, editar: ${summary.edit}, detalle: ${summary.detail}, consulta/listado: ${summary.list})`)
  )
 }

 children.push(
  new Paragraph({
   text: "Checklist por Rol",
   heading: HeadingLevel.HEADING_1,
  })
 )

 children.push(bullet(`Usuario evaluado: ${roleChecklist.loginEmail || "no definido"}`))
 children.push(bullet(`Rol declarado: ${roleChecklist.roleName || "no definido"}`))
 children.push(bullet(`Total de pantallas documentadas: ${roleChecklist.totalPages}`))
 children.push(bullet(`Modulos con acceso: ${roleChecklist.modules.join(", ") || "N/A"}`))

 children.push(
  new Paragraph({
   text: "Detalle de Pantallas",
   heading: HeadingLevel.HEADING_1,
  })
 )

 let currentLevel1 = ""
 let currentLevel2 = ""
 let currentLevel3 = ""

 for(const p of sortedPages){
  const hierarchy = getPageHierarchy(p.url)
  const images = Array.isArray(p.images)
   ? p.images
   : (p.image ? [p.image] : [])
  const description = (p.description || "Acceso a esta seccion del sistema.").trim()

  if(hierarchy.level1 !== currentLevel1){
   children.push(
    new Paragraph({
     text: hierarchy.level1,
     heading: HeadingLevel.HEADING_1,
    })
   )
   currentLevel1 = hierarchy.level1
   currentLevel2 = ""
   currentLevel3 = ""
  }

  if(hierarchy.level2 !== currentLevel2){
   children.push(
    new Paragraph({
     text: hierarchy.level2,
     heading: HeadingLevel.HEADING_2,
    })
   )
   currentLevel2 = hierarchy.level2
   currentLevel3 = ""
  }

  if(hierarchy.level3 !== currentLevel3){
   children.push(
    new Paragraph({
     text: hierarchy.level3,
     heading: HeadingLevel.HEADING_3,
    })
   )
   currentLevel3 = hierarchy.level3
  }

  children.push(
   new Paragraph({
    text: `URL de referencia: ${p.url}`,
    spacing: {
     after: 100,
    },
   })
  )

  children.push(
   new Paragraph({
    text: description,
    spacing: {
     after: 160,
    },
   })
  )

  if(hierarchy.extraPath){
   children.push(
    new Paragraph({
     text: `Ruta adicional: ${hierarchy.extraPath}`,
     spacing: {
      after: 120,
     },
    })
   )
  }

  if(config.manual?.includeUiExtractedDetails){
    const fieldNames = (p.fields || []).map((field) => field.name).slice(0, 8)
    if(fieldNames.length > 0){
      children.push(new Paragraph({ text: `Campos principales: ${fieldNames.join(", ")}` }))
    }

    const actions = (p.actions || []).slice(0, 8)
    if(actions.length > 0){
      children.push(new Paragraph({ text: `Acciones disponibles: ${actions.join(", ")}` }))
    }
  }

  const steps = buildSuggestedSteps(p)
  if(steps.length > 0){
    children.push(new Paragraph({ text: "Flujo sugerido:" }))
    for(const step of steps){
      children.push(bullet(step))
    }
  }

  for(const imagePath of images){
   const absoluteImagePath = path.resolve(imagePath)

   if(!fs.existsSync(absoluteImagePath)){
    continue
   }

   children.push(buildImageParagraph(absoluteImagePath))
  }
 }

 children.push(
  new Paragraph({
   text: "Glosario",
   heading: HeadingLevel.HEADING_1,
  })
 )

 for(const item of glossary){
  children.push(bullet(`${item.term}: ${item.definition}`))
 }

 const doc = new Document({
  sections: [
   {
    children,
   },
  ],
 })

 const buffer = await Packer.toBuffer(doc)
 const outputPath = options.outputPath
  ? path.resolve(options.outputPath)
  : path.resolve("docs/manual_usuario.docx")
 const fallbackOutputPath = options.fallbackOutputPath
  ? path.resolve(options.fallbackOutputPath)
  : path.resolve("docs/manual_usuario.new.docx")

 try{
  fs.writeFileSync(outputPath, buffer)
 }catch(error){
  if(error && error.code === "EBUSY"){
   fs.writeFileSync(fallbackOutputPath, buffer)
   console.log(`WORD bloqueado, se guardo en: ${fallbackOutputPath}`)
  }else{
   throw error
  }
 }
}
