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
  // Local preview may have compacted same-line declarations. Match the tokens,
  // not whitespace or line breaks, and require exactly 3 media query selectors.
  s=exactly(s,"mimeType: string | null;","mimeType: string | null; caption: string | null;");
  s=exactly(s,"mimeType: row.mimeType ?? undefined,","mimeType: row.mimeType ?? undefined, caption: row.caption ?? undefined,");
  const selector="mimeType: true,";
  const selectorCount=num(s,selector);
  if(selectorCount!==3)throw new Error("EXPECTED_THREE_MEDIA_SELECTS_FOUND_"+selectorCount);
  if(s.includes("caption: true,"))throw new Error("API_SELECT_CAPTION_ALREADY_PRESENT");
  s=s.replaceAll(selector,"mimeType: true, caption: true,");
  return s;
 }
 if(type==="types"){
  const begin="export interface ExperienceMedia";
  const end="export interface ExperienceLocation";
  if(num(s,begin)!==1 || num(s,end)!==1)throw new Error("EXPERIENCE_MEDIA_INTERFACE_MISSING");
  const start=s.indexOf(begin),finish=s.indexOf(end);
  if(finish<=start)throw new Error("EXPERIENCE_MEDIA_INTERFACE_ORDER_INVALID");
  const before=s.slice(0,start),segment=s.slice(start,finish),after=s.slice(finish);
  if(segment.includes("caption?:"))throw new Error("EXPERIENCE_MEDIA_CAPTION_ALREADY_DEFINED");
  if(num(segment,"mimeType?: string;")!==1)throw new Error("EXPERIENCE_MEDIA_MIME_TYPE_NOT_UNIQUE");
  return before+segment.replace("mimeType?: string;","mimeType?: string; caption?: string;")+after;
 }
 if(type==="lightbox"){
  if(s.includes('data-testid="c829-license-attribution"'))throw new Error("LIGHTBOX_ALREADY_PATCHED");
  const old='        <figcaption className="text-sm font-bold text-white/75">{index + 1} / {gallery.length}</figcaption>';
  const lines=[
   '        <figcaption className="text-center text-sm text-white/75">',
   '          <span className="block font-bold">{index + 1} / {gallery.length}</span>',
   '          {typeof currentMedia !== "string" && currentMedia.caption?.includes("CC BY-SA 4.0") && currentMedia.caption?.includes("Danu Widjajanto") && (',
   '            <span data-testid="c829-license-attribution" className="mt-2 block max-w-[80vw] text-xs font-medium leading-relaxed text-white/85">',
   '              Foto: Danu Widjajanto ·{" "}',
   '              <a href={currentMedia.caption?.split(" · ").find(part => part.startsWith("https://commons.wikimedia.org/wiki/"))}' ,
   '                 target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">Fuente original</a>',
   '              {" · "}',
   '              <a href="https://creativecommons.org/licenses/by-sa/4.0/"',
   '                 target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">CC BY-SA 4.0</a>',
   '              {" · Versión reducida a 1600 px"}',
   '            </span>',
   '          )}',
   '        </figcaption>'
  ];
  s=exactly(s,'  const previous = () => onIndexChange((index - 1 + gallery.length) % gallery.length);','  const currentMedia = gallery[index];\n  const previous = () => onIndexChange((index - 1 + gallery.length) % gallery.length);');
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
