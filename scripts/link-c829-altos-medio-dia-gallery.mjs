/**
 * C8.29-C — controlled LOCAL association for Altos de Chavón medio día.
 * Default: dry run. Apply: --apply --confirm-local-altos-gallery-write.
 * Reuses exactly the three existing Google Drive gallery MediaAssets
 * from the DRAFT parent Altos de Chavón. Does not touch featured media,
 * WordPress source references, status, pricing, location or other experiences.
 */
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

dotenv.config({path:".env",quiet:true});
const apply=process.argv.includes("--apply");
const confirmation=process.argv.includes("--confirm-local-altos-gallery-write");
const allowed=new Set(["--apply","--confirm-local-altos-gallery-write"]);
if(process.argv.slice(2).some(x=>!allowed.has(x)) || (apply!==confirmation)){
  console.log("C8_29_C=BLOCKED_ARGUMENTS_OR_CONFIRMATION");
  process.exit(1);
}
const dbHost=String(process.env.MYSQL_HOST||"127.0.0.1").trim().toLowerCase();
let appUrl;
try{appUrl=new URL(String(process.env.APP_URL||"").trim());}catch{}
const localApi=appUrl?.protocol==="http:"&&["localhost","127.0.0.1"].includes(appUrl.hostname)&&
  appUrl.pathname==="/"&&!appUrl.username&&!appUrl.password&&!appUrl.search&&!appUrl.hash;
if(!localApi || !["127.0.0.1","localhost","::1"].includes(dbHost) ||
  String(process.env.STORAGE_PROVIDER||"").trim()!=="google-drive"){
  console.log("C8_29_C=BLOCKED_NONLOCAL_CONFIGURATION");
  process.exit(1);
}
const db=new PrismaClient({adapter:new PrismaMariaDb({
  host:dbHost,port:Number(process.env.MYSQL_PORT||3306),
  user:process.env.MYSQL_USER||"root",password:process.env.MYSQL_PASSWORD||"",
  database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2
})});
const asIds=x=>Array.isArray(x)?x.filter(y=>typeof y==="string"):[];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const log=(k,x)=>console.log(k+"="+JSON.stringify(x));
try{
  const slugs=["altos-de-chavon","altos-de-chavon-medio-dia"];
  const rows=await db.experience.findMany({where:{slug:{in:slugs}},
    select:{id:true,slug:true,status:true,featuredMediaId:true,galleryMediaIds:true,
      galleryMediaSourceIds:true,pricingJson:true,locationAddress:true,latitude:true,longitude:true}});
  const parent=rows.find(x=>x.slug===slugs[0]);
  const target=rows.find(x=>x.slug===slugs[1]);
  const parentIds=asIds(parent?.galleryMediaIds);
  const gallery=asIds(target?.galleryMediaIds);
  const assets=parentIds.length?await db.mediaAsset.findMany({
    where:{id:{in:parentIds}},
    select:{id:true,storageProvider:true,storageKey:true,mimeType:true,fileName:true}
  }):[];
  const byId=new Map(assets.map(x=>[x.id,x]));
  const guards={
    parentDraft:parent?.status==="DRAFT",
    parentFeaturedPresent:Boolean(parent?.featuredMediaId),
    parentGalleryExactlyThree:parentIds.length===3&&new Set(parentIds).size===3,
    parentAssetsDrive:assets.length===3&&parentIds.every(id=>byId.get(id)?.storageProvider==="google-drive" && Boolean(byId.get(id)?.storageKey)),
    targetDraft:target?.status==="DRAFT",
    targetFeaturedUnchanged:target?.featuredMediaId==="wp-media-307",
    targetSourceRefsEmpty:Array.isArray(target?.galleryMediaSourceIds)&&target.galleryMediaSourceIds.length===0,
    targetGalleryEmptyOrAlreadyLinked:gallery.length===0||same(gallery,parentIds)
  };
  log("C8_29_C_MODE",apply?"LOCAL_APPLY":"DRY_RUN");
  log("C8_29_C_GUARDS",guards);
  log("C8_29_C_PLAN",{
    slug:slugs[1],action:same(gallery,parentIds)?"ALREADY_LINKED":"REUSE_EXISTING_PARENT_GALLERY",
    featuredMediaId:target?.featuredMediaId||null,
    galleryMediaIds:parentIds,
    count:parentIds.length,
    source:"EXISTING_GOOGLE_DRIVE_MEDIAASSETS",
    status:target?.status||null,
    pricingPreserved:true,
    locationPreserved:true
  });
  if(!Object.values(guards).every(Boolean)){
    console.log("C8_29_C=BLOCKED_GUARDS");
    process.exitCode=2;
  }else if(!apply){
    console.log("C8_29_C=DRY_RUN_APPROVED");
  }else if(same(gallery,parentIds)){
    console.log("C8_29_C=ALREADY_LINKED");
  }else{
    const bearer=String(process.env.C828_MEDIA_BEARER_TOKEN||"").trim();
    if(!bearer){
      console.log("C8_29_C=BLOCKED_AUTH_MISSING");
      process.exitCode=2;
    }else{
      const authRes=await fetch(new URL("/api/v1/auth/me",appUrl),{
        headers:{Authorization:"Bearer "+bearer},redirect:"error",signal:AbortSignal.timeout(10000)
      });
      const auth=authRes.ok?await authRes.json().catch(()=>null):null;
      if(!["Super Admin","Administrador","Supervisor"].includes(auth?.data?.role)){
        console.log("C8_29_C=BLOCKED_ROLE");
        process.exitCode=2;
      }else{
        const live=await db.experience.findUnique({where:{id:target.id},select:{
          slug:true,status:true,featuredMediaId:true,galleryMediaIds:true,
          galleryMediaSourceIds:true,pricingJson:true,locationAddress:true,latitude:true,longitude:true
        }});
        const concurrencyOk=live?.slug===target.slug && live.status===target.status &&
          live.featuredMediaId===target.featuredMediaId &&
          same(asIds(live.galleryMediaIds),gallery) &&
          same(live.galleryMediaSourceIds,target.galleryMediaSourceIds) &&
          same(live.pricingJson,target.pricingJson) &&
          same(live.locationAddress,target.locationAddress) &&
          same(live.latitude,target.latitude) && same(live.longitude,target.longitude);
        if(!concurrencyOk){
          console.log("C8_29_C=BLOCKED_CONCURRENT_CHANGE");
          process.exitCode=2;
        }else{
          const res=await fetch(new URL("/api/v1/media/experiences/"+encodeURIComponent(target.id),appUrl),{
            method:"PATCH",headers:{Authorization:"Bearer "+bearer,"Content-Type":"application/json"},
            body:JSON.stringify({galleryMediaIds:parentIds}),redirect:"error",signal:AbortSignal.timeout(15000)
          });
          if(!res.ok){
            log("C8_29_C_PATCH_HTTP",res.status);
            console.log("C8_29_C=PATCH_FAILED");
            process.exitCode=2;
          }else{
            const current=await db.experience.findUnique({where:{id:target.id},select:{
              slug:true,status:true,featuredMediaId:true,galleryMediaIds:true,
              galleryMediaSourceIds:true,pricingJson:true,locationAddress:true,latitude:true,longitude:true
            }});
            const verified=current?.slug===target.slug &&
              current.status===target.status &&
              current.featuredMediaId===target.featuredMediaId &&
              same(asIds(current.galleryMediaIds),parentIds) &&
              same(current.galleryMediaSourceIds,target.galleryMediaSourceIds) &&
              same(current.pricingJson,target.pricingJson) &&
              same(current.locationAddress,target.locationAddress) &&
              same(current.latitude,target.latitude)&&same(current.longitude,target.longitude);
            log("C8_29_C_POST_WRITE",{verified,count:asIds(current?.galleryMediaIds).length});
            console.log("C8_29_C="+(verified?"LOCAL_GALLERY_LINKED":"POST_WRITE_REVIEW_REQUIRED"));
            if(!verified)process.exitCode=2;
          }
        }
      }
    }
  }
}catch(e){
  console.log("C8_29_C=FAILED");
  console.log("ERROR_CODE="+String(e?.code||e?.name||"UNKNOWN"));
  process.exitCode=1;
}finally{
  await db.$disconnect();
  console.log("DRIVE=NOT_MODIFIED");
  console.log("FEATURED_IMAGES=NOT_MODIFIED");
  console.log("OTHER_EXPERIENCES=NOT_MODIFIED");
  console.log("STAGING=NOT_MODIFIED");
  console.log("PRODUCTION=NOT_MODIFIED");
}
