import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prismaRaw } from "@/lib/db";
import { submitPaper } from "@/server/services/uploads";
import { detectPaper } from "@/server/services/paper-detection";
import { catalogueDraftSchema } from "@/server/services/automatic-catalogue";
import { readPaperText } from "@/server/services/paper-text";
import { imagesToPdf } from "@/lib/pdf";
import { makeUser, tag } from "./helpers";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SessionUser } from "@/lib/auth";
const t = tag(); let user: SessionUser; let original: Buffer;
const draft = { collegeName:`Automatic ${t} Engineering College`, programName:"B.Tech" as const, branchName:"Computer Science & Engineering", branchCode:"CSE", semesterNumber:5, subjectName:"Database Management Systems", subjectCode:"BCS501", examCode:"END_SEM" as const };
const meta = (overrides={}) => ({collegeId:"AUTO",programId:"AUTO",branchId:"AUTO",semesterId:"AUTO",subjectId:"AUTO",examTypeId:"AUTO",academicYear:2024,setLabel:"Set A",examClassification:"PAST" as const,autoCatalogue:draft,...overrides});
async function pdf(variant="", shift=0) { const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica); const p=doc.addPage([595,842]);
 const lines=[`College: ${draft.collegeName}`,"B.Tech CSE","Semester: V",`Subject: ${draft.subjectName}`,"Subject Code: BCS501","END-SEM 2024","Q1. Explain normalization and relational algebra in database management.","Describe primary and foreign keys. Discuss transaction isolation and consistency.","Give examples of joins, indexing, constraints, recovery and query optimization.",variant];
 lines.forEach((line,i)=>p.drawText(line,{x:30+shift,y:795-i*29,size:14,font}));return Buffer.from(await doc.save()); }
const upload=(bytes:Buffer,metadata=meta())=>submitPaper({user,metadata,file:{name:"paper.pdf",type:"application/pdf",bytes}});
beforeAll(async()=>{user=await makeUser("auto",t);original=await pdf();});
afterAll(async()=>{await prismaRaw.paper.deleteMany({where:{uploadedById:user.id}});await prismaRaw.college.deleteMany({where:{name:{contains:t}}});await prismaRaw.user.delete({where:{id:user.id}});await prismaRaw.$disconnect();});
describe("automatic grouping, extraction and existing duplicate protection",()=>{
 it("detects a new group without writing anything",async()=>{const result=await detectPaper(original,"application/pdf"); expect(result.fields).toMatchObject(draft);expect(result.match).toBeUndefined();expect(await prismaRaw.college.count({where:{name:draft.collegeName}})).toBe(0);});
 it("creates the entire chain, unverified and pending review",async()=>{const p=await upload(original);const college=await prismaRaw.college.findFirstOrThrow({where:{name:draft.collegeName},include:{programs:{include:{branches:{include:{semesters:{include:{subjects:true}}}}}}}});expect(college.verified).toBe(false);expect(college.programs[0].branches[0].semesters[0].subjects[0].code).toBe("BCS501");expect((await prismaRaw.paper.findUniqueOrThrow({where:{id:p.paperId}})).status).toBe("PENDING_REVIEW");});
 it("reuses the existing group during detection",async()=>{const result=await detectPaper(original,"application/pdf");expect(result.match?.subjectId).toBeTruthy();});
 it("matches an unlabelled existing subject heading even without its code",async()=>{
   const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const page=doc.addPage();
   [`College: ${draft.collegeName}`,"B.Tech CSE","Semester V","Database Management Systems","END-SEM 2024","Q1. Describe joins."].forEach((line,i)=>page.drawText(line,{x:30,y:780-i*30,font,size:14}));
   const result=await detectPaper(Buffer.from(await doc.save()),"application/pdf");expect(result.match?.subjectId).toBeTruthy();expect(result.fields.subjectCode).toBe("BCS501");
 });
 it("rejects the identical file and rolls back a different new college",async()=>{await expect(upload(original,meta({autoCatalogue:{...draft,collegeName:`Rejected ${t} College`}}))).rejects.toMatchObject({code:"CONFLICT"});expect(await prismaRaw.college.count({where:{name:`Rejected ${t} College`}})).toBe(0);});
 it("rejects a re-exported text duplicate even in a different slot",async()=>{const reexport=await pdf("",3);await expect(upload(reexport,meta({setLabel:"Set B"}))).rejects.toMatchObject({code:"CONFLICT"});});
 it("rejects a different document for the occupied exam slot",async()=>{await expect(upload(await pdf("Different question about database schema design and distributed systems."))).rejects.toMatchObject({code:"CONFLICT"});});
 it("refuses current exams before creating a group",async()=>{await expect(upload(original,meta({examClassification:"CURRENT",autoCatalogue:{...draft,collegeName:`Current ${t} College`}}))).rejects.toMatchObject({code:"VALIDATION_ERROR"});expect(await prismaRaw.college.count({where:{name:`Current ${t} College`}})).toBe(0);});
 it("OCR reads photographed headers and camera PDFs locally",async()=>{const dir=await mkdtemp(join(tmpdir(),"pv-test-"));try {const path=join(dir,"paper.pdf");await writeFile(path,original);execFileSync("pdftoppm",["-singlefile","-scale-to","1800","-png",path,join(dir,"scan")]);const png=await readFile(join(dir,"scan.png"));const result=await detectPaper(png,"image/png");expect(result.method).toBe("ocr");expect(result.fields.subjectCode).toBe("BCS501");expect(result.fields.semesterNumber).toBe(5);const camera=await imagesToPdf([{bytes:png,mimeType:"image/png"}]);const reading=await readPaperText(camera,"application/pdf","submit");expect(reading.method).toBe("ocr");expect(reading.complete).toBe(true);expect(reading.text).toContain("Database Management Systems");}finally{await rm(dir,{recursive:true,force:true});}});
 it("keeps a confirmed new curriculum code separate from the older code",async()=>{
  const newCode={...draft,subjectCode:"BCS599"};const result=await upload(await pdf("Unique questions for the revised curriculum code version."),meta({autoCatalogue:newCode,sessionLabel:"ST-1 · 2024-25"}));
  const subjects=await prismaRaw.subject.findMany({where:{name:draft.subjectName,semester:{branch:{program:{college:{name:draft.collegeName}}}}},select:{id:true,code:true,slug:true}});expect(subjects.map(s=>s.code).sort()).toEqual(["BCS501","BCS599"]);expect(new Set(subjects.map(s=>s.slug)).size).toBe(2);expect((await prismaRaw.paper.findUniqueOrThrow({where:{id:result.paperId}})).status).toBe("PENDING_REVIEW");
 });
 it("accepts different numbered tests but still refuses a duplicate document",async()=>{
  const revised={...draft,subjectCode:"BCS599"};const paper=await pdf("Unique second sessional questions for test two and the revised curriculum.");await upload(paper,meta({autoCatalogue:revised,sessionLabel:"ST-2 · 2024-25"}));await expect(upload(paper,meta({autoCatalogue:revised,sessionLabel:"ST-3 · 2024-25"}))).rejects.toMatchObject({code:"CONFLICT"});
 });
 it("manual branch entry can omit its code and reuse a longer known catalogue label", async()=>{
  const named={...draft,collegeName:`ManualAlias ${t} College`,branchName:"Computer Science (Internet of Things)",branchCode:"IOT"};
  await upload(await pdf("Unique manual IoT questions for the first paper."),meta({autoCatalogue:named,sessionLabel:"First"}));
  const simplified=catalogueDraftSchema.parse({...named,branchName:"Internet of Things",branchCode:undefined});
  await upload(await pdf("Unique manual IoT questions for the second paper."),meta({autoCatalogue:simplified,sessionLabel:"Second"}));
  const branches=await prismaRaw.branch.findMany({where:{program:{college:{name:named.collegeName}}}});expect(branches).toHaveLength(1);expect(branches[0].name).toBe(named.branchName);
 });
 it("does not assign a new branch to an unrelated existing code",async()=>{
  await expect(upload(await pdf("Unique conflicting cyber security branch questions."),meta({autoCatalogue:{...draft,branchName:"Cyber Security Engineering"},sessionLabel:"Conflict"}))).rejects.toMatchObject({code:"VALIDATION_ERROR"});
 });
 it("catalogue conflicts do not overwrite a different printed subject name or semester",async()=>{
  const other=await PDFDocument.create();const font=await other.embedFont(StandardFonts.Helvetica);const page=other.addPage();
  [`College: ${draft.collegeName}`,"B.Tech CSE","Semester: V","Subject: Completely Different Subject","Subject Code: BCS501","END-SEM 2024","Q1. Explain an unrelated subject."].forEach((line,i)=>page.drawText(line,{x:30,y:780-i*28,size:12,font}));
  const result=await detectPaper(Buffer.from(await other.save()),"application/pdf");expect(result.match).toBeUndefined();expect(result.fields.subjectName).toBe("Completely Different Subject");expect(result.uncertainFields).toContain("subjectName");
 });
 it("concurrent reads reuse one versioned extraction result",async()=>{
  const bytes=await pdf("Unique concurrent extraction cache fixture.");const [a,b]=await Promise.all([readPaperText(bytes,"application/pdf"),readPaperText(bytes,"application/pdf")]);expect(a).toBe(b);expect(a.method).toBe("text");
 });
 it("concurrent automatic uploads create only one group and paper",async()=>{const newDraft={...draft,collegeName:`Concurrent ${t} College`,subjectCode:"NEW501",subjectName:"Advanced Algorithms"};const bytes=await pdf(`Unique concurrent algorithms and structures ${t}`);const results=await Promise.allSettled([1,2,3].map(()=>upload(bytes,meta({autoCatalogue:newDraft}))));expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected" && r.reason.code==="CONFLICT")).toHaveLength(2);expect(await prismaRaw.college.count({where:{name:newDraft.collegeName}})).toBe(1);});
 it("shared exact-code catalogue entries fill missing semester and programme, not a branch",async()=>{
  const program=await prismaRaw.program.findFirstOrThrow({where:{college:{name:draft.collegeName}}});
  const branch=await prismaRaw.branch.create({data:{programId:program.id,name:"Information Technology",code:"IT",slug:"it",semesters:{create:{number:5,subjects:{create:{name:draft.subjectName,code:draft.subjectCode,slug:"dbms"}}}}}});
  try{const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const page=doc.addPage();[`College: ${draft.collegeName}`,`Subject: ${draft.subjectName}`,`Subject Code: ${draft.subjectCode}`,"ST-1 2025-2026"].forEach((line,i)=>page.drawText(line,{x:20,y:760-i*25,font,size:12}));
   const result=await detectPaper(Buffer.from(await doc.save()),"application/pdf");expect(result.fields).toMatchObject({semesterNumber:5,programName:"B.Tech",academicYear:2025});expect(result.fields.branchCode).toBeUndefined();expect(result.match).toBeUndefined();expect(result.uncertainFields).toEqual(expect.arrayContaining(["semesterNumber","programName"]));
  }finally{await prismaRaw.branch.delete({where:{id:branch.id}});}
 });
 it("damaged PDFs fall back to manual entry without an OCR crash",async()=>{const result=await detectPaper(Buffer.from("%PDF-1.4 damaged"),"application/pdf");expect(result.method).toBe("none");expect(result.warnings.join(" ")).toContain("damaged");});

});
