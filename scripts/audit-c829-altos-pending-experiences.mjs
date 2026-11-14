/**
 * C8.29-A — Local-only audit of pending Altos de Chavón experience variants.
 * Read-only. No API writes, no Drive calls, no staging/production interaction.
 * Run: node scripts/audit-c829-altos-pending-experiences.mjs
 */
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

dotenv.config({ path: ".env", quiet: true });

const dbHost = String(process.env.MYSQL_HOST || "127.0.0.1").trim().toLowerCase();
if (!["127.0.0.1","localhost","::1"].includes(dbHost)) {
  console.log("C8_29_A=BLOCKED_NONLOCAL_DATABASE");
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({
  host: dbHost,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "quisqueya_core",
  connectionLimit: 2
}) });
const slugs = [
  "altos-de-chavon",
  "altos-de-chavon-medio-dia",
  "altos-de-chavon-cueva-de-las-maravillas",
  "santo-domingo-city-tour-altos-de-chavon",
  "aventura-en-buggies-y-altos-de-chavon",
  "santo-domingo-city-tour"
];
const ids=x=>Array.isArray(x)?x.filter(y=>typeof y==="string"):[];
const report=(key,value)=>console.log(key+"="+JSON.stringify(value));
try {
  const experiences=await prisma.experience.findMany({
    where:{slug:{in:slugs}},
    select:{
      slug:true,status:true,title:true,featuredMediaId:true,galleryMediaIds:true,
      galleryMediaSourceIds:true,locationAddress:true,latitude:true,longitude:true,
      videoUrl:true,pricingJson:true
    }
  });
  const referenced=[...new Set(experiences.flatMap(x=>[x.featuredMediaId,...ids(x.galleryMediaIds)].filter(Boolean)))];
  const media=referenced.length?await prisma.mediaAsset.findMany({
    where:{id:{in:referenced}},
    select:{id:true,sourceProvider:true,storageProvider:true,storageKey:true,publicUrl:true,mimeType:true,fileName:true}
  }):[];
  const byId=new Map(media.map(x=>[x.id,x]));
  const results=slugs.map(slug=>{
    const e=experiences.find(x=>x.slug===slug);
    if(!e)return {slug,exists:false};
    const featured=e.featuredMediaId?byId.get(e.featuredMediaId):null;
    const gallery=ids(e.galleryMediaIds);
    const missing=gallery.filter(id=>!byId.has(id));
    const managed=gallery.map(id=>byId.get(id)).filter(Boolean);
    const providers=Object.fromEntries([...new Set(managed.map(x=>x.storageProvider||x.sourceProvider||"UNKNOWN"))].map(p=>[p,managed.filter(x=>(x.storageProvider||x.sourceProvider||"UNKNOWN")===p).length]));
    const urlHosts=[...new Set([featured,...managed].filter(Boolean).map(m=>{
      try{return new URL(m.publicUrl).host}catch{return "RELATIVE"}
    }))];
    const notes=[];
    if(!e.featuredMediaId)notes.push("FEATURED_MISSING");
    if(e.featuredMediaId&&!featured)notes.push("FEATURED_REFERENCE_NOT_FOUND");
    if(featured?.sourceProvider==="WORDPRESS")notes.push("FEATURED_WORDPRESS_LEGACY");
    if(!gallery.length)notes.push("NO_MANAGED_GALLERY");
    if(missing.length)notes.push("BROKEN_GALLERY_REFERENCES");
    if(!e.locationAddress && (e.latitude===null||e.longitude===null))notes.push("LOCATION_NOT_COMPLETED");
    if(urlHosts.some(x=>x.includes("localhost")||x.startsWith("127.0.0.1")))notes.push("LOCALHOST_MEDIA_URLS");
    return {
      slug,exists:true,status:e.status,
      featuredMediaId:e.featuredMediaId,
      featuredSource:featured?.sourceProvider||null,
      featuredStorage:featured?.storageProvider||null,
      managedGalleryCount:gallery.length,
      wordpressGalleryReferences:ids(e.galleryMediaSourceIds).length,
      managedMediaProviders:providers,
      missingMediaReferences:missing.length,
      hasLocationAddress:Boolean(e.locationAddress),
      hasCoordinates:e.latitude!==null&&e.longitude!==null,
      hasVideo:Boolean(e.videoUrl),
      hasPricingData:e.pricingJson!==null,
      mediaUrlHosts:urlHosts,
      notes
    };
  });
  report("C8_29_A_EXPERIENCES",results);
  report("C8_29_A_COUNTS",{
    found:results.filter(x=>x.exists).length,
    requested:slugs.length,
    missingFeatured:results.filter(x=>x.notes?.includes("FEATURED_MISSING")).length,
    legacyFeatured:results.filter(x=>x.notes?.includes("FEATURED_WORDPRESS_LEGACY")).length,
    emptyManagedGallery:results.filter(x=>x.notes?.includes("NO_MANAGED_GALLERY")).length
  });
  console.log("C8_29_A=READ_ONLY_COMPLETED");
} catch(e) {
  console.log("C8_29_A=FAILED");
  console.log("ERROR_CODE="+String(e?.code||e?.name||"UNKNOWN"));
  process.exitCode=1;
} finally {
  await prisma.$disconnect();
  console.log("MYSQL=NOT_MODIFIED");
  console.log("DRIVE=NOT_MODIFIED");
  console.log("STAGING=NOT_MODIFIED");
  console.log("PRODUCTION=NOT_MODIFIED");
}
