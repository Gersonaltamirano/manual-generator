import { execSync } from "child_process"
import { config } from "./config.js"

export function getLaravelRoutes(projectPath){

 const output = execSync(
  "php artisan route:list --json",
  { cwd: projectPath }
 )

 const routes = JSON.parse(output)

 return routes
  .filter(r => r.method.includes("GET"))
  .filter(r => r.uri)
  .filter(r => !r.uri.includes("{"))   // 🔴 elimina rutas con parámetros
  .filter(r => {
   return !config.ignoreRoutes.some(ignore =>
    r.uri.includes(ignore)
   )
  })
  .map(r => ({
   uri: r.uri,
   name: r.name
  }))

}