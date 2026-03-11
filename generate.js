import fs from "fs-extra"
import { crawlRoutes } from "./crawler.js"
import { enrichPagesWithAI } from "./ai.js"
import { generateMarkdown } from "./markdown.js"
import { generatePDF } from "./pdf.js"
import { generateWord } from "./word.js"

fs.ensureDirSync("docs")
fs.ensureDirSync("docs/images")

async function run(){

 fs.ensureDirSync("docs/images")

 console.log("Descubriendo rutas internas desde el dashboard...")

 const pages = await crawlRoutes()

 console.log("Encontradas:", pages.length)

 console.log("Generando descripciones con IA (si hay API key)...")

 const pagesWithDescriptions = await enrichPagesWithAI(pages)

 console.log("Generando manual...")

 generateMarkdown(pagesWithDescriptions)

 console.log("Generando PDF...")

 await generatePDF()

 console.log("Generando WORD...")

 await generateWord(pagesWithDescriptions)

 console.log("Manual generado")

}

run()
