/**
 * C8.29-I: local, read-only verification of managed media preview contract
 * for the Altos de Chavon + Cueva de las Maravillas DRAFT experience.
 * Never changes any records or local web code.
 */
import dotenv from "dotenv";
import {PrismaClient} from "@prisma/client";
import {PrismaMariaDb} from "@prisma/adapter-mariadb";
dotenv.config({path:".env",quiet:true});
const host=String(process.env.MYSQL_HOST||"127.0.0.1").toLowerCase().trim();
let url;
try{url=new URL(String(process.env.APP_URL||"").trim())}catch{}
if(!["localhost","127.0.0.1","::1"].includes(host)||url?.protocol!=="http:"||
 !["localhost","127.0.0.1"].includes(url.hostname)||url.pathname!=="/"||
 url.username||url.password||url.hash||url.search||
 process.env.STORAGE_PROVIDER?.trim()!=="google-drive"){
 console.log("C8_29_I=BLOCKED_NONLOCAL_CONFIGURATION");process.exit(2);
}
const db=new PrismaClient({adapter:new PrismaMariaDb({
 host,port:Number(process.env.MYSQL_PORT||3306),
 user:process.env.MYSQL_USER||"root",password:process.env.MYSQL_PASSWORD||"",
 database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2
})});
const slug="altos-de-chavon-cueva-de-las-maravillas";
const ids=x=>Array.isArray(x)?x.filter(v=>typeof v==="string"):[];
const log=(k,v)=>console.log(k+"="+JSON.stringify(v));
try{
 const row=await db.experience.findUnique({where:{slug},
  select:{id:true,status:true,featuredMediaId:true,galleryMediaIds:true}});
 if(!row)throw new Error("EXPERIENCE_NOT_FOUND");
 const linked=ids(row.galleryMediaIds);
 const assets=await db.mediaAsset.findMany({where:{id:{in:linked}},
  select:{id:true,fileName:true,mimeType:true,storageKey:true,storageProvider:true,publicUrl:true,caption:true}});
 const byId=new Map(assets.map(x=>[x.id,x]));
 const dbOk=row.status==="DRAFT"&&row.featuredMediaId==="wp-media-307"&&
  linked.length===6&&new Set(linked).size===6&&linked.every(id=>byId.get(id)?.storageProvider==="google-drive"&&!!byId.get(id)?.storageKey);
 log("C8_29_I_DATABASE",{slug,status:row.status,featured:row.featuredMediaId,
  galleryCount:linked.length,allDrive:dbOk});
 if(!dbOk){console.log("C8_29_I=DB_BASELINE_MISMATCH");process.exitCode=2;}
 else{
  const previewToken=String(process.env.QUISQUEYA_PREVIEW_TOKEN||"").trim();
  if(!previewToken){
   console.log("C8_29_I=BLOCKED_PREVIEW_TOKEN_MISSING");process.exitCode=2;
  }else{
   const previewUrl=new URL("/api/v1/preview/experiences/"+slug,url);
   const res=await fetch(previewUrl,{headers:{"x-preview-token":previewToken},redirect:"error",signal:AbortSignal.timeout(15000)});
   if(!res.ok){
    log("C8_29_I_PREVIEW_HTTP",res.status);
    console.log("C8_29_I=PREVIEW_HTTP_FAILED");process.exitCode=2;
   }else{
    const payload=await res.json();
    const item=payload?.data;
    const gallery=Array.isArray(item?.gallery)?item.gallery:[];
    const returnedIds=gallery.map(x=>x?.id);
    const exact=JSON.stringify(returnedIds)===JSON.stringify(linked);
    const hasUrls=gallery.every(x=>typeof x?.url==="string"&&x.url.length>0);
    const urlsAreLocal=gallery.every(x=>{try{
      const u=new URL(x.url,url);return ["localhost","127.0.0.1"].includes(u.hostname);
    }catch{return false}});
    log("C8_29_I_PREVIEW",{slug:item?.slug||null,status:item?.status||null,
      galleryCount:gallery.length,mediaIdsExact:exact,allHaveUrls:hasUrls,
      urlsOnLoopback:urlsAreLocal,featuredPresent:Boolean(item?.featuredMedia),
      previewFlag:item?.preview===true});
    if(!exact||!hasUrls||!urlsAreLocal||!item?.featuredMedia||item.status!=="draft"){
     console.log("C8_29_I=PREVIEW_CONTRACT_REVIEW_REQUIRED");process.exitCode=2;
    }else{
     const delivery=[];
     for(const id of linked){
      const path=new URL("/api/v1/media/"+encodeURIComponent(id)+"/content",url);
      const r=await fetch(path,{method:"GET",redirect:"error",signal:AbortSignal.timeout(25000)});
      const buffer=Buffer.from(await r.arrayBuffer());
      const mime=String(r.headers.get("content-type")||"").toLowerCase();
      const jpeg=buffer.length>2&&buffer[0]===0xff&&buffer[1]===0xd8;
      const webp=buffer.length>12&&buffer.toString("ascii",0,4)==="RIFF"&&
        buffer.toString("ascii",8,12)==="WEBP";
      const signature=mime.startsWith("image/jpeg")?jpeg:mime.startsWith("image/webp")?webp:false;
      delivery.push({id,http:r.status,bytes:buffer.length,mime,
        validSignature:signature});
     }
     log("C8_29_I_MEDIA_DELIVERY",delivery);
     const valid=delivery.every(x=>x.http===200&&x.bytes>10000&&x.mime?.startsWith("image/")&&x.validSignature);
     console.log("C8_29_I="+(valid?"API_AND_MEDIA_VERIFIED":"MEDIA_DELIVERY_REVIEW_REQUIRED"));
     if(!valid)process.exitCode=2;
    }
   }
  }
 }
}catch(e){
 console.log("C8_29_I=FAILED");console.log("ERROR_CODE="+String(e?.code||e?.message||e?.name||"UNKNOWN"));process.exitCode=1;
}finally{
 await db.$disconnect();
 console.log("DATABASE=NOT_MODIFIED");
 console.log("DRIVE=NOT_MODIFIED");
 console.log("WEB_CODE=NOT_MODIFIED");
 console.log("STAGING=NOT_MODIFIED");
 console.log("PRODUCTION=NOT_MODIFIED");
}
