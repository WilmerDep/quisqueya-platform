/**
 * C8.28-Q — controlled LOCAL gallery association, using existing authenticated NestJS PATCH API.
 * Default: dry run. Apply: --apply --confirm-local-gallery-write, with C828_MEDIA_BEARER_TOKEN.
 * - City Tour standalone: all 15 City Tour WebP.
 * - Combined City Tour + Altos: 3 already-associated Altos gallery images + all 15 City Tour WebP.
 * - Does NOT modify featured images, WordPress source references, statuses, pricing or Drive.
 * - Does NOT contact staging/production.
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

dotenv.config({ path: ".env", quiet: true });
const manifest = JSON.parse(readFileSync(new URL("../audits/c828-city-tour-media-manifest.json", import.meta.url), "utf8"));
const verification = JSON.parse(readFileSync(new URL("../audits/c828-city-tour-drive-verification.json", import.meta.url), "utf8"));

const slugStandalone = "santo-domingo-city-tour";
const slugCombined = "santo-domingo-city-tour-altos-de-chavon";
const slugAltos = "altos-de-chavon";
const apply = process.argv.includes("--apply");
const confirm = process.argv.includes("--confirm-local-gallery-write");
if (process.argv.slice(2).some(x => !["--apply", "--confirm-local-gallery-write"].includes(x)) || (!apply && confirm)) {
  console.error("C8_28_Q=BLOCKED_ARGUMENTS"); process.exit(1);
}
if (apply && !confirm) {console.error("C8_28_Q=BLOCKED_CONFIRMATION");process.exit(1);}
const api = (() => {try {return new URL(String(process.env.APP_URL||"").trim());}catch{return null;}})();
const dbHost = String(process.env.MYSQL_HOST || "127.0.0.1").trim().toLowerCase();
const validApi = api?.protocol === "http:" && ["127.0.0.1","localhost"].includes(api.hostname) &&
  api.pathname === "/" && !api.username && !api.password && !api.search && !api.hash;
if (!validApi || !["127.0.0.1","localhost","::1"].includes(dbHost) || process.env.STORAGE_PROVIDER?.trim() !== "google-drive") {
  console.error("C8_28_Q=BLOCKED_NONLOCAL_CONFIGURATION");process.exit(1);
}
if (manifest.cityTour.length !== 15 || new Set(manifest.cityTour.map(x => x.storageKey)).size !== 15 ||
    verification.assets.length !== 15 || verification.assets.some(x => !manifest.cityTour.some(y => y.storageKey === x.storageKey)) ||
    manifest.altos.length !== 4) {
  console.error("C8_28_Q=BLOCKED_MANIFEST");process.exit(1);
}

const prisma = new PrismaClient({ adapter:new PrismaMariaDb({
  host:dbHost, port:Number(process.env.MYSQL_PORT||3306), user:process.env.MYSQL_USER||"root",
  password:process.env.MYSQL_PASSWORD||"", database:process.env.MYSQL_DATABASE||"quisqueya_core",connectionLimit:2
})});
const strings = x => Array.isArray(x) ? x.filter(y => typeof y==="string") : [];
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const errorCode = e => String(e?.code || e?.name || "UNKNOWN");
const log = (name,payload) => console.log(name+"="+JSON.stringify(payload));

try {
  const [foundMedia, experiences] = await Promise.all([
    prisma.mediaAsset.findMany({where:{storageKey:{in:[...manifest.cityTour,...manifest.altos].map(x=>x.storageKey)}},
      select:{id:true,storageKey:true,storageProvider:true,fileName:true,mimeType:true}}),
    prisma.experience.findMany({where:{slug:{in:[slugStandalone,slugCombined,slugAltos]}},
      select:{id:true,slug:true,status:true,featuredMediaId:true,galleryMediaIds:true,galleryMediaSourceIds:true}})
  ]);
  const exp = new Map(experiences.map(x=>[x.slug,x]));
  const indexed = new Map();
  for (const m of foundMedia) indexed.set(m.storageKey,[...(indexed.get(m.storageKey)||[]),m]);
  const asset = key => {
    const rows = indexed.get(key)||[];
    if (rows.length !== 1 || rows[0].storageProvider !== "google-drive") return null;
    return rows[0];
  };
  const city = manifest.cityTour.map(x=>asset(x.storageKey));
  const altos = manifest.altos.filter(x=>x.label!=="altos-iglesia-portada").map(x=>asset(x.storageKey));
  const standaloneIds = city.map(x=>x?.id);
  const combinedIds = [...altos,...city].map(x=>x?.id);
  const target = [
    {slug:slugStandalone,row:exp.get(slugStandalone),ids:standaloneIds,status:"PUBLISHED",expectedFeatured:"wp-media-190",sourceCount:6},
    {slug:slugCombined,row:exp.get(slugCombined),ids:combinedIds,status:"DRAFT",expectedFeatured:"wp-media-286",sourceCount:3},
  ];
  const currentAltos = exp.get(slugAltos);
  const altIds = strings(currentAltos?.galleryMediaIds);
  const assetsCorrect = city.every((m,i)=>m && m.fileName===verification.assets.find(x=>x.storageKey===manifest.cityTour[i].storageKey)?.name && m.mimeType==="image/webp") &&
    altos.length===3 && altos.every(Boolean);
  const noDuplicates = target.every(t=>new Set(t.ids).size===t.ids.length && t.ids.every(Boolean));
  const statesCorrect = target.every(t=>t.row?.status===t.status && t.row?.featuredMediaId===t.expectedFeatured &&
    Array.isArray(t.row?.galleryMediaSourceIds) && t.row.galleryMediaSourceIds.length===t.sourceCount) &&
    currentAltos?.status==="DRAFT" && altIds.length===3 &&
    new Set(altIds).size===3 && altIds.every(id=>altos.some(x=>x.id===id));
  const galleriesReady = target.every(t=>{
    const current = strings(t.row?.galleryMediaIds);
    return current.length===0 || same(current,t.ids);
  });
  const guards={localOrigin:true,assetsCorrect,noDuplicates,statesCorrect,galleriesReady,countsCorrect:standaloneIds.length===15&&combinedIds.length===18};
  log("C8_28_Q_MODE",apply?"LOCAL_APPLY":"DRY_RUN");
  log("GUARDS",guards);
  for (const t of target) log("GALLERY_PLAN",{slug:t.slug,status:t.row?.status,currentCount:strings(t.row?.galleryMediaIds).length,
    targetCount:t.ids.length,featuredMediaId:t.row?.featuredMediaId,
    action:same(strings(t.row?.galleryMediaIds),t.ids)?"ALREADY_LINKED":"LINK",
    galleryMediaIds:t.ids});
  if (!Object.values(guards).every(Boolean)) {log("C8_28_Q","BLOCKED_GUARDS");process.exitCode=2;}
  else if (!apply) log("C8_28_Q","DRY_RUN_APPROVED");
  else {
    const bearer=process.env.C828_MEDIA_BEARER_TOKEN?.trim();
    if(!bearer){log("C8_28_Q","BLOCKED_AUTH_MISSING");process.exitCode=1;}
    else{
      const check=await fetch(new URL("/api/v1/auth/me",api),{headers:{Authorization:"Bearer "+bearer},redirect:"error",signal:AbortSignal.timeout(10000)});
      const auth=check.ok?await check.json().catch(()=>null):null;
      if(!["Super Admin","Administrador","Supervisor"].includes(auth?.data?.role)){
        log("C8_28_Q","BLOCKED_ROLE");process.exitCode=1;
      }else{
        for(const t of target){
          const live=await prisma.experience.findUnique({where:{id:t.row.id},select:{status:true,featuredMediaId:true,galleryMediaIds:true,galleryMediaSourceIds:true}});
          if(live?.status!==t.status || live?.featuredMediaId!==t.expectedFeatured ||
            !same(strings(live?.galleryMediaIds),strings(t.row.galleryMediaIds)) ||
            !same(live?.galleryMediaSourceIds,t.row.galleryMediaSourceIds)){
            log("C8_28_Q","STOPPED_CONCURRENT_CHANGE");process.exitCode=2;break;
          }
          if(same(strings(live.galleryMediaIds),t.ids)){
            log("PATCH_RESULT",{slug:t.slug,action:"ALREADY_LINKED",ok:true});
            continue;
          }
          const endpoint=new URL("/api/v1/media/experiences/"+encodeURIComponent(t.row.id),api);
          const res=await fetch(endpoint,{method:"PATCH",headers:{Authorization:"Bearer "+bearer,"Content-Type":"application/json"},
            body:JSON.stringify({galleryMediaIds:t.ids}),redirect:"error",signal:AbortSignal.timeout(15000)});
          if(!res.ok){log("PATCH_RESULT",{slug:t.slug,ok:false,httpStatus:res.status});log("C8_28_Q","STOPPED_PARTIAL_WRITE_POSSIBLE");process.exitCode=2;break;}
          const returned=await res.json().catch(()=>null);
          if(!same(strings(returned?.data?.galleryMediaIds),t.ids)){
            log("C8_28_Q","STOPPED_RESPONSE_MISMATCH");process.exitCode=2;break;
          }
          log("PATCH_RESULT",{slug:t.slug,ok:true,count:t.ids.length});
        }
        if(!process.exitCode){
          const rows=await prisma.experience.findMany({where:{id:{in:target.map(t=>t.row.id)}},
            select:{id:true,slug:true,status:true,featuredMediaId:true,galleryMediaIds:true,galleryMediaSourceIds:true}});
          const ok=target.every(t=>{
            const r=rows.find(x=>x.id===t.row.id);
            return r?.status===t.status && r.featuredMediaId===t.expectedFeatured &&
              same(strings(r.galleryMediaIds),t.ids) && same(r.galleryMediaSourceIds,t.row.galleryMediaSourceIds);
          });
          log("C8_28_Q",ok?"LOCAL_GALLERIES_LINKED":"POST_WRITE_REVIEW_REQUIRED");
          if(!ok)process.exitCode=2;
        }
      }
    }
  }
}catch(e){log("C8_28_Q","FAILED");log("ERROR_CODE",errorCode(e));process.exitCode=1;}
finally{
  await prisma.$disconnect();
  console.log("DRIVE=NOT_MODIFIED");
  console.log("FEATURED_IMAGES=NOT_MODIFIED");
  console.log("STAGING=NOT_MODIFIED");
  console.log("PRODUCTION=NOT_MODIFIED");
}
