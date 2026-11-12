/**
 * C8.28-K — READ ONLY local API/proxy preflight before any City Tour registration.
 * Run: node scripts/check-c828-local-media-delivery.mjs
 * No DB writes, Drive writes or credentials printed.
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
dotenv.config({ path: ".env", quiet: true });
const manifest = JSON.parse(readFileSync(new URL("../audits/c828-city-tour-media-manifest.json",import.meta.url),"utf8"));
const configured = String(process.env.APP_URL || "").trim().replace(/\/+$/, "");
const base = (()=>{try{return new URL(configured)}catch{return null}})();
if (!base || !["localhost","127.0.0.1"].includes(base.hostname) || base.protocol !== "http:") {
  console.log("C8_28_K=BLOCKED");
  console.log("REASON=APP_URL_MUST_BE_LOCAL_HTTP");
  console.log("MYSQL=NOT_MODIFIED"); console.log("DRIVE=NOT_MODIFIED"); console.log("STAGING=NOT_MODIFIED");
  process.exit(1);
}
const db=new PrismaClient({adapter:new PrismaMariaDb({
  host:process.env.MYSQL_HOST||"127.0.0.1",port:Number(process.env.MYSQL_PORT||3306),
  user:process.env.MYSQL_USER||"root",password:process.env.MYSQL_PASSWORD||"",
  database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2,
})});
let failed=false;
try {
  const originals=await db.mediaAsset.findMany({
    where:{storageKey:{in:manifest.altos.map(x=>x.storageKey)}},
    select:{id:true,storageKey:true,storageProvider:true,publicUrl:true,mimeType:true}
  });
  const byKey=new Map(originals.map(x=>[x.storageKey,x]));
  console.log("C8_28_K_API_ORIGIN="+base.origin);
  for(const asset of manifest.altos) {
    const row=byKey.get(asset.storageKey);
    if(!row || row.storageProvider!=="google-drive"){
      console.log("PROXY_CHECK="+JSON.stringify({label:asset.label,verified:false,errorCode:"LOCAL_MEDIA_NOT_FOUND"}));
      failed=true;continue;
    }
    const url=new URL("/api/v1/media/"+encodeURIComponent(row.id)+"/content",base);
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(12000),redirect:"error"});
      if(!response.ok){
        console.log("PROXY_CHECK="+JSON.stringify({label:asset.label,verified:false,httpStatus:response.status}));
        failed=true;continue;
      }
      const bytes=Buffer.from(await response.arrayBuffer());
      const riff=bytes.length>=12&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
      const jpeg=bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
      const expectedMime=row.mimeType||"";
      const verified=bytes.length>0&&(riff||jpeg)&&
        (expectedMime.includes("webp")?riff:expectedMime.includes("jpeg")||expectedMime.includes("jpg")?jpeg:(riff||jpeg));
      console.log("PROXY_CHECK="+JSON.stringify({label:asset.label,verified,httpStatus:response.status,bytes:bytes.length,imageSignatureVerified:riff||jpeg,provider:"google-drive",storedPublicUrlHost:(()=>{try{return new URL(row.publicUrl).host}catch{return "RELATIVE"}})()}));
      if(!verified)failed=true;
    }catch(err){failed=true;console.log("PROXY_CHECK="+JSON.stringify({label:asset.label,verified:false,errorCode:String(err?.name||"FETCH_ERROR")}));}
  }
  console.log("C8_28_K="+(failed?"BLOCKED":"READ_ONLY_APPROVED"));
  if(failed) process.exitCode=1;
}catch(err){
  console.log("C8_28_K=FAILED");
  console.log("ERROR_CODE="+String(err?.code||err?.name||"UNKNOWN"));
  process.exitCode=1;
}finally{
  await db.$disconnect();
  console.log("MYSQL=NOT_MODIFIED");
  console.log("DRIVE=NOT_MODIFIED");
  console.log("STAGING=NOT_MODIFIED");
}
