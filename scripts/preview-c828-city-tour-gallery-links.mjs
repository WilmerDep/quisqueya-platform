/**
 * C8.28-O — PREVIEW ONLY, computes local gallery association proposals.
 * No mutations, no requests to staging/production, no file output.
 * Run: node scripts/preview-c828-city-tour-gallery-links.mjs
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
dotenv.config({path:".env",quiet:true});
const manifest=JSON.parse(readFileSync(new URL("../audits/c828-city-tour-media-manifest.json",import.meta.url),"utf8"));
const evidence=JSON.parse(readFileSync(new URL("../audits/c828-city-tour-drive-verification.json",import.meta.url),"utf8"));
const keys=[...manifest.cityTour,...manifest.altos].map(x=>x.storageKey);
const host=String(process.env.MYSQL_HOST||"127.0.0.1").trim().toLowerCase();
const api=(()=>{try{return new URL(process.env.APP_URL?.trim())}catch{return null}})();
if(!["localhost","127.0.0.1","::1"].includes(host)||!api||api.protocol!=="http:"||!["localhost","127.0.0.1"].includes(api.hostname)){
 console.log("C8_28_O=BLOCKED_NON_LOCAL_CONFIGURATION");process.exit(1);
}
const db=new PrismaClient({adapter:new PrismaMariaDb({
 host,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||"root",
 password:process.env.MYSQL_PASSWORD||"",database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2
})});
const slugs=["altos-de-chavon","santo-domingo-city-tour","santo-domingo-city-tour-altos-de-chavon"];
const ids=x=>Array.isArray(x)?x.filter(y=>typeof y==="string"):[];
try{
 const [media,experiences]=await Promise.all([
  db.mediaAsset.findMany({where:{storageKey:{in:keys}},select:{id:true,storageKey:true,storageProvider:true,fileName:true,mimeType:true,publicUrl:true}}),
  db.experience.findMany({where:{slug:{in:slugs}},select:{id:true,slug:true,status:true,featuredMediaId:true,galleryMediaIds:true,galleryMediaSourceIds:true}})
 ]);
 const keyMap=new Map();
 for(const asset of media)keyMap.set(asset.storageKey,[...(keyMap.get(asset.storageKey)||[]),asset]);
 const exp=new Map(experiences.map(x=>[x.slug,x]));
 const cityOK=evidence.assets.length===15 && manifest.cityTour.length===15 &&
  manifest.cityTour.every(row=>{
   const found=keyMap.get(row.storageKey)||[];
   const file=evidence.assets.find(x=>x.storageKey===row.storageKey);
   return found.length===1&&file?.name===found[0].fileName&&found[0].storageProvider==="google-drive"&&found[0].mimeType==="image/webp";
  });
 const altosOK=manifest.altos.length===4 && manifest.altos.every(row=>{
  const found=keyMap.get(row.storageKey)||[];return found.length===1&&found[0].storageProvider==="google-drive";
 });
 const guards={
  allExperienceRecordsFound:slugs.every(slug=>exp.has(slug)),
  cityAssetsVerified:cityOK,
  altosAssetsVerified:altosOK,
  independentPublished:exp.get("santo-domingo-city-tour")?.status==="PUBLISHED",
  combinedDraft:exp.get("santo-domingo-city-tour-altos-de-chavon")?.status==="DRAFT",
  altosDraft:exp.get("altos-de-chavon")?.status==="DRAFT",
  independentManagedGalleryEmpty:ids(exp.get("santo-domingo-city-tour")?.galleryMediaIds).length===0,
  combinedManagedGalleryEmpty:ids(exp.get("santo-domingo-city-tour-altos-de-chavon")?.galleryMediaIds).length===0,
  altosGalleryUnchanged:ids(exp.get("altos-de-chavon")?.galleryMediaIds).length===3,
  noDuplicateAssets:[...keyMap.values()].every(v=>v.length===1),
 };
 const canPreview=Object.values(guards).every(Boolean);
 console.log("C8_28_O_MODE=READ_ONLY");
 console.log("GUARDS="+JSON.stringify(guards));
 const localInfo=row=>{
  const asset=keyMap.get(row.storageKey)?.[0];
  return {label:row.label,storageKey:row.storageKey,localMediaId:asset?.id||null,fileName:asset?.fileName||null};
 };
 const independent=manifest.cityTour.filter(x=>x.inIndependentSnapshot).map(localInfo);
 const combined=[
  ...manifest.altos.filter(x=>x.label!=="altos-iglesia-portada").map(localInfo),
  ...manifest.cityTour.filter(x=>x.inCombinedSnapshot).map(localInfo)
 ];
 const uniqueOK=arr=>new Set(arr.map(x=>x.localMediaId)).size===arr.length&&arr.every(x=>x.localMediaId);
 console.log("INDEPENDENT="+JSON.stringify({slug:"santo-domingo-city-tour",status:exp.get("santo-domingo-city-tour")?.status,count:independent.length,proposed:independent}));
 console.log("COMBINED="+JSON.stringify({slug:"santo-domingo-city-tour-altos-de-chavon",status:exp.get("santo-domingo-city-tour-altos-de-chavon")?.status,count:combined.length,proposed:combined}));
 console.log("PORTADAS_PRESERVADAS="+JSON.stringify(slugs.map(slug=>({slug,featuredMediaId:exp.get(slug)?.featuredMediaId||null}))));
 console.log("EDITORIAL_STATUS=PROPOSAL_FROM_CRM_SNAPSHOT_NOT_VISUALLY_APPROVED");
 console.log("EXPERIENCE_PATCH=NOT_EXECUTED");
 console.log("C8_28_O="+(canPreview&&uniqueOK(independent)&&uniqueOK(combined)&&independent.length===9&&combined.length===12?"PREVIEW_APPROVED":"REVIEW_REQUIRED"));
 if(!(canPreview&&uniqueOK(independent)&&uniqueOK(combined)&&independent.length===9&&combined.length===12))process.exitCode=2;
}catch(error){console.log("C8_28_O=FAILED");console.log("ERROR_CODE="+String(error?.code||error?.name||"UNKNOWN"));process.exitCode=1}
finally{await db.$disconnect();console.log("MYSQL=NOT_MODIFIED");console.log("STAGING=NOT_MODIFIED");console.log("PRODUCTION=NOT_MODIFIED");}
