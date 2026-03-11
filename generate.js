import fs from "fs-extra"
import { crawlRoutes } from "./crawler.js"
import { enrichPagesWithAI } from "./ai.js"
import { generateMarkdown } from "./markdown.js"
import { generatePDF } from "./pdf.js"
import { generateWord } from "./word.js"
import { getManualOutputPaths } from "./output.js"

fs.ensureDirSync("docs")
fs.ensureDirSync("docs/images")

async function run(){

 fs.ensureDirSync("docs/images")

 console.log("Descubriendo rutas internas desde el dashboard...")

 const pages = await crawlRoutes()

 console.log("Encontradas:", pages.length)

 console.log("Generando descripciones con IA (si hay API key)...")

 const pagesWithDescriptions = await enrichPagesWithAI(pages)
 const outputs = getManualOutputPaths()

 console.log("Generando manual...")

 generateMarkdown(pagesWithDescriptions, outputs.markdownPath)

 console.log("Generando PDF...")

 await generatePDF({
  markdownPath: outputs.markdownPath,
  outputPath: outputs.pdfPath,
  fallbackOutputPath: outputs.pdfFallbackPath,
 })

 console.log("Generando WORD...")

 await generateWord(pagesWithDescriptions, {
  outputPath: outputs.wordPath,
  fallbackOutputPath: outputs.wordFallbackPath,
 })

 console.log("Limpiando imagenes temporales...")

 fs.emptyDirSync("docs/images")

 console.log("Manual generado")

}

run()
