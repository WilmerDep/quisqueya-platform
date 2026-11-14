/**
 * C8.29-J1 — Repair ONLY three stale LOCAL port-4001 URLs for the Altos
 * managed gallery assets, retaining original ids, storage keys and all metadata.
 * Dry-run by default; --apply --confirm-local-altos-media-url-repair to write.
 * All writes are constrained to the local MariaDB configured in .env.
 */
import dotenv from "dotenv";
import {PrismaClient} from "@prisma/client";
import {PrismaMariaDb} from "@prisma/adapter-mariadb";
dotenv.config({path:".env",quiet:true});
const apply=process.argv.includes("--apply");
const confirm=process.argv.includes("--confirm-local-altos-media-url-repair");
if(apply!==confirm||process.argv.slice(2).some(v=>!["--apply","--confirm-local-altos-media-url-repair"].includes(v))){
 console.log("C8_29_J1=BLOCKED_ARGUMENTS");process.exit(2);
}
const dbHost=String(process.env.MYSQL_HOST||"127.0.0.1").trim().toLowerCase();
let appUrl;try{appUrl=new URL(String(process.env.APP_URL||"").trim())}catch{}
if(!["127.0.0.1","localhost","::1"].includes(dbHost)||
 appUrl?.protocol!=="http:"||!["127.0.0.1","localhost"].includes(appUrl.hostname)||
 appUrl.port!=="3000"||appUrl.pathname!=="/"||appUrl.search||appUrl.hash||
 appUrl.username||appUrl.password||String(process.env.STORAGE_PROVIDER||"").trim()!=="google-drive"){
 console.log("C8_29_J1=BLOCKED_NONLOCAL_CONFIGURATION");process.exit(2);
}
const names=[
 "ff6c9b0f-809e-4dc6-8c9f-b00033641544",
 "54bfc192-106c-412b-bee2-9693fbd9a57e",
 "1f9d099b-d2d6-4ebb-bf72-1e22e83c91ba"
];
const db=new PrismaClient({adapter:new PrismaMariaDb({
 host:dbHost,port:Number(process.env.MYSQL_PORT||3306),
 user:process.env.MYSQL_USER||"root",password:process.env.MYSQL_PASSWORD||"",
 database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2
})});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const log=(k,v)=>console.log(k+"="+JSON.stringify(v));
let modified=0;
try{
 const items=await db.mediaAsset.findMany({where:{id:{in:names}},
  select:{id:true,storageKey:true,storageProvider:true,publicUrl:true,fileName:true}});
 const byId=new Map(items.map(item=>[item.id,item]));
 const targetSlug="altos-de-chavon-cueva-de-las-maravillas";
 const experience=await db.experience.findUnique({where:{slug:targetSlug},
  select:{status:true,featuredMediaId:true,galleryMediaIds:true}});
 const gallery=Array.isArray(experience?.galleryMediaIds)?experience.galleryMediaIds:[];
 const guards={
  threeRecords:items.length===3&&names.every(id=>byId.has(id)),
  driveProvider:items.every(x=>x.storageProvider==="google-drive"&&!!x.storageKey),
  allUsedInDraftExperience:experience?.status==="DRAFT"&&experience?.featuredMediaId==="wp-media-307"&&
   names.every(id=>gallery.includes(id))&&gallery.length===6,
  originalHostsSafe:items.every(x=>{
   try{let u=new URL(x.publicUrl);return u.protocol==="http:"&&
    u.hostname==="127.0.0.1"&&["4001","3000"].includes(u.port)&&
    u.pathname==="/api/v1/media/"+x.id+"/content"&&!u.search&&!u.hash}
   catch{return false}
  })
 };
 const planned=names.map(id=>{
  const a=byId.get(id);
  return {id,old:a?.publicUrl||null,new:"http://127.0.0.1:3000/api/v1/media/"+id+"/content",
   action:a?.publicUrl?.startsWith("http://127.0.0.1:3000/")?"ALREADY_LOCAL_3000":"REPOINT_LOCAL_4001_TO_3000"};
 });
 log("C8_29_J1_MODE",apply?"LOCAL_APPLY":"DRY_RUN");
 log("C8_29_J1_GUARDS",guards);
 log("C8_29_J1_PLAN",planned);
 if(!Object.values(guards).every(Boolean)){
  console.log("C8_29_J1=BLOCKED_GUARDS");process.exitCode=2;
 }else if(!apply){
  console.log("C8_29_J1=DRY_RUN_APPROVED");
 }else{
  for(const p of planned.filter(x=>x.old!==x.new)){
   const result=await db.mediaAsset.updateMany({
    where:{id:p.id,publicUrl:p.old,storageProvider:"google-drive"},
    data:{publicUrl:p.new}
   });
   if(result.count!==1)throw new Error("CONCURRENT_RECORD_CHANGE_"+p.id);
   modified++;
  }
  const post=await db.mediaAsset.findMany({where:{id:{in:names}},
   select:{id:true,publicUrl:true,storageKey:true,storageProvider:true}});
  const ok=post.length===3&&post.every(p=>p.publicUrl==="http://127.0.0.1:3000/api/v1/media/"+p.id+"/content"&&
   p.storageKey===byId.get(p.id)?.storageKey && p.storageProvider==="google-drive");
  log("C8_29_J1_POST_WRITE",{verified:ok,count:post.length,updated:modified});
  console.log("C8_29_J1="+(ok?"LOCAL_URLS_REPAIRED":"POST_WRITE_REVIEW_REQUIRED"));
  if(!ok)process.exitCode=2;
 }
}catch(e){console.log("C8_29_J1=FAILED");console.log("ERROR_CODE="+String(e?.code||e?.message||"UNKNOWN"));process.exitCode=2;}
finally{
 await db.$disconnect();
 console.log("MYSQL="+(modified?"LOCAL_MEDIA_URL_ONLY_UPDATED":"NOT_MODIFIED"));
 console.log("DRIVE=NOT_MODIFIED");
 console.log("EXPERIENCE_ASSOCIATIONS=NOT_MODIFIED");
 console.log("WEB_CODE=NOT_MODIFIED");
 console.log("STAGING=NOT_MODIFIED");
 console.log("PRODUCTION=NOT_MODIFIED");
}
