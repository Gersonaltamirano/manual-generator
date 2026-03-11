import fs from "fs-extra"

export function generateMarkdown(pages){

 let md=`# Manual de Usuario del Sistema

Este documento describe las funcionalidades principales del sistema.

`

 const modules={}

 for(const p of pages){

  const parts = p.url.split("/")
  const module = parts[3] || "general"

  if(!modules[module]){
   modules[module]=[]
  }

  modules[module].push(p)

 }

 for(const module in modules){

  md+=`\n\n# ${module.toUpperCase()}\n`

  modules[module].forEach(p=>{

   const images = Array.isArray(p.images)
    ? p.images
    : (p.image ? [p.image] : [])

   md+=`

## ${p.url}

Acceso a esta seccion del sistema.

`

   images.forEach((image, index) => {
    const imageName = image.split("/").pop()
    md += `![Pantalla ${index + 1}](./images/${imageName})\n\n`
   })

  })

 }

 fs.writeFileSync("docs/manual_usuario.md",md)

}
