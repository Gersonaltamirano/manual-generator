import puppeteer from "puppeteer"
import fs from "fs"
import path from "path"
import { marked } from "marked"
import { pathToFileURL } from "url"

export async function generatePDF(options = {}){

 const markdownPath = options.markdownPath
  ? path.resolve(options.markdownPath)
  : path.resolve("docs/manual_usuario.md")
 const md = fs.readFileSync(markdownPath,"utf8")

 // convertir markdown a HTML
 const htmlContent = marked(md)

 const html = `
 <html>
 <head>
 <style>
  body{
   font-family: Arial;
   padding:40px;
  }

  img{
   max-width:100%;
   border:1px solid #ddd;
   margin:20px 0;
  }

  h1,h2,h3{
   color:#333;
  }
 </style>
 </head>
 <body>

 ${htmlContent}

 </body>
 </html>
 `

 const docsDir = path.dirname(markdownPath)
 const tempHtmlPath = path.join(docsDir, "__manual_preview__.html")
 fs.writeFileSync(tempHtmlPath, html, "utf8")
 const outputPath = options.outputPath
  ? path.resolve(options.outputPath)
  : path.join(docsDir, "manual_usuario.pdf")
 const fallbackOutputPath = options.fallbackOutputPath
  ? path.resolve(options.fallbackOutputPath)
  : path.join(docsDir, "manual_usuario.new.pdf")

 let browser

 try{
  browser = await puppeteer.launch()

  const page = await browser.newPage()

  await page.goto(pathToFileURL(tempHtmlPath).href,{
   waitUntil:"networkidle0"
  })

  await page.evaluate(async () => {
   const images = Array.from(document.images)
   await Promise.all(
    images.map((img) => {
     if (img.complete) return Promise.resolve()
     return new Promise((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true })
      img.addEventListener("error", () => resolve(), { once: true })
     })
    })
   )
  })

  const pdfBuffer = await page.pdf({
   format:"A4",
   printBackground:true
  })

  try{
   fs.writeFileSync(outputPath, pdfBuffer)
  }catch(error){
   if(error && error.code === "EBUSY"){
    fs.writeFileSync(fallbackOutputPath, pdfBuffer)
    console.log(`PDF bloqueado, se guardo en: ${fallbackOutputPath}`)
   }else{
    throw error
   }
  }
 }finally{
  if(browser){
   await browser.close()
  }

  if(fs.existsSync(tempHtmlPath)){
   fs.unlinkSync(tempHtmlPath)
  }
 }
}
