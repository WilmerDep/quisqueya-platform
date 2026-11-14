/**
 * C8.28-N — post-registration read-only audit.
 * Run from project root: node scripts/audit-c828-city-tour-post-registration.mjs
 * No writes, no credentials in output, no API auth needed.
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
dotenv.config({path:".env",quiet:true});

const manifest=JSON.parse(readFileSync(new URL("../audits/c828-city-tour-media-manifest.json",import.meta.url),"utf8"));
const verification=JSON.parse(readFileSync(new URL("../audits/c828-city-tour-drive-verification.json",import.meta.url),"utf8"));
const api=(()=>{try{return new URL(process.env.APP_URL?.trim())}catch{return null}})();
const validLocal=api?.protocol==="http:"&&["127.0.0.1","localhost"].includes(api.hostname)&&!api.username&&!api.password;
const host=String(process.env.MYSQL_HOST||"127.0.0.1").trim().toLowerCase();
if(!validLocal||!["127.0.0.1","localhost","::1"].includes(host)){
  console.log("C8_28_N=BLOCKED_NON_LOCAL_CONFIG");process.exit(1);
}
const prisma=new PrismaClient({adapter:new PrismaMariaDb({
  host,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||"root",
  password:process.env.MYSQL_PASSWORD||"",database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2
})});
const expectedByKey=new Map(verification.assets.map(x=>[x.storageKey,x]));
const slugList=["altos-de-chavon","santo-domingo-city-tour","santo-domingo-city-tour-altos-de-chavon"];
let failures=0;
const isImg=buf=>buf.length>=12&&buf.toString("ascii",0,4)==="RIFF"&&buf.toString("ascii",8,12)==="WEBP";
try{
  const [media,experiences]=await Promise.all([
    prisma.mediaAsset.findMany({where:{storageKey:{in:manifest.cityTour.map(x=>x.storageKey)}},
      select:{id:true,storageKey:true,storageProvider:true,fileName:true,mimeType:true,sizeBytes:true,publicUrl:true,createdAt:true,updatedAt:true}}),
    prisma.experience.findMany({where:{slug:{in:slugList}},
      select:{slug:true,status:true,featuredMediaId:true,galleryMediaIds:true,galleryMediaSourceIds:true}})
  ]);
  const byKey=new Map();
  for(const m of media) byKey.set(m.storageKey,[...(byKey.get(m.storageKey)||[]),m]);
  console.log("C8_28_N_API_ORIGIN="+api.origin);
  for(const file of manifest.cityTour){
    const matches=byKey.get(file.storageKey)||[],m=matches[0],expected=expectedByKey.get(file.storageKey);
    const metadataOk=matches.length===1&&m?.storageProvider==="google-drive"&&m?.fileName===expected?.name&&
      m?.mimeType==="image/webp"&&Number(m?.sizeBytes)===expected?.sizeBytes;
    if(!metadataOk)failures++;
    let deliveryOk=false,status=null,storedUrlHost=null,storedUrlMatchesLocal=false;
    if(m){
      try{
        const u=new URL(m.publicUrl);storedUrlHost=u.host;
        storedUrlMatchesLocal=u.origin===api.origin&&u.pathname===("/api/v1/media/"+encodeURIComponent(m.id)+"/content");
      }catch{storedUrlHost="RELATIVE_OR_INVALID"}
      try{
        const u=new URL("/api/v1/media/"+encodeURIComponent(m.id)+"/content",api);
        const response=await fetch(u,{signal:AbortSignal.timeout(22000),redirect:"error"});
        status=response.status;
        if(response.ok){
          const buf=Buffer.from(await response.arrayBuffer());
          deliveryOk=isImg(buf)&&buf.length===expected?.sizeBytes;
        }
      }catch(e){status=String(e.name||"FETCH_FAILED")}
    }
    if(!deliveryOk||!storedUrlMatchesLocal)failures++;
    console.log("MEDIA_CHECK="+JSON.stringify({
      label:file.label,id:m?.id||null,exists:matches.length===1,metadataOk,
      createdAt:m?.createdAt?.toISOString()||null,updatedAt:m?.updatedAt?.toISOString()||null,
      storedUrlHost,storedUrlMatchesLocal,deliveryOk,httpStatus:status
    }));
  }
  for(const slug of slugList){
    const e=experiences.find(x=>x.slug===slug);
    const galleryCount=Array.isArray(e?.galleryMediaIds)?e.galleryMediaIds.length:0;
    const sourceGalleryCount=Array.isArray(e?.galleryMediaSourceIds)?e.galleryMediaSourceIds.length:0;
    const expectedStatus=slug==="santo-domingo-city-tour"?"PUBLISHED":"DRAFT";
    const unchanged=(e?.status===expectedStatus)&&
      (slug==="altos-de-chavon"?galleryCount===3:galleryCount===0);
    if(!unchanged) failures++;
    console.log("EXPERIENCE_CHECK="+JSON.stringify({
      slug,found:Boolean(e),status:e?.status??null,
      featuredMediaId:e?.featuredMediaId??null,galleryCount,sourceGalleryCount,
      expectedBaselinePreserved:unchanged
    }));
  }
  console.log("C8_28_N_RECORDS="+media.length+"/15");
  console.log("C8_28_N="+(failures===0?"READ_ONLY_APPROVED":"REVIEW_REQUIRED"));
  console.log("C8_28_N_FINDINGS="+failures);
  if(failures)process.exitCode=2;
}catch(e){
  console.log("C8_28_N=FAILED");
  console.log("ERROR_CODE="+String(e?.code||e?.name||"UNKNOWN"));process.exitCode=1;
}finally{
  await prisma.$disconnect();
  console.log("MYSQL=NOT_MODIFIED");
  console.log("DRIVE=NOT_MODIFIED");
  console.log("EXPERIENCE_ASSOCIATIONS=NOT_MODIFIED");
  console.log("STAGING=NOT_MODIFIED");
}
