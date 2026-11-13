/**
 * C8.29-H — guarded LOCAL gallery for Altos de Chavon + Cueva de las Maravillas.
 * Dry-run by default; apply requires --apply --confirm-local-altos-cave-gallery-write
 * and a temporary C829_MEDIA_BEARER_TOKEN for an authorized local admin.
 * Does not change featured photo, legacy source IDs, pricing, location or status.
 */
import dotenv from "dotenv";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {PrismaClient} from "@prisma/client";
import {PrismaMariaDb} from "@prisma/adapter-mariadb";
dotenv.config({path:".env",quiet:true});
const apply=process.argv.includes("--apply"), confirm=process.argv.includes("--confirm-local-altos-cave-gallery-write");
if(apply!==confirm || process.argv.slice(2).some(x=>!["--apply","--confirm-local-altos-cave-gallery-write"].includes(x))){
 console.log("C8_29_H=BLOCKED_ARGUMENTS");process.exit(2);
}
const host=String(process.env.MYSQL_HOST||"127.0.0.1").trim().toLowerCase();
let api;try{api=new URL(String(process.env.APP_URL||"").trim())}catch{}
if(!["127.0.0.1","localhost","::1"].includes(host)||api?.protocol!=="http:"||
 !["127.0.0.1","localhost"].includes(api.hostname)||api.pathname!=="/"||
 api.username||api.password||api.search||api.hash||
 String(process.env.STORAGE_PROVIDER||"").trim()!=="google-drive"){
 console.log("C8_29_H=BLOCKED_NONLOCAL_CONFIGURATION");process.exit(2);
}
const db=new PrismaClient({adapter:new PrismaMariaDb({
 host,port:Number(process.env.MYSQL_PORT||3306),
 user:process.env.MYSQL_USER||"root",password:process.env.MYSQL_PASSWORD||"",
 database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2
})});
const ids=x=>Array.isArray(x)?x.filter(y=>typeof y==="string"):[];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const log=(a,b)=>console.log(a+"="+JSON.stringify(b));
const fields={id:true,slug:true,status:true,featuredMediaId:true,galleryMediaIds:true,
 galleryMediaSourceIds:true,pricingJson:true,locationAddress:true,latitude:true,longitude:true};
const expectedNames=[
 "cueva-de-las-maravillas-interior-01.jpg",
 "cueva-de-las-maravillas-pictografias-tainas-01.jpg",
 "cueva-de-las-maravillas-pictografias-tainas-02.jpg"
];
try{
 const slugs=["altos-de-chavon","altos-de-chavon-cueva-de-las-maravillas"];
 const rows=await db.experience.findMany({where:{slug:{in:slugs}},select:fields});
 const parent=rows.find(x=>x.slug===slugs[0]), target=rows.find(x=>x.slug===slugs[1]);
 const registered=JSON.parse(await readFile(resolve("local-media-c829-cave/drive-registration.json"),"utf8"));
 const license=JSON.parse(await readFile(resolve("local-media-c829-cave/attribution-manifest.json"),"utf8"));
 const cave=registered.assets||[];
 const parentIds=ids(parent?.galleryMediaIds);
 const caveIds=cave.map(x=>x.mediaAssetId);
 const proposed=[...parentIds,...caveIds];
 const media=proposed.length?await db.mediaAsset.findMany({where:{id:{in:proposed}},
  select:{id:true,fileName:true,storageProvider:true,storageKey:true,caption:true}}):[];
 const map=new Map(media.map(m=>[m.id,m]));
 const old=ids(target?.galleryMediaIds);
 const guards={
  parentDraft:parent?.status==="DRAFT",
  parentGalleryThree:parentIds.length===3 && new Set(parentIds).size===3,
  caveRegistrationVerified:registered.cycle==="C8.29-G"&&registered.status==="LOCAL_INGESTION_VERIFIED"&&
   cave.length===3&&same(cave.map(x=>x.fileName),expectedNames),
  caveLicenseManifestVerified:license.cycle==="C8.29-F"&&license.assets?.length===3&&
   same(license.assets.map(x=>x.fileName),expectedNames)&&
   license.assets.every(x=>x.license==="CC BY-SA 4.0"&&x.creator==="Danu Widjajanto")&&
   cave.every((x,i)=>x.sha256===license.assets[i].sha256),
  allMediaDrive:proposed.length===6&&new Set(proposed).size===6&&media.length===6&&
   proposed.every(id=>map.get(id)?.storageProvider==="google-drive"&&Boolean(map.get(id)?.storageKey)),
  caveAssetsMatchRegistration:cave.every(c=>map.get(c.mediaAssetId)?.storageKey===c.storageKey&&
   map.get(c.mediaAssetId)?.fileName===c.fileName&&
   map.get(c.mediaAssetId)?.caption?.includes("CC BY-SA 4.0")),
  targetDraft:target?.status==="DRAFT",
  targetFeaturedPreserved:Boolean(target?.featuredMediaId),
  targetLegacyGalleryPreservable:Array.isArray(target?.galleryMediaSourceIds),
  targetGalleryEmptyOrAlreadyLinked:old.length===0||same(old,proposed)
 };
 log("C8_29_H_MODE",apply?"LOCAL_APPLY":"DRY_RUN");
 log("C8_29_H_GUARDS",guards);
 log("C8_29_H_PLAN",{
  slug:slugs[1],action:same(old,proposed)?"ALREADY_LINKED":"LINK_SIX_EXISTING_DRIVE_ASSETS",
  featuredMediaId:target?.featuredMediaId||null,
  galleryMediaIds:proposed,altos:parentIds.length,cave:caveIds.length,
  total:proposed.length,status:target?.status||null
 });
 if(!Object.values(guards).every(Boolean)){console.log("C8_29_H=BLOCKED_GUARDS");process.exitCode=2;}
 else if(!apply){console.log("C8_29_H=DRY_RUN_APPROVED");}
 else if(same(old,proposed)){console.log("C8_29_H=ALREADY_LINKED");}
 else{
  const bearer=String(process.env.C829_MEDIA_BEARER_TOKEN||"").trim();
  if(!bearer){console.log("C8_29_H=BLOCKED_AUTH_MISSING");process.exitCode=2;}
  else{
   const authRes=await fetch(new URL("/api/v1/auth/me",api),{headers:{Authorization:"Bearer "+bearer},redirect:"error",signal:AbortSignal.timeout(10000)});
   const auth=authRes.ok?await authRes.json().catch(()=>null):null;
   if(!["Super Admin","Administrador","Supervisor"].includes(auth?.data?.role)){
    console.log("C8_29_H=BLOCKED_ROLE");process.exitCode=2;
   }else{
    const live=await db.experience.findUnique({where:{id:target.id},select:fields});
    const concurrency=live && Object.keys(fields).every(key=>same(live[key],target[key]));
    if(!concurrency){console.log("C8_29_H=BLOCKED_CONCURRENT_CHANGE");process.exitCode=2;}
    else{
     const patch=await fetch(new URL("/api/v1/media/experiences/"+encodeURIComponent(target.id),api),{
      method:"PATCH",headers:{Authorization:"Bearer "+bearer,"Content-Type":"application/json"},
      body:JSON.stringify({galleryMediaIds:proposed}),redirect:"error",signal:AbortSignal.timeout(15000)
     });
     if(!patch.ok){log("C8_29_H_PATCH_HTTP",patch.status);console.log("C8_29_H=PATCH_FAILED");process.exitCode=2;}
     else{
      const post=await db.experience.findUnique({where:{id:target.id},select:fields});
      const verified=post && Object.keys(fields).every(key=>
       key==="galleryMediaIds"?same(ids(post[key]),proposed):same(post[key],target[key]));
      log("C8_29_H_POST_WRITE",{verified,count:ids(post?.galleryMediaIds).length});
      console.log("C8_29_H="+(verified?"LOCAL_GALLERY_LINKED":"POST_WRITE_REVIEW_REQUIRED"));
      if(!verified)process.exitCode=2;
     }
    }
   }
  }
 }
}catch(e){
 console.log("C8_29_H=FAILED");console.log("ERROR_CODE="+String(e?.code||e?.name||"UNKNOWN"));process.exitCode=1;
}finally{
 await db.$disconnect();
 console.log("DRIVE=NOT_MODIFIED");
 console.log("FEATURED_IMAGES=NOT_MODIFIED");
 console.log("OTHER_EXPERIENCES=NOT_MODIFIED");
 console.log("STAGING=NOT_MODIFIED");
 console.log("PRODUCTION=NOT_MODIFIED");
}
