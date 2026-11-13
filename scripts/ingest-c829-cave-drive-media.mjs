/**
 * C8.29-G: local-only controlled Google Drive ingestion.
 *
 * Same OAuth account/root as Platform, with explicit ancestry verification.
 * Platform's current admin API can register, list and associate, but does not
 * expose a general authorized create-folder/file-upload operation.
 * This local bridge uses Drive API solely for folder creation/upload, and the
 * existing local Platform POST /media/register for MediaAsset registration.
 *
 * Default: dry run, no writes. Apply requires both flags:
 * --apply --confirm-local-cave-drive-ingestion
 * and C829_MEDIA_BEARER_TOKEN set to a local CRM admin access token.
 *
 * Never changes experience featured, gallery, status, prices, location,
 * staging or production. Attribution manifest remains in local-media-c829-cave.
 */
import dotenv from "dotenv";
import {readFile,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {createHash} from "node:crypto";
dotenv.config({path:".env",quiet:true});
const apply=process.argv.includes("--apply");
const confirm=process.argv.includes("--confirm-local-cave-drive-ingestion");
if(process.argv.slice(2).some(a=>!["--apply","--confirm-local-cave-drive-ingestion"].includes(a)) ||
   apply!==confirm){console.log("C8_29_G=BLOCKED_ARGUMENTS");process.exit(2);}
const host=String(process.env.MYSQL_HOST||"127.0.0.1").trim().toLowerCase();
const api=(()=>{try{return new URL(String(process.env.APP_URL||"").trim())}catch{return null}})();
if(!["localhost","127.0.0.1","::1"].includes(host) ||
   api?.protocol!=="http:" || !["localhost","127.0.0.1"].includes(api.hostname) ||
   api.pathname!=="/" || api.search || api.hash || api.username || api.password ||
   process.env.STORAGE_PROVIDER?.trim()!=="google-drive" ||
   !process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim()){
 console.log("C8_29_G=BLOCKED_NONLOCAL_OR_NONDRIVE_CONFIGURATION");process.exit(2);
}
const rootId=process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID.trim();
const base=resolve("local-media-c829-cave");
const manifest=JSON.parse(await readFile(join(base,"attribution-manifest.json"),"utf8"));
const expectedNames=[
 "cueva-de-las-maravillas-interior-01.jpg",
 "cueva-de-las-maravillas-pictografias-tainas-01.jpg",
 "cueva-de-las-maravillas-pictografias-tainas-02.jpg"
];
const assets=manifest.assets;
if(manifest.cycle!=="C8.29-F"||assets?.length!==3 ||
   assets.some((a,i)=>a.fileName!==expectedNames[i]||a.creator!=="Danu Widjajanto"||
    a.license!=="CC BY-SA 4.0"||a.mimeType!=="image/jpeg") ){
 console.log("C8_29_G=BLOCKED_MANIFEST");process.exit(2);
}
const files=[];
for(const a of assets){
 const bytes=await readFile(join(base,a.fileName));
 const hash=createHash("sha256").update(bytes).digest("hex");
 if(hash!==a.sha256||bytes.length!==a.sizeBytes || bytes[0]!==255 ||bytes[1]!==216)
  {console.log("C8_29_G=BLOCKED_FILE_CHECKSUM");process.exit(2);}
 files.push({a,bytes,md5:createHash("md5").update(bytes).digest("hex")});
}
const httpJson=async (url,options={})=>{
 const res=await fetch(url,{...options,redirect:"error",signal:AbortSignal.timeout(30000)});
 const payload=await res.json().catch(()=>null);
 if(!res.ok)throw new Error("HTTP_"+res.status+"_AT_"+new URL(url).pathname);
 return payload;
};
const log=(name,data)=>console.log(name+"="+JSON.stringify(data));
let anyDriveWrites=false,anyDbWrites=false;
try{
 const cred={
  client_id:String(process.env.GOOGLE_DRIVE_CLIENT_ID||"").trim(),
  client_secret:String(process.env.GOOGLE_DRIVE_CLIENT_SECRET||"").trim(),
  refresh_token:String(process.env.GOOGLE_DRIVE_REFRESH_TOKEN||"").trim(),
  grant_type:"refresh_token"
 };
 if(Object.values(cred).some(x=>!x))throw new Error("GOOGLE_DRIVE_OAUTH_CONFIGURATION_MISSING");
 const auth=await httpJson("https://oauth2.googleapis.com/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams(cred)
 });
 if(!auth?.access_token)throw new Error("GOOGLE_DRIVE_ACCESS_TOKEN_MISSING");
 const dh={Authorization:"Bearer "+auth.access_token};
 const driveBase="https://www.googleapis.com/drive/v3/files";
 const props="id,name,mimeType,parents,md5Checksum,size,trashed";
 const driveGet=async id=>await httpJson(driveBase+"/"+encodeURIComponent(id)+"?fields="+encodeURIComponent(props)+"&supportsAllDrives=true",{headers:dh});
 const driveList=async parent=>{
  let pageToken="",out=[];
  do{
   const u=new URL(driveBase);
   u.searchParams.set("q",("'"+parent.replaceAll("'","\\'")+"' in parents and trashed = false"));
   u.searchParams.set("fields","nextPageToken,files("+props+")");
   u.searchParams.set("pageSize","1000");
   u.searchParams.set("supportsAllDrives","true");
   u.searchParams.set("includeItemsFromAllDrives","true");
   if(pageToken)u.searchParams.set("pageToken",pageToken);
   const p=await httpJson(u,{headers:dh});
   out.push(...(p.files||[]));pageToken=p.nextPageToken||"";
  }while(pageToken);
  return out;
 };
 const folderMime="application/vnd.google-apps.folder";
 const root=await driveGet(rootId);
 if(root.name!=="PAGINA WEB" ||root.mimeType!==folderMime||root.trashed)throw new Error("ROOT_BOUNDARY_MISMATCH");
 const children=await driveList(rootId);
 const experiences=children.filter(x=>x.name==="Experiencias"&&x.mimeType===folderMime);
 if(experiences.length!==1)throw new Error("EXPERIENCES_FOLDER_NOT_UNIQUE");
 const experiencesId=experiences[0].id;
 const expMetadata=await driveGet(experiencesId);
 if(!expMetadata.parents?.includes(rootId))throw new Error("EXPERIENCES_PARENT_INVALID");
 let caveDirs=(await driveList(experiencesId)).filter(x=>x.name==="Cueva de las Maravillas"&&x.mimeType===folderMime);
 if(caveDirs.length>1)throw new Error("CAVE_FOLDER_DUPLICATE");
 const caveId=caveDirs[0]?.id||null;
 let objects=caveId?await driveList(caveId):[];
 const plan=files.map(x=>{
  const same=objects.filter(o=>o.name===x.a.fileName);
  if(same.length>1)throw new Error("DUPLICATE_FILE_NAME_"+x.a.fileName);
  if(same.length===1){
   if(same[0].mimeType!=="image/jpeg" ||same[0].md5Checksum!==x.md5)
    throw new Error("FILE_NAME_CONFLICT_"+x.a.fileName);
   return {fileName:x.a.fileName,action:"REUSE_IDENTICAL",fileId:same[0].id};
  }
  return {fileName:x.a.fileName,action:"UPLOAD"};
 });
 log("C8_29_G_MODE",apply?"LOCAL_APPLY":"DRY_RUN");
 log("C8_29_G_TARGET",{root:"PAGINA WEB",experienceFolder:"Experiencias",caveFolderExists:Boolean(caveId),existingItems:objects.length});
 log("C8_29_G_PLAN",plan.map(({fileName,action})=>({fileName,action})));
 if(!apply){console.log("C8_29_G=DRY_RUN_APPROVED");}
 else{
  const bearer=String(process.env.C829_MEDIA_BEARER_TOKEN||"").trim();
  if(!bearer)throw new Error("LOCAL_ADMIN_BEARER_MISSING");
  const authMe=await httpJson(new URL("/api/v1/auth/me",api),{headers:{Authorization:"Bearer "+bearer}});
  if(!["Super Admin","Administrador","Supervisor"].includes(authMe?.data?.role))
    throw new Error("INSUFFICIENT_LOCAL_ADMIN_ROLE");
  const localHeaders={Authorization:"Bearer "+bearer,"Content-Type":"application/json"};
  let targetCaveId=caveId;
  if(!targetCaveId){
   const created=await httpJson(driveBase+"?fields="+encodeURIComponent(props)+"&supportsAllDrives=true",{
    method:"POST",headers:{...dh,"Content-Type":"application/json"},
    body:JSON.stringify({name:"Cueva de las Maravillas",mimeType:folderMime,parents:[experiencesId]})
   });
   anyDriveWrites=true;targetCaveId=created.id;
   if(!targetCaveId||!created.parents?.includes(experiencesId))throw new Error("CAVE_FOLDER_CREATION_UNVERIFIED");
  }
  const newState=[];
  for(const item of files){
   const p=plan.find(x=>x.fileName===item.a.fileName);
   let fileId=p.fileId;
   if(!fileId){
    const boundary="quisqueya_c829_"+createHash("sha256").update(item.a.fileName).digest("hex").slice(0,20);
    const parts=[
     Buffer.from("--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+
       JSON.stringify({name:item.a.fileName,parents:[targetCaveId]})+"\r\n"),
     Buffer.from("--"+boundary+"\r\nContent-Type: image/jpeg\r\n\r\n"),
     item.bytes,
     Buffer.from("\r\n--"+boundary+"--\r\n")
    ];
    const body=Buffer.concat(parts);
    const created=await httpJson("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields="+encodeURIComponent(props)+"&supportsAllDrives=true",{
      method:"POST",headers:{...dh,"Content-Type":"multipart/related; boundary="+boundary},
      body
    });
    anyDriveWrites=true;fileId=created.id;
    if(created.md5Checksum!==item.md5||!created.parents?.includes(targetCaveId))
      throw new Error("DRIVE_UPLOAD_CHECKSUM_MISMATCH_"+item.a.fileName);
   }
   // The Platform API handles MediaAsset registration and its public proxy.
   const caption="Foto: Danu Widjajanto · CC BY-SA 4.0 · "+item.a.pageUrl+
     " · Licencia: https://creativecommons.org/licenses/by-sa/4.0/ · Versión reducida a 1600 px.";
   const registered=await httpJson(new URL("/api/v1/media/register",api),{
    method:"POST",headers:localHeaders,
    body:JSON.stringify({storageKey:fileId,altText:"Cueva de las Maravillas, República Dominicana",caption})
   });
   anyDbWrites=true;
   if(registered?.data?.storageKey!==fileId||registered?.data?.storageProvider!=="google-drive")
     throw new Error("MEDIA_ASSET_REGISTRATION_UNVERIFIED_"+item.a.fileName);
   newState.push({fileName:item.a.fileName,storageKey:fileId,mediaAssetId:registered.data.id,
      sha256:item.a.sha256,license:item.a.license,source:item.a.pageUrl});
   log("C8_29_G_REGISTERED",{fileName:item.a.fileName,mediaAssetId:registered.data.id,registered:true});
  }
  const artifact=join(base,"drive-registration.json");
  await writeFile(artifact,JSON.stringify({cycle:"C8.29-G",status:"LOCAL_INGESTION_VERIFIED",assets:newState},null,2)+"\n");
  log("C8_29_G_REGISTERED_COUNT",newState.length);
  console.log("C8_29_G=DRIVE_AND_LOCAL_MEDIA_REGISTERED");
 }
}catch(e){
 console.log("C8_29_G=REVIEW_REQUIRED");
 console.log("ERROR_CODE="+String(e?.message||e?.name||"UNKNOWN"));
 process.exitCode=2;
}finally{
 console.log("DRIVE="+(anyDriveWrites?"POSSIBLY_MODIFIED_CHECK_INVENTORY":"NOT_MODIFIED"));
 console.log("MYSQL="+(anyDbWrites?"LOCAL_MEDIA_REGISTRATION_ATTEMPTED":"NOT_MODIFIED"));
 console.log("EXPERIENCE_ASSOCIATIONS=NOT_MODIFIED");
 console.log("STAGING=NOT_MODIFIED");
 console.log("PRODUCTION=NOT_MODIFIED");
}
