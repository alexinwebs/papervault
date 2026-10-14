import { existsSync } from "node:fs";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { prepareScanHeaders } from "@/server/services/scan-preparation";
import { parsePaperHeader } from "@/lib/paper-detection";
import { it, expect, afterAll } from "vitest";
import { PDFDocument, degrees, StandardFonts } from "pdf-lib";
import { detectPaper } from "@/server/services/paper-detection";
import { readPaperText } from "@/server/services/paper-text";
import { contentFingerprint } from "@/server/services/papers";
import { prismaRaw } from "@/lib/db";
const fixture = process.env.REAL_SCAN_FIXTURE;
it.skipIf(!fixture || !existsSync(fixture))("reads the genuine four-page bilingual DAA scan without inventing a college", async () => {
 const bytes=await readFile(fixture!);const result=await detectPaper(bytes,"application/pdf",{filename:"DAAsem5END.pdf"});
 expect(result.method).toBe("ocr");expect(result.fields).toMatchObject({subjectName:"DESIGN AND ANALYSIS OF ALGORITHM",subjectCode:"BCS503",programName:"B.Tech",semesterNumber:5,sessionLabel:"2025-26",academicYear:2025,examCode:"END_SEM"});
 expect(result.fields.collegeName).toBeUndefined();expect(result.fields.branchCode).toBeUndefined();expect(result.match).toBeUndefined();expect(result.warnings.join(" ")).toContain("file name");
 const archival=await readPaperText(bytes,"application/pdf","submit");expect(archival.complete).toBe(true);expect(contentFingerprint(archival.text)).toBeTruthy();
});
const stFixture=process.env.REAL_ST_SCAN_FIXTURE;
it.skipIf(!stFixture || !existsSync(stFixture))("reads the genuine ST-1 table and preserves the printed new code",async()=>{
 const result=await detectPaper(await readFile(stFixture!),"application/pdf",{filename:"DAAsem5ST1.pdf"});
 expect(result.method).toBe("ocr");expect(result.fields).toMatchObject({collegeName:"Raj Kumar Goel Institute of Technology, Ghaziabad",subjectName:"Design and Analysis of Algorithms",subjectCode:"BCS503",semesterNumber:5,programName:"B.Tech",examCode:"ST",sessionLabel:"ST-1 · 2025-26",academicYear:2025});
 expect(result.fields.branchCode).toBeUndefined();expect(result.fields.branchName).toBeUndefined();expect(result.fields.branchCodes!.length).toBeGreaterThan(1);expect(result.match).toBeUndefined();expect(result.warnings.join(" ")).toContain("primary branch");
});
it.skipIf(!stFixture || !existsSync(stFixture))("reads a rotated genuine scan using orientation-aware OCR", async () => {
 const document=await PDFDocument.load(await readFile(stFixture!)); document.getPages()[0].setRotation(degrees(90));
 const result=await detectPaper(Buffer.from(await document.save()),"application/pdf");
 expect(result.fields).toMatchObject({collegeName:"Raj Kumar Goel Institute of Technology, Ghaziabad",subjectCode:"BCS503",semesterNumber:5,programName:"B.Tech",academicYear:2025,examCode:"ST"});
 expect(result.fields.branchCode).toBeUndefined();
});
it.skipIf(!stFixture || !existsSync(stFixture))("does not mistake a native footer for a readable scanned header", async () => {
 const document=await PDFDocument.load(await readFile(stFixture!)); const font=await document.embedFont(StandardFonts.Helvetica);
 document.getPages()[0].drawText("PaperVault scan test: this selectable footer does not contain the examination header details.",{x:25,y:15,size:7,font});
 const result=await detectPaper(Buffer.from(await document.save()),"application/pdf");
 expect(result.method).toBe("ocr"); expect(result.fields).toMatchObject({collegeName:"Raj Kumar Goel Institute of Technology, Ghaziabad",subjectCode:"BCS503",semesterNumber:5,programName:"B.Tech",examCode:"ST"});
});
it.skipIf(!stFixture || !existsSync(stFixture))("a long native watermark does not mask the scanned header", async()=>{
 const document=await PDFDocument.load(await readFile(stFixture!));const font=await document.embedFont(StandardFonts.Helvetica);
 for(let i=0;i<8;i++)document.getPages()[0].drawText("Selectable archive watermark without any header metadata; keep reading the original scan.",{x:20,y:15+i*7,size:5,font});
 const result=await detectPaper(Buffer.from(await document.save()),"application/pdf");expect(result.method).toBe("ocr");expect(result.fields).toMatchObject({subjectCode:"BCS503",semesterNumber:5,examCode:"ST"});
});
it.skipIf(!stFixture || !existsSync(stFixture))("prepares the actual tilted ST scan locally without modifying the input", async()=>{
 const dir=await mkdtemp(join(tmpdir(),"pv-tilt-test-"));try{
  execFileSync("pdftoppm",["-singlefile","-scale-to","2400","-png",stFixture!,join(dir,"original")]);
  const original=await readFile(join(dir,"original.png"));const tilted=await sharp(original).rotate(3,{background:"white"}).png().toBuffer();const path=join(dir,"tilted.png");await writeFile(path,tilted);
  const prepared=await prepareScanHeaders(path,dir);expect(prepared.adjusted).toBe(true);expect(await readFile(path)).toEqual(tilted);
  const readings=prepared.images.map((image)=>parsePaperHeader(execFileSync("tesseract",[image,"stdout","-l","eng","--psm","12"],{env:{...process.env,OMP_THREAD_LIMIT:"1"},timeout:15000}).toString()));
  expect(readings.some((f)=>f.subjectCode==="BCS503"&&f.semesterNumber===5)).toBe(true);
  const detected=await detectPaper(tilted,"image/png");
  expect(detected.fields).toMatchObject({subjectCode:"BCS503",semesterNumber:5,examCode:"ST"});
 }finally{await rm(dir,{recursive:true,force:true});}
},120000);
afterAll(async()=>{await prismaRaw.$disconnect();});
