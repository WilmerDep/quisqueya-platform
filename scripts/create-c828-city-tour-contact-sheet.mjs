/**
 * C8.28-P: create a LOCAL editorial contact sheet using already registered MediaAsset IDs.
 * NO DB writes, NO API writes, NO Drive mutations, NO staging requests.
 * Generates a disposable HTML file in the operating system temp directory.
 * Run: node scripts/create-c828-city-tour-contact-sheet.mjs
 */
import dotenv from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
dotenv.config({ path: ".env", quiet: true });
const manifest = JSON.parse(readFileSync(new URL("../audits/c828-city-tour-media-manifest.json", import.meta.url), "utf8"));
const evidence = JSON.parse(readFileSync(new URL("../audits/c828-city-tour-drive-verification.json", import.meta.url), "utf8"));
const api = (() => { try {return new URL(process.env.APP_URL?.trim());} catch {return null;} })();
const host = String(process.env.MYSQL_HOST || "127.0.0.1").trim().toLowerCase();
if (!api || api.protocol !== "http:" || !["127.0.0.1","localhost"].includes(api.hostname) ||
  !["127.0.0.1","localhost","::1"].includes(host) ||
  manifest.cityTour.length !== 15 || manifest.altos.length !== 4 || evidence.assets.length !== 15) {
  console.error("C8_28_P=BLOCKED_CONFIG_OR_MANIFEST"); process.exit(1);
}
const prisma = new PrismaClient({ adapter:new PrismaMariaDb({
  host,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||"root",
  password:process.env.MYSQL_PASSWORD||"",database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2
})});
const esc = x => String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slugs=["altos-de-chavon","santo-domingo-city-tour","santo-domingo-city-tour-altos-de-chavon"];
try {
  const [records, experiences] = await Promise.all([
    prisma.mediaAsset.findMany({where:{storageKey:{in:[...manifest.cityTour,...manifest.altos].map(x=>x.storageKey)}},select:{
      id:true,storageKey:true,storageProvider:true,fileName:true
    }}),
    prisma.experience.findMany({where:{slug:{in:slugs}},select:{slug:true,status:true,galleryMediaIds:true}})
  ]);
  const ex=new Map(experiences.map(x=>[x.slug,x]));
  const guards={
    cityRegistered:manifest.cityTour.every(x=>records.filter(r=>r.storageKey===x.storageKey&&r.storageProvider==="google-drive").length===1),
    altosRegistered:manifest.altos.every(x=>records.filter(r=>r.storageKey===x.storageKey&&r.storageProvider==="google-drive").length===1),
    independentPublished:ex.get("santo-domingo-city-tour")?.status==="PUBLISHED",
    combinedDraft:ex.get("santo-domingo-city-tour-altos-de-chavon")?.status==="DRAFT",
    altosDraft:ex.get("altos-de-chavon")?.status==="DRAFT",
    independentNoManagedGallery:Array.isArray(ex.get("santo-domingo-city-tour")?.galleryMediaIds)?ex.get("santo-domingo-city-tour").galleryMediaIds.length===0:true,
    combinedNoManagedGallery:Array.isArray(ex.get("santo-domingo-city-tour-altos-de-chavon")?.galleryMediaIds)?ex.get("santo-domingo-city-tour-altos-de-chavon").galleryMediaIds.length===0:true,
  };
  if(!Object.values(guards).every(Boolean)){console.log("GUARDS="+JSON.stringify(guards));throw Object.assign(new Error("Guard mismatch"),{code:"GUARD_MISMATCH"});}
  const lookup=new Map(records.map(x=>[x.storageKey,x]));
  const tile = (x,i,section) => {
    const r=lookup.get(x.storageKey);
    const url=new URL("/api/v1/media/"+encodeURIComponent(r.id)+"/content",api).href;
    return '<article><a href="'+esc(url)+'" target="_blank" rel="noopener"><img loading="lazy" src="'+esc(url)+'" alt="'+esc(x.label)+'"></a>'+
     '<div class="details"><span class="index">'+String(i+1).padStart(2,"0")+'</span><strong>'+esc(x.label)+'</strong>'+
     '<small>'+esc(r.fileName)+'</small><code>'+esc(r.id)+'</code>'+
     '<label><input type="checkbox" data-section="'+esc(section)+'" data-label="'+esc(x.label)+'"> Revisada visualmente</label></div></article>';
  };
  const independent=manifest.cityTour.filter(x=>x.inIndependentSnapshot);
  const combined=[...manifest.altos.filter(x=>x.label!=="altos-iglesia-portada"),...manifest.cityTour.filter(x=>x.inCombinedSnapshot)];
  const extras=manifest.cityTour.filter(x=>!x.inIndependentSnapshot&&!x.inCombinedSnapshot);
  const section=(id,title,subtitle,items)=>
   '<section id="'+esc(id)+'"><h2>'+esc(title)+'</h2><p>'+esc(subtitle)+'</p><div class="gallery">'+
   items.map((x,i)=>tile(x,i,id)).join("")+'</div></section>';
  const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
   '<title>C8.28-P · Revisión editorial City Tour</title><style>'+
   ':root{color-scheme:dark;font-family:Inter,system-ui,Arial,sans-serif;background:#0c1720;color:#eff7f7}body{margin:0 auto;max-width:1380px;padding:28px 24px 100px}'+
   'h1{font-size:clamp(25px,3vw,40px);letter-spacing:-.035em;margin:0 0 12px}p{color:#aabdc5;line-height:1.6}section{margin:38px 0 64px}h2{border-top:1px solid #29414c;padding-top:28px}'+
   '.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(265px,1fr));gap:18px}article{background:#162833;border:1px solid #304c56;border-radius:12px;overflow:hidden}'+
   'article img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#243540;display:block}article a{display:block}article img:hover{filter:brightness(1.1)}'+
   '.details{padding:14px;display:flex;flex-direction:column;gap:8px}.details strong{font-size:17px}.details small{color:#c1d5da;overflow-wrap:anywhere}'+
   '.details code{font-size:11px;color:#8ea6b0;overflow-wrap:anywhere}.index{font-size:12px;color:#83d6ca;font-weight:700}label{font-size:13px;color:#d9eeee;padding:8px 0}'+
   '.note{padding:15px 18px;border:1px solid #446572;border-radius:10px;color:#c9dbdf;background:#152833}'+
   '</style></head><body>'+
   '<h1>C8.28-P · Revisión editorial de galerías</h1>'+
   '<p class="note">Solo vista local: esta página no guarda revisiones, no modifica MySQL y no publica nada. Las propuestas proceden del inventario CRM y requieren aprobación visual. Abre las fotos para verlas completas. Las casillas son marcas temporales, se reinician al recargar.</p>'+
   '<p>Origen multimedia local: '+esc(api.origin)+'. No se cargan imágenes externas ni se envían credenciales.</p>'+
   section("independent","City Tour independiente · 9 fotografías","Actualmente PUBLISHED. No modificar sin aprobación editorial específica.",independent)+
   section("combined","City Tour + Altos de Chavón · 12 fotografías","Actualmente DRAFT. Tres fotos Altos y nueve de City Tour.",combined)+
   section("extras","Otras fotografías disponibles · "+extras.length,"No asociadas en ninguna de las dos galerías del inventario; revisar si aportan valor.",extras)+
   '</body></html>';
  const path=join(tmpdir(),"quisqueya-c828-city-tour-contact-sheet.html");
  writeFileSync(path,html,"utf8");
  console.log("C8_28_P=CONTACT_SHEET_CREATED");
  console.log("CONTACT_SHEET_PATH="+path);
  console.log("INDEPENDENT="+independent.length);
  console.log("COMBINED="+combined.length);
  console.log("EXTRAS="+extras.length);
  console.log("IMAGES_SOURCE=LOCAL_API_ONLY");
  console.log("MYSQL=NOT_MODIFIED");
  console.log("STAGING=NOT_MODIFIED");
  console.log("PRODUCTION=NOT_MODIFIED");
} catch (err) {
  console.log("C8_28_P=FAILED");
  console.log("ERROR_CODE="+String(err?.code||err?.name||"UNKNOWN"));
  process.exitCode=1;
} finally {await prisma.$disconnect();}
