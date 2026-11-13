/**
 * C8.29-D — READ ONLY: inspect the Quisqueya Platform's own Google Drive storage
 * inventory to discover Cave of Wonders assets under PAGINA WEB/Experiencias.
 * No MySQL, Google Drive, file or API mutations. Uses admin GET only.
 * Requires C829_MEDIA_BEARER_TOKEN (temporary access token).
 */
import dotenv from "dotenv";
dotenv.config({path:".env",quiet:true});
const url=(()=>{try{return new URL(String(process.env.APP_URL||"").trim())}catch{return null}})();
const allowed=url?.protocol==="http:"&&["127.0.0.1","localhost"].includes(url.hostname)&&
  url.pathname==="/"&&!url.username&&!url.password&&!url.search&&!url.hash;
if(!allowed||String(process.env.STORAGE_PROVIDER||"").trim()!=="google-drive"){
  console.log("C8_29_D=BLOCKED_NONLOCAL_CONFIGURATION");process.exit(1);
}
const token=String(process.env.C829_MEDIA_BEARER_TOKEN||"").trim();
if(!token){console.log("C8_29_D=BLOCKED_AUTH_MISSING");process.exit(1);}
const endpoint="/api/v1/media/storage/objects";
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const isFolder=o=>o?.mimeType==="application/vnd.google-apps.folder";
const matches=o=>/cueva|maravill|cave|wonders|gruta|stalact|espele/.test(normalize(o?.name));
const log=(k,v)=>console.log(k+"="+JSON.stringify(v));
async function list(parentKey){
  const path=new URL(endpoint,url);
  if(parentKey)path.searchParams.set("parentKey",parentKey);
  const r=await fetch(path,{headers:{Authorization:"Bearer "+token},redirect:"error",signal:AbortSignal.timeout(18000)});
  if(!r.ok)throw Object.assign(new Error("STORAGE_LIST_HTTP_"+r.status),{status:r.status});
  const v=await r.json();
  if(v?.data?.provider!=="google-drive"||!Array.isArray(v?.data?.objects))throw new Error("STORAGE_RESPONSE_INVALID");
  return v.data.objects;
}
try{
  const root=await list(null);
  const experienceFolders=root.filter(isFolder).filter(o=>/experienc|experienc|excursion|tour/.test(normalize(o.name)));
  log("C8_29_D_ROOT",{objects:root.length,experienceFolders:experienceFolders.map(x=>({name:x.name,key:x.key}))});
  if(experienceFolders.length===0){
    console.log("C8_29_D=EXPERIENCES_FOLDER_NOT_FOUND");
    process.exitCode=2;
  }else{
    const queue=experienceFolders.map(o=>({key:o.key,path:o.name,depth:0}));
    const visited=new Set();
    const found=[];
    const folderStats=[];
    const MAX_FOLDERS=180;
    let visitedFolders=0,totalObjects=0,truncated=false;
    while(queue.length){
      if(visitedFolders>=MAX_FOLDERS){truncated=true;break;}
      const folder=queue.shift();
      if(visited.has(folder.key))continue;
      visited.add(folder.key);visitedFolders++;
      const objs=await list(folder.key);totalObjects+=objs.length;
      folderStats.push({path:folder.path,items:objs.length});
      for(const o of objs){
        const candidate={name:o.name,key:o.key,mimeType:o.mimeType||null,
          folder:folder.path,kind:isFolder(o)?"FOLDER":"FILE"};
        if(matches(o))found.push(candidate);
        if(isFolder(o)&&folder.depth<4){
          queue.push({key:o.key,path:folder.path+"/"+o.name,depth:folder.depth+1});
        }else if(isFolder(o))truncated=true;
      }
    }
    log("C8_29_D_CANDIDATES",found);
    log("C8_29_D_INVENTORY",{rootItems:root.length,foldersVisited:visitedFolders,
      objectsScanned:totalObjects,candidates:found.length,partial:truncated,
      folderSample:folderStats.slice(0,25)});
    console.log("C8_29_D="+(truncated?"PARTIAL_READ_ONLY":"READ_ONLY_COMPLETED"));
  }
}catch(e){
  console.log("C8_29_D=FAILED");
  console.log("ERROR_CODE="+String(e?.message||e?.name||"UNKNOWN"));
  process.exitCode=1;
}finally{
  console.log("HTTP_METHOD=GET_ONLY");
  console.log("MYSQL=NOT_MODIFIED");
  console.log("DRIVE=NOT_MODIFIED");
  console.log("STAGING=NOT_MODIFIED");
  console.log("PRODUCTION=NOT_MODIFIED");
}
