import fs from "fs"
import path from "path"
import { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from "docx"

function groupPagesByModule(pages){
 const modules = {}

 for(const p of pages){
  const parts = p.url.split("/")
  const moduleName = parts[3] || "general"

  if(!modules[moduleName]){
   modules[moduleName] = []
  }

  modules[moduleName].push(p)
 }

 return modules
}

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

export async function generateWord(pages, options = {}){
 const modules = groupPagesByModule(pages)
 const children = []

 children.push(
  new Paragraph({
   text: "Manual de Usuario del Sistema",
   heading: HeadingLevel.TITLE,
  })
 )

 children.push(
  new Paragraph({
   children: [
    new TextRun("Este documento describe las funcionalidades principales del sistema."),
   ],
   spacing: {
    after: 300,
   },
  })
 )

 for(const moduleName of Object.keys(modules)){
  children.push(
   new Paragraph({
    text: moduleName.toUpperCase(),
    heading: HeadingLevel.HEADING_1,
   })
  )

  for(const p of modules[moduleName]){
   const images = Array.isArray(p.images)
    ? p.images
    : (p.image ? [p.image] : [])

   const description = (p.description || "Acceso a esta seccion del sistema.").trim()

   children.push(
    new Paragraph({
      text: p.url,
      heading: HeadingLevel.HEADING_2,
    })
   )

    children.push(
     new Paragraph({
      text: description,
      spacing: {
       after: 180,
      },
     })
    )

   for(const imagePath of images){
    const absoluteImagePath = path.resolve(imagePath)

    if(!fs.existsSync(absoluteImagePath)){
     continue
    }

    children.push(buildImageParagraph(absoluteImagePath))
   }
  }
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
