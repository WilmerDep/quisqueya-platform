/**
 * C8.29-B: read-only local inventory reconciliation for Altos de Chavón variants.
 * Finds existing Google Drive media assets potentially reusable in local DRAFT variants.
 * Candidate discovery is NOT editorial approval or an instruction to associate assets.
 */
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

dotenv.config({ path: ".env", quiet: true });
const host = String(process.env.MYSQL_HOST || "127.0.0.1").trim().toLowerCase();
if (!["127.0.0.1", "localhost", "::1"].includes(host) ||
    String(process.env.STORAGE_PROVIDER || "").trim() !== "google-drive") {
  console.log("C8_29_B=BLOCKED_NONLOCAL_OR_NONDRIVE_CONFIGURATION");
  process.exit(1);
}
const db = new PrismaClient({ adapter: new PrismaMariaDb({
  host,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "quisqueya_core",
  connectionLimit: 2
}) });
const slugs = ["altos-de-chavon", "altos-de-chavon-medio-dia",
  "altos-de-chavon-cueva-de-las-maravillas",
  "santo-domingo-city-tour-altos-de-chavon",
  "aventura-en-buggies-y-altos-de-chavon"];
const toIds=x=>Array.isArray(x)?x.filter(v=>typeof v==="string"):[];
const output=(name,x)=>console.log(name+"="+JSON.stringify(x));
try {
  const exp=await db.experience.findMany({where:{slug:{in:slugs}},
    select:{slug:true,status:true,featuredMediaId:true,galleryMediaIds:true}});
  const bySlug=new Map(exp.map(x=>[x.slug,x]));
  const parent=bySlug.get("altos-de-chavon");
  if (!parent || parent.status!=="DRAFT" || toIds(parent.galleryMediaIds).length!==3) {
    console.log("C8_29_B=BLOCKED_PARENT_BASELINE_CHANGED");
    process.exitCode=2;
  } else {
    const candidates=await db.mediaAsset.findMany({
      where:{
        storageProvider:"google-drive",
        OR:[
          {fileName:{contains:"altos"}},
          {fileName:{contains:"chavon"}},
          {fileName:{contains:"maravillas"}},
          {fileName:{contains:"cueva"}},
          {fileName:{contains:"buggies"}}
        ]
      },
      select:{id:true,fileName:true,storageKey:true,storageProvider:true,mimeType:true,
        publicUrl:true,altText:true},
      take:250
    });
    const approvedBaseIds=[parent.featuredMediaId,...toIds(parent.galleryMediaIds)].filter(Boolean);
    const byId=new Map(candidates.map(x=>[x.id,x]));
    const missingBase=approvedBaseIds.filter(id=>!byId.has(id));
    output("C8_29_B_BASELINE",{
      parentStatus:parent.status,
      parentFeaturedMediaId:parent.featuredMediaId,
      parentGalleryCount:toIds(parent.galleryMediaIds).length,
      missingMediaInKeywordSearch:missingBase.length
    });
    const associated = new Map();
    for(const e of exp)for(const id of [e.featuredMediaId,...toIds(e.galleryMediaIds)].filter(Boolean)){
      associated.set(id,[...(associated.get(id)||[]),e.slug]);
    }
    output("C8_29_B_DRIVE_CANDIDATES",candidates.map(c=>({
      mediaId:c.id,
      fileName:c.fileName,
      storageKey:c.storageKey,
      mimeType:c.mimeType,
      alreadyUsedBy:associated.get(c.id)||[],
      onAltosParent:approvedBaseIds.includes(c.id),
      altTextPresent:Boolean(c.altText),
      urlKind:(()=>{try{let u=new URL(c.publicUrl);return ["localhost","127.0.0.1"].includes(u.hostname)?"LOCAL_API":u.protocol==="https:"?"HTTPS":"OTHER"}catch{return "INVALID"}})()
    })));
    for(const slug of slugs.filter(s=>s!=="altos-de-chavon")){
      const e=bySlug.get(slug);
      output("C8_29_B_VARIANT",{
        slug,
        exists:Boolean(e),
        status:e?.status||null,
        featuredMediaId:e?.featuredMediaId||null,
        managedGalleryCount:toIds(e?.galleryMediaIds).length,
        recommendedAction:slug==="altos-de-chavon-medio-dia"?
          "REVIEW_EXISTING_ALTOS_IMAGES_FOR_REUSE":slug==="altos-de-chavon-cueva-de-las-maravillas"?
          "REVIEW_ALTOS_AND_REQUIRE_CAVE_SPECIFIC_PHOTOS":
          "PRESERVE_EXISTING_ASSOCIATIONS"
      });
    }
    output("C8_29_B_SUMMARY",{
      driveCandidates:candidates.length,
      baseReferenced:approvedBaseIds.length,
      missingBaseFromKeywordResults:missingBase.length,
      next:"EDITORIAL_REVIEW_ONLY_NO_AUTOMATIC_ASSOCIATION"
    });
    console.log("C8_29_B=READ_ONLY_COMPLETED");
  }
}catch(e){
  console.log("C8_29_B=FAILED");
  console.log("ERROR_CODE="+String(e?.code||e?.name||"UNKNOWN"));
  process.exitCode=1;
}finally{
  await db.$disconnect();
  console.log("MYSQL=NOT_MODIFIED");
  console.log("DRIVE=NOT_MODIFIED");
  console.log("STAGING=NOT_MODIFIED");
  console.log("PRODUCTION=NOT_MODIFIED");
}
