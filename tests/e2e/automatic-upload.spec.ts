import { test, expect, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { PrismaClient } from "@prisma/client";
import { localEnv } from "./env";
import { dismissActionPopup } from "./popups";
const db=new PrismaClient({datasources:{db:{url:localEnv().DATABASE_URL}}});
async function signIn(page:Page) {await page.goto("/login");await page.waitForLoadState("networkidle");await page.locator("#email").fill("student@papervault.dev");await page.locator("#password").fill("papervault123");await page.getByRole("button",{name:/^sign in$/i}).click();await expect(page).toHaveURL(/\/$/);}
async function paper(college:string,marker:string) {const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);const p=pdf.addPage();[ `College: ${college}`,"B.Tech CSE","Semester: V","Subject: Automated Systems","Subject Code: AUTO501","END-SEM 2024","Q1. Describe automatic classification, metadata extraction and archive grouping.",`Explain database transactions and advisory locks for duplicate prevention ${marker}.`,"Discuss indexing, validation, security, moderation and rollback after rejected input."].forEach((line,i)=>p.drawText(line,{x:30,y:780-28*i,size:11,font}));return Buffer.from(await pdf.save());}
for(const width of [1280,390]) test(`file-first auto grouping and duplicate error at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await signIn(page);await page.goto("/upload");await page.waitForLoadState("networkidle");
 const marker=`${Date.now()}-${width}`;const name=`Browser ${marker} Engineering College`;const bytes=await paper(name,marker);
 try {
 await page.locator("#file").setInputFiles({name:"detected.pdf",mimeType:"application/pdf",buffer:bytes});
 await expect(page.getByTestId("automatic-catalogue")).toBeVisible({timeout:45000});await expect(page.getByTestId("loading-popup")).toHaveCount(0);
 await expect(page.locator("#detected-collegeName")).toHaveValue(name);await expect(page.locator("#detected-subjectCode")).toHaveValue("AUTO501");await expect(page.locator("#detected-semesterNumber")).toHaveValue("5");await expect(page.locator("#academicYear")).toHaveValue("2024");
 // User can correct OCR without asking staff to add the catalogue.
 await page.locator("#detected-subjectName").fill("Automated Systems and Archives");await page.getByLabel("I checked these details against the paper.").check();await page.locator("#examClassification").selectOption("PAST");
 await page.getByRole("button",{name:/submit paper/i}).click();await expect(page.getByTestId("success-popup")).toBeVisible();await expect(page.getByTestId("success-popup")).toContainText("queued for moderator review");await dismissActionPopup(page);
 const college=await db.college.findFirstOrThrow({where:{name},include:{programs:{include:{branches:{include:{semesters:{include:{subjects:true}}}}}}}});expect(college.verified).toBe(false);expect(college.programs[0].branches[0].semesters[0].subjects[0].name).toBe("Automated Systems and Archives");
 // Same chosen file remains after submission; duplicate must use proper modal.
 await page.getByRole("button",{name:/submit paper/i}).click();await expect(page.getByTestId("error-popup")).toBeVisible();await expect(page.getByTestId("error-popup")).toContainText(/already in the archive/i);await dismissActionPopup(page);await expect(page.locator("#detected-collegeName")).toHaveValue(name);
 }finally{await db.paper.deleteMany({where:{paperSet:{examSession:{subject:{semester:{branch:{program:{college:{name}}}}}}}}});await db.college.deleteMany({where:{name}});}
});
test("known header selects existing hierarchy without creating groups",async({page})=>{await signIn(page);await page.goto("/upload");await page.waitForLoadState("networkidle");const pdf=await PDFDocument.create();const f=await pdf.embedFont(StandardFonts.Helvetica);const p=pdf.addPage();["RKGIT B.Tech CSE","Semester 5","Subject Code: KCS501","ST 2024","Q1. Define normalization."].forEach((l,i)=>p.drawText(l,{x:30,y:780-28*i,font:f,size:14}));await page.locator("#file").setInputFiles({name:"known.pdf",mimeType:"application/pdf",buffer:Buffer.from(await pdf.save())});await expect(page.getByTestId("paper-detection")).toContainText("Matched an existing college and subject",{timeout:45000});await expect(page.locator("#collegeId option:checked")).toContainText("Raj Kumar Goel");await expect(page.locator("#subjectId option:checked")).toContainText("Database Management Systems");await expect(page.locator("#semesterId option:checked")).toContainText("Semester 5");await expect(page.getByTestId("automatic-catalogue")).toHaveCount(0);});
test("a standalone known subject title is enough without a printed code",async({page})=>{
 await signIn(page);await page.goto("/upload");await page.waitForLoadState("networkidle");const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const sheet=doc.addPage();
 ["RKGIT B.Tech CSE","Semester 5","Database Management Systems","ST 2024","Q1. Describe transactions."].forEach((l,i)=>sheet.drawText(l,{x:30,y:780-i*30,font,size:14}));
 await page.locator("#file").setInputFiles({name:"heading.pdf",mimeType:"application/pdf",buffer:Buffer.from(await doc.save())});await expect(page.getByTestId("paper-detection")).toContainText("Matched an existing college and subject",{timeout:45000});await expect(page.locator("#subjectId option:checked")).toContainText("Database Management Systems");
});
test.afterAll(async()=>{await db.$disconnect();});
