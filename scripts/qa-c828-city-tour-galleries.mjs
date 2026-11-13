/**
 * C8.28-R - READ-ONLY QA of City Tour gallery DB and local API serialization.
 * Usage: node scripts/qa-c828-city-tour-galleries.mjs
 * Never writes MySQL, files, Drive, staging, or production.
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

dotenv.config({path:".env",quiet:true});
const manifest=JSON.parse(readFileSync(new URL("../audits/c828-city-tour-media-manifest.json",import.meta.url),"utf8"));
const api=(()=>{try{return new URL(process.env.APP_URL?.trim())}catch{return null}})();
const host=String(process.env.MYSQL_HOST||"127.0.0.1").trim().toLowerCase();
const localApi=api?.protocol==="http:"&&["localhost","127.0.0.1"].includes(api.hostname)&&
  api.pathname==="/"&&!api.username&&!api.password&&!api.search&&!api.hash;
if(!localApi||!["localhost","127.0.0.1","::1"].includes(host)){
 console.log("C8_28_R=BLOCKED_NON_LOCAL_CONFIGURATION");process.exit(1);
}
const db=new PrismaClient({adapter:new PrismaMariaDb({
 host,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||"root",
 password:process.env.MYSQL_PASSWORD||"",database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2
})});
const standalone="santo-domingo-city-tour";
const combined="santo-domingo-city-tour-altos-de-chavon";
const parent="altos-de-chavon";
const asIds=v=>Array.isArray(v)?v.filter(x=>typeof x==="string"):[];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
let failed=false;
async function localJson(path,headers={}){
 const url=new URL(path,api);
 const res=await fetch(url,{headers,redirect:"error",signal:AbortSignal.timeout(12000)});
 if(!res.ok)return {status:res.status,data:null};
 const payload=await res.json();
 return {status:res.status,data:payload?.data};
}
try{
 const [media,experiences]=await Promise.all([
  db.mediaAsset.findMany({where:{storageKey:{in:[...manifest.altos,...manifest.cityTour].map(x=>x.storageKey)}},
   select:{id:true,storageKey:true,storageProvider:true,publicUrl:true}}),
  db.experience.findMany({where:{slug:{in:[standalone,combined,parent]}},
   select:{slug:true,status:true,featuredMediaId:true,galleryMediaIds:true,galleryMediaSourceIds:true}})
 ]);
 const assets=new Map();
 for(const row of media)assets.set(row.storageKey,[...(assets.get(row.storageKey)||[]),row]);
 const idFor=key=>{
  const matches=assets.get(key)||[];
  return matches.length===1&&matches[0].storageProvider==="google-drive"?matches[0].id:null;
 };
 const standaloneIds=manifest.cityTour.map(x=>idFor(x.storageKey));
 const combinedIds=[...manifest.altos.filter(x=>x.label!=="altos-iglesia-portada"),...manifest.cityTour].map(x=>idFor(x.storageKey));
 const rows=new Map(experiences.map(x=>[x.slug,x]));
 const expected=[
  {slug:standalone,status:"PUBLISHED",featured:"wp-media-190",count:15,ids:standaloneIds,sourceCount:6},
  {slug:combined,status:"DRAFT",featured:"wp-media-286",count:18,ids:combinedIds,sourceCount:3}
 ];
 console.log("C8_28_R_API_ORIGIN="+api.origin);
 for(const check of expected){
  const row=rows.get(check.slug);
  const gallery=asIds(row?.galleryMediaIds);
  const valid=Boolean(row&&row.status===check.status&&row.featuredMediaId===check.featured&&
    gallery.length===check.count&&equal(gallery,check.ids)&&
    asIds(row.galleryMediaSourceIds).length===0&& // source IDs are numeric; checked below
    Array.isArray(row.galleryMediaSourceIds)&&row.galleryMediaSourceIds.length===check.sourceCount);
  if(!valid)failed=true;
  console.log("DB_GALLERY="+JSON.stringify({slug:check.slug,verified:valid,status:row?.status??null,
   featuredMediaId:row?.featuredMediaId??null,found:gallery.length,expected:check.count,
   wordpressSourceReferences:row?.galleryMediaSourceIds?.length??0}));
 }
 const alt=rows.get(parent);
 const altExpected=manifest.altos.filter(x=>x.label!=="altos-iglesia-portada").map(x=>idFor(x.storageKey));
 const altGallery=asIds(alt?.galleryMediaIds);
 const altOk=Boolean(alt&&alt.status==="DRAFT"&&alt.featuredMediaId===idFor(manifest.altos.find(x=>x.label==="altos-iglesia-portada").storageKey)&&
  altGallery.length===3&&new Set(altGallery).size===3&&altGallery.every(x=>altExpected.includes(x)));
 console.log("ALTOS_PARENT="+JSON.stringify({verified:altOk,managedGalleryCount:altGallery.length,status:alt?.status??null}));
 if(!altOk)failed=true;

 async function checkPayload(slug,expectedIds,headers){
  try {
   const response=await localJson("/api/v1/"+(headers?"preview":"public")+"/experiences/"+encodeURIComponent(slug),headers||{});
   const gallery=Array.isArray(response.data?.gallery)?response.data.gallery:[];
   const ids=gallery.map(x=>x.id);
   const ok=response.status===200&&equal(ids,expectedIds);
   console.log("API_GALLERY="+JSON.stringify({slug,endpoint:headers?"preview":"public",httpStatus:response.status,
    found:gallery.length,expected:expectedIds.length,orderedIdsMatch:equal(ids,expectedIds),verified:ok}));
   if(!ok)failed=true;
  } catch(e){
   console.log("API_GALLERY="+JSON.stringify({slug,endpoint:headers?"preview":"public",verified:false,
    errorCode:String(e?.code||e?.name||"FETCH_FAILED")}));
   failed=true;
  }
 }
 await checkPayload(standalone,standaloneIds,null);
 const previewToken=process.env.QUISQUEYA_PREVIEW_TOKEN?.trim();
 if(previewToken)await checkPayload(combined,combinedIds,{"x-preview-token":previewToken});
 else{
  console.log("API_GALLERY="+JSON.stringify({slug:combined,endpoint:"preview",verified:false,reason:"PREVIEW_TOKEN_NOT_CONFIGURED"}));
  failed=true;
 }
 console.log("C8_28_R="+(failed?"REVIEW_REQUIRED":"READ_ONLY_APPROVED"));
 if(failed)process.exitCode=2;
}catch(e){
 console.log("C8_28_R=FAILED");console.log("ERROR_CODE="+String(e?.code||e?.name||"UNKNOWN"));process.exitCode=1;
}finally{
 await db.$disconnect();
 console.log("MYSQL=NOT_MODIFIED");
 console.log("DRIVE=NOT_MODIFIED");
 console.log("STAGING=NOT_MODIFIED");
 console.log("PRODUCTION=NOT_MODIFIED");
}
