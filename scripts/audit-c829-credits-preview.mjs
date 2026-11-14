/**
 * C8.29-K: read-only final pre-staging gate. Checks preview image metadata and
 * local Drive registration credits; no edits. Run after both services are up.
 */
import dotenv from "dotenv";
import {PrismaClient} from "@prisma/client";
import {PrismaMariaDb} from "@prisma/adapter-mariadb";
dotenv.config({path:".env",quiet:true});
const host=String(process.env.MYSQL_HOST||"127.0.0.1").trim().toLowerCase();
let base;try{base=new URL(String(process.env.APP_URL||"").trim())}catch{}
if(!["localhost","127.0.0.1","::1"].includes(host)||base?.protocol!=="http:"||
 !["localhost","127.0.0.1"].includes(base.hostname)||base.port!=="3000"||
 base.pathname!=="/"||base.username||base.password||base.search||base.hash||
 process.env.STORAGE_PROVIDER?.trim()!=="google-drive"){
 console.log("C8_29_K=BLOCKED_NONLOCAL_CONFIGURATION");process.exit(2);
}
const ids=["cb3c9dc6-2e3a-4389-a4a2-4f5053911b43",
 "11e57378-3151-4e70-9cc1-bf3607ed8e65",
 "3f81b058-d736-4515-a4c1-cd10186a68a4"];
const db=new PrismaClient({adapter:new PrismaMariaDb({
 host,port:Number(process.env.MYSQL_PORT||3306),
 user:process.env.MYSQL_USER||"root",password:process.env.MYSQL_PASSWORD||"",
 database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2
})});
const log=(k,v)=>console.log(k+"="+JSON.stringify(v));
try{
 const assets=await db.mediaAsset.findMany({where:{id:{in:ids}},
  select:{id:true,caption:true,altText:true,storageProvider:true,storageKey:true}});
 const dbCredits=ids.every(id=>{
  const a=assets.find(x=>x.id===id);
  return a?.storageProvider==="google-drive"&&Boolean(a.storageKey)&&
    /Danu Widjajanto/.test(a.caption||"")&&/CC BY-SA 4\.0/.test(a.caption||"")&&
    /creativecommons\.org\/licenses\/by-sa\/4\.0/.test(a.caption||"")&&
    /commons\.wikimedia\.org/.test(a.caption||"");
 });
 log("C8_29_K_CREDITS_DB",{count:assets.length,verified:dbCredits});
 const token=String(process.env.QUISQUEYA_PREVIEW_TOKEN||"").trim();
 if(!token){console.log("C8_29_K=BLOCKED_PREVIEW_TOKEN");process.exitCode=2;}
 else{
  const uri=new URL("/api/v1/preview/experiences/altos-de-chavon-cueva-de-las-maravillas",base);
  const r=await fetch(uri,{headers:{"x-preview-token":token},redirect:"error",signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error("PREVIEW_HTTP_"+r.status);
  const item=(await r.json())?.data;
  const gallery=Array.isArray(item?.gallery)?item.gallery:[];
  const expected=ids.map(id=>gallery.find(x=>x?.id===id));
  const webCredits=expected.length===3&&expected.every(x=>
    x&&typeof x.caption==="string"&&/CC BY-SA 4\.0/.test(x.caption));
  const mediaOk=item?.status==="draft"&&gallery.length===6&&
   gallery.every(x=>typeof x.url==="string"&&(()=>{try{
    const u=new URL(x.url);return u.hostname==="127.0.0.1"&&u.port==="3000";
   }catch{return false}})());
  log("C8_29_K_PREVIEW",{slug:item?.slug||null,images:gallery.length,
   allUrlsLocal3000:mediaOk,creditsAvailableToWeb:webCredits});
  if(!dbCredits||!mediaOk){console.log("C8_29_K=BLOCKED_MEDIA_BASELINE");process.exitCode=2;}
  else if(!webCredits){console.log("C8_29_K=BLOCKED_CREDITS_NOT_EXPOSED");process.exitCode=2;}
  else console.log("C8_29_K=API_CREDITS_READY_FOR_WEB");
 }
}catch(e){
 console.log("C8_29_K=FAILED");console.log("ERROR_CODE="+String(e?.code||e?.message||"UNKNOWN"));process.exitCode=2;
}finally{
 await db.$disconnect();
 console.log("DATABASE=NOT_MODIFIED");console.log("DRIVE=NOT_MODIFIED");
 console.log("WEB_CODE=NOT_MODIFIED");console.log("STAGING=NOT_MODIFIED");console.log("PRODUCTION=NOT_MODIFIED");
}
