/**
 * C8.28-L — supervised registration through existing authenticated local API.
 * DEFAULT IS DRY RUN. No writes unless BOTH flags and a bearer token are supplied:
 * --apply --confirm-local-media-write
 * It never PATCHes experiences, changes prices/statuses, or uploads to Drive.
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
dotenv.config({path:".env",quiet:true});
const manifest=JSON.parse(readFileSync(new URL("../audits/c828-city-tour-media-manifest.json",import.meta.url),"utf8"));
const verification=JSON.parse(readFileSync(new URL("../audits/c828-city-tour-drive-verification.json",import.meta.url),"utf8"));
const apiUrl=(()=>{try{return new URL(String(process.env.APP_URL||"").trim())}catch{return null}})();
const strictLoopback=apiUrl?.protocol==="http:"&&["127.0.0.1","localhost"].includes(apiUrl.hostname)&&!apiUrl.username&&!apiUrl.password&&!apiUrl.search&&!apiUrl.hash&&apiUrl.pathname==="/";
const apply=process.argv.includes("--apply");
const explicit=process.argv.includes("--confirm-local-media-write");
const requestedArgs=new Set(process.argv.slice(2));
if([...requestedArgs].some(x=>!["--apply","--confirm-local-media-write"].includes(x))) {
  console.error("C8_28_L=UNKNOWN_ARGUMENT");process.exit(1);
}
if(!strictLoopback||process.env.STORAGE_PROVIDER?.trim()!=="google-drive") {
  console.error("C8_28_L=BLOCKED_API_CONFIGURATION");process.exit(1);
}
if(manifest.cityTour.length!==15||verification.assets.length!==15||
   new Set(manifest.cityTour.map(x=>x.storageKey)).size!==15||
   verification.assets.some(x=>!manifest.cityTour.some(y=>y.storageKey===x.storageKey))) {
  console.error("C8_28_L=BLOCKED_MANIFEST_MISMATCH");process.exit(1);
}
if(apply&&!explicit) {console.error("C8_28_L=BLOCKED_CONFIRMATION_REQUIRED");process.exit(1);}
const bearer=process.env.C828_MEDIA_BEARER_TOKEN?.trim();
if(apply&&!bearer) {console.error("C8_28_L=BLOCKED_API_BEARER_REQUIRED");process.exit(1);}

const db=new PrismaClient({adapter:new PrismaMariaDb({
  host:process.env.MYSQL_HOST||"127.0.0.1",port:Number(process.env.MYSQL_PORT||3306),
  user:process.env.MYSQL_USER||"root",password:process.env.MYSQL_PASSWORD||"",
  database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2
})});
const unique=x=>Array.isArray(x)?x.filter(a=>typeof a==="string"):[];
try{
  const [already,experiences]=await Promise.all([
    db.mediaAsset.findMany({where:{storageKey:{in:manifest.cityTour.map(x=>x.storageKey)}},select:{id:true,storageKey:true,storageProvider:true,fileName:true}}),
    db.experience.findMany({where:{slug:{in:["altos-de-chavon","santo-domingo-city-tour","santo-domingo-city-tour-altos-de-chavon"]}},select:{slug:true,status:true,galleryMediaIds:true}})
  ]);
  const ex=new Map(experiences.map(x=>[x.slug,x]));
  const byKey=new Map();
  for(const a of already)byKey.set(a.storageKey,[...(byKey.get(a.storageKey)||[]),a]);
  const guards={
    parentDraft:ex.get("altos-de-chavon")?.status==="DRAFT",
    combinedDraft:ex.get("santo-domingo-city-tour-altos-de-chavon")?.status==="DRAFT",
    standalonePublished:ex.get("santo-domingo-city-tour")?.status==="PUBLISHED",
    combinedGalleryUntouched:unique(ex.get("santo-domingo-city-tour-altos-de-chavon")?.galleryMediaIds).length===0,
    standaloneGalleryUntouched:unique(ex.get("santo-domingo-city-tour")?.galleryMediaIds).length===0,
    noDuplicateKeys:[...byKey.values()].every(a=>a.length===1),
    existingProviderConsistent:already.every(x=>x.storageProvider==="google-drive"),
  };
  console.log("C8_28_L_MODE="+(apply?"LOCAL_WRITE_REQUESTED":"DRY_RUN"));
  console.log("API_ORIGIN="+apiUrl.origin);
  console.log("GUARDS="+JSON.stringify(guards));
  if(!Object.values(guards).every(Boolean)){console.error("C8_28_L=BLOCKED_GUARDS");process.exitCode=1;}
  else{
    const candidates=verification.assets.map(asset=>{
      const rows=byKey.get(asset.storageKey)||[];
      return {label:asset.label,storageKey:asset.storageKey,fileName:asset.name,action:rows.length?"REUSE":"REGISTER",localId:rows[0]?.id??null};
    });
    console.log("REGISTRATION_PLAN="+JSON.stringify(candidates));
    console.log("REGISTRATION_REQUIRED="+candidates.filter(x=>x.action==="REGISTER").length);
    console.log("GALLERY_LINKING=NOT_INCLUDED");
    console.log("FEATURED_IMAGES=NOT_MODIFIED");
    if(!apply)console.log("C8_28_L=DRY_RUN_APPROVED");
    else{
      // The existing protected API validates provider metadata and reuses records by storage key.
      let succeeded=0;
      for(const candidate of candidates){
        if(candidate.action==="REUSE"){console.log("REGISTRATION_RESULT="+JSON.stringify({label:candidate.label,action:"REUSE",ok:true}));continue;}
        const endpoint=new URL("/api/v1/media/register",apiUrl);
        const response=await fetch(endpoint,{method:"POST",headers:{
          "Authorization":"Bearer "+bearer,"Content-Type":"application/json"
        },body:JSON.stringify({storageKey:candidate.storageKey}),signal:AbortSignal.timeout(25000),redirect:"error"});
        if(!response.ok){
          console.error("REGISTRATION_RESULT="+JSON.stringify({label:candidate.label,ok:false,status:response.status}));
          console.error("C8_28_L=STOPPED_PARTIAL_WRITE_POSSIBLE");process.exitCode=1;break;
        }
        const payload=await response.json();
        const row=payload?.data;
        if(!row?.id||row.storageKey!==candidate.storageKey||row.storageProvider!=="google-drive"){
          console.error("C8_28_L=STOPPED_UNEXPECTED_API_RESPONSE");process.exitCode=1;break;
        }
        succeeded++;
        console.log("REGISTRATION_RESULT="+JSON.stringify({label:candidate.label,ok:true,localId:row.id}));
      }
      if(!process.exitCode)console.log("C8_28_L=LOCAL_REGISTRATION_COMPLETED");
      console.log("CREATED_OR_UPDATED_VIA_API="+succeeded);
    }
  }
}catch(error){console.error("C8_28_L=ERROR");console.error("ERROR_CODE="+String(error?.code||error?.name||"UNKNOWN"));process.exitCode=1}
finally{
  await db.$disconnect();
  console.log("DRIVE=NOT_MODIFIED");
  console.log("EXPERIENCE_ASSOCIATIONS=NOT_MODIFIED");
  console.log("STAGING=NOT_MODIFIED");
  console.log("PRODUCTION=NOT_MODIFIED");
  console.log("MYSQL="+(apply?"LOCAL_MEDIA_REGISTRATION_REQUESTED":"NOT_MODIFIED"));
}
