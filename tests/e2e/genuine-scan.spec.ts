import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { localEnv } from "./env";
import { dismissActionPopup } from "./popups";
import { existsSync } from "node:fs";
const fixture=process.env.REAL_SCAN_FIXTURE;
test("the real scanned DAA PDF auto-fills visible details and keeps college/branch unselected",async({page})=>{
 test.skip(!fixture || !existsSync(fixture),"Set REAL_SCAN_FIXTURE to a local four-page DAA test PDF; the user's document is not bundled.");
 await page.goto("/login");await page.waitForLoadState("networkidle");await page.locator("#email").fill("student@papervault.dev");await page.locator("#password").fill("papervault123");await page.getByRole("button",{name:/^sign in$/i}).click();await expect(page).toHaveURL(/\/$/);
 await page.goto("/upload");await page.waitForLoadState("networkidle");await page.locator("#file").setInputFiles(fixture!);
 await expect(page.getByTestId("paper-detection")).toBeVisible({timeout:100000});await expect(page.getByTestId("automatic-catalogue")).toBeVisible();
 await expect(page.locator("#detected-subjectCode")).toHaveValue("BCS503");await expect(page.locator("#detected-subjectName")).toHaveValue("DESIGN AND ANALYSIS OF ALGORITHM");await expect(page.locator("#detected-semesterNumber")).toHaveValue("5");await expect(page.locator("#detected-programName")).toHaveValue("B.Tech");await expect(page.locator("#sessionLabel")).toHaveValue("2025-26");await expect(page.locator("#academicYear")).toHaveValue("2025");await expect(page.locator("#examTypeId")).toHaveValue("END_SEM");
 await expect(page.locator("#detected-collegeName")).toHaveValue("");await expect(page.locator("#detected-branchName")).toHaveValue("");await expect(page.locator("#examClassification")).toHaveValue("");await expect(page.getByTestId("paper-detection")).toContainText("file name");
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:test.info().outputPath("real-daa-detected.png"),fullPage:true});
});

const stFixture=process.env.REAL_ST_SCAN_FIXTURE;
test("the actual ST-1 table detects metadata, submits a new code version and refuses duplicates",async({page})=>{
 test.skip(!stFixture || !existsSync(stFixture),"Set REAL_ST_SCAN_FIXTURE to the local ST-1 scan; user documents are not bundled.");
 const db=new PrismaClient({datasources:{db:{url:localEnv().DATABASE_URL}}});let paperId:string|undefined;let newSubjectId:string|undefined;
 const original=await db.subject.findFirstOrThrow({where:{code:"KCS503",semester:{number:5,branch:{code:"CSE",program:{college:{shortName:"RKGIT"}}}}},select:{id:true,code:true,name:true}});
 try {
 await page.goto("/login");await page.waitForLoadState("networkidle");await page.locator("#email").fill("student@papervault.dev");await page.locator("#password").fill("papervault123");await page.getByRole("button",{name:/^sign in$/i}).click();await expect(page).toHaveURL(/\/$/);
 await page.goto("/upload");await page.waitForLoadState("networkidle");await page.locator("#file").setInputFiles(stFixture!);
 await expect(page.getByTestId("paper-detection")).toBeVisible({timeout:100000});await expect(page.getByTestId("automatic-catalogue")).toBeVisible();await expect(page.locator("#detected-collegeName")).toHaveValue("Raj Kumar Goel Institute of Technology, Ghaziabad");await expect(page.locator("#detected-subjectCode")).toHaveValue("BCS503");await expect(page.locator("#detected-subjectName")).toHaveValue("Design and Analysis of Algorithms");await expect(page.locator("#detected-semesterNumber")).toHaveValue("5");await expect(page.locator("#sessionLabel")).toHaveValue("ST-1 · 2025-26");await expect(page.locator("#examTypeId")).toHaveValue("ST");await expect(page.locator("#detected-branchCode")).toHaveValue("");
 await page.locator("#detected-branchName").fill("CSE");await expect(page.locator("#detected-branchCode")).toHaveValue("CSE");await page.getByLabel("I checked these details against the paper.").check();await page.locator("#examClassification").selectOption("PAST");await page.getByRole("button",{name:/submit paper/i}).click();await expect(page.getByTestId("success-popup")).toBeVisible({timeout:60000});
 const href=await page.getByTestId("success-popup").getByRole("link",{name:/view your upload/i}).getAttribute("href");paperId=href!.split("/").at(-1)!;await dismissActionPopup(page);
 const paper=await db.paper.findUniqueOrThrow({where:{id:paperId},include:{paperSet:{include:{examSession:{include:{subject:true}}}}}});expect(paper.status).toBe("PENDING_REVIEW");expect(paper.paperSet.examSession.subject.code).toBe("BCS503");newSubjectId=paper.paperSet.examSession.subject.id;expect(newSubjectId).not.toBe(original.id);expect(await db.subject.findUnique({where:{id:original.id},select:{id:true,code:true,name:true}})).toEqual(original);
 await page.getByRole("button",{name:/submit paper/i}).click();await expect(page.getByTestId("error-popup")).toContainText(/already in the archive/i);await dismissActionPopup(page);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:test.info().outputPath("real-st1-detected.png"),fullPage:true});
 }finally{if(paperId)await db.paper.delete({where:{id:paperId}}).catch(()=>undefined);if(newSubjectId)await db.subject.delete({where:{id:newSubjectId}}).catch(()=>undefined);await db.$disconnect();}
});
