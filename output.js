import path from "path"
import { config } from "./config.js"

function sanitizeHost(host){
 return host
  .toLowerCase()
  .replace(/[:]/g, "-")
  .replace(/[^a-z0-9.-]/g, "-")
}

export function getManualBaseName(){
 try{
  const host = sanitizeHost(new URL(config.baseURL).host)
  return `manual_sistema_${host || "local"}`
 }catch{
  return "manual_sistema_local"
 }
}

export function getManualOutputPaths(){
 const baseName = getManualBaseName()

 return {
  baseName,
  markdownPath: path.resolve("docs", `${baseName}.md`),
  pdfPath: path.resolve("docs", `${baseName}.pdf`),
  pdfFallbackPath: path.resolve("docs", `${baseName}.new.pdf`),
  wordPath: path.resolve("docs", `${baseName}.docx`),
  wordFallbackPath: path.resolve("docs", `${baseName}.new.docx`),
 }
}
