/**
 * C8.29-K local attribution patch. Dry run by default.
 * --apply --confirm-local-credits-only to write local files with backups.
 * Does not interact with Drive, MySQL or staging.
 */
import {readFile,writeFile,stat} from "node:fs/promises";
import {resolve} from "node:path";
const apply=process.argv.includes("--apply");
const ok=process.argv.includes("--confirm-local-credits-only");
if(apply!==ok||process.argv.slice(2).some(x=>!["--apply","--confirm-local-credits-only"].includes(x))){
 console.log("C8_29_K_PATCH=BLOCKED_ARGUMENTS");process.exit(2);
}
const files=[
 {type:"api",path:resolve("server/src/modules/content/content-preview.service.ts")},
 {type:"types",path:resolve("../quisqueya-web/src/types/content.ts")},
 {type:"lightbox",path:resolve("../quisqueya-web/src/components/experience/ExperienceGalleryLightbox.tsx")}
];
const num=(s,v)=>s.split(v).length-1;
const exactly=(s,old,now)=>{
 if(num(s,old)!==1)throw new Error("UNEXPECTED_SOURCE_PATTERN_"+old.slice(0,40)+"_"+num(s,old));
 return s.replace(old,now);
};
function transform(type,s){
 if(type==="api"){
  if(s.includes("caption: row.caption ?? undefined"))throw new Error("API_ALREADY_PATCHED");
  s=exactly(s,"    mimeType: string | null;\n","    mimeType: string | null;\n    caption: string | null;\n");
  s=exactly(s,"      mimeType: row.mimeType ?? undefined,\n","      mimeType: row.mimeType ?? undefined,\n      caption: row.caption ?? undefined,\n");
  const match=/^(\s*)mimeType: true,\s*$/gm;
  let count=0;
  s=s.replace(match,(full,indent)=>{count++;return indent+"mimeType: true,\n"+indent+"caption: true,"});
  if(count<3)throw new Error("NOT_ALL_MEDIA_SELECTS_RECOGNIZED_"+count);
  return s;
 }
 if(type==="types")return exactly(s,"  mimeType?: string;\n}\n\nexport interface ExperienceLocation",
   "  mimeType?: string;\n  caption?: string;\n}\n\nexport interface ExperienceLocation");
 if(type==="lightbox"){
  if(s.includes('data-testid="c829-license-attribution"'))throw new Error("LIGHTBOX_ALREADY_PATCHED");
  const old='        <figcaption className="text-sm font-bold text-white/75">{index + 1} / {gallery.length}</figcaption>';
  const lines=[
   '        <figcaption className="text-center text-sm text-white/75">',
   '          <span className="block font-bold">{index + 1} / {gallery.length}</span>',
   '          {typeof gallery[index] !== "string" && gallery[index].caption?.includes("CC BY-SA 4.0") && (',
   '            <span data-testid="c829-license-attribution" className="mt-2 block max-w-[80vw] text-xs font-medium leading-relaxed text-white/85">',
   '              Foto: Danu Widjajanto ·{" "}',
   '              <a href={gallery[index].caption?.match(/https:\\/\\/commons\\.wikimedia\\.org\\/wiki\\/[^\\s·]+/)?.[0]}',
   '                 target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">Fuente original</a>',
   '              {" · "}',
   '              <a href="https://creativecommons.org/licenses/by-sa/4.0/"',
   '                 target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">CC BY-SA 4.0</a>',
   '              {" · Versión reducida a 1600 px"}',
   '            </span>',
   '          )}',
   '        </figcaption>'
  ];
  return exactly(s,old,lines.join("\n"));
 }
 throw new Error("INVALID_TYPE");
}
const pending=[];
try{
 for(const f of files){
  const original=await readFile(f.path,"utf8");
  const updated=transform(f.type,original);
  const backup=f.path+".c829k-original";
  try{await stat(backup);throw new Error("BACKUP_EXISTS_"+backup)}
  catch(e){if(e.code!=="ENOENT")throw e;}
  pending.push({...f,backup,original,updated});
 }
 console.log("C8_29_K_PATCH_MODE="+JSON.stringify(apply?"LOCAL_APPLY":"DRY_RUN"));
 console.log("C8_29_K_PATCH_PLAN="+JSON.stringify(pending.map(x=>({type:x.type,file:x.path,backup:x.backup}))));
 if(!apply)console.log("C8_29_K_PATCH=DRY_RUN_APPROVED");
 else{
  for(const x of pending)await writeFile(x.backup,x.original,{flag:"wx"});
  for(const x of pending)await writeFile(x.path,x.updated,"utf8");
  console.log("C8_29_K_PATCH=LOCAL_CREDITS_CODE_UPDATED");
 }
}catch(e){
 console.log("C8_29_K_PATCH=REVIEW_REQUIRED");
 console.log("ERROR_CODE="+String(e.message||e.name||"UNKNOWN"));
 process.exitCode=2;
}finally{
 console.log("MYSQL=NOT_MODIFIED");
 console.log("DRIVE=NOT_MODIFIED");
 console.log("STAGING=NOT_MODIFIED");
 console.log("PRODUCTION=NOT_MODIFIED");
}
