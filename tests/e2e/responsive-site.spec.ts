import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { localEnv } from "./env";
const db=new PrismaClient({datasources:{db:{url:localEnv().DATABASE_URL}}});
const campus="/colleges/raj-kumar-goel-institute-of-technology";
for(const width of [320,390,768,1024,1280,1440,1920,2560]) test(`core site fits ${width}px screens`,async({page})=>{
 test.setTimeout(180000);await page.setViewportSize({width,height:960});await page.goto("/login");await page.waitForLoadState("networkidle");await page.locator("#email").fill("student@papervault.dev");await page.locator("#password").fill("papervault123");await page.getByRole("button",{name:/^sign in$/i}).click();await expect(page).toHaveURL(/\/$/);
 const paper=await db.paper.findFirstOrThrow({where:{status:"PUBLISHED"},select:{id:true}});
 const routes=["/","/colleges",campus,`${campus}/btech/cse/semester-5/database-management-systems`,`/papers/${paper.id}`,"/upload","/library","/inbox","/settings","/support","/statistics"];
 for(const [index,route]of routes.entries()){
  await page.goto(route);await page.waitForLoadState("networkidle");await expect(page.getByRole("heading",{level:1}).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${route} must not overflow at ${width}px`).toBe(true);
  expect(await page.locator(".paper-row-title").evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().width>=100)),`${route} paper titles remain readable`).toBe(true);
  const controls=await page.locator("main input:visible, main select:visible, main textarea:visible").evaluateAll(nodes=>nodes.every(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=window.innerWidth+1;}));expect(controls,`${route} controls fit`).toBe(true);
  const capture=(route==="/upload"&&[320,768,1024,1920,2560].includes(width))||(index===0&&width===390)||(index===1&&width===768)||(index===2&&width===1024)||(index===3&&width===1440)||(index===4&&width===1920)||(index===6&&width===768)||(index===7&&width===390)||(index===8&&width===320)||(index===9&&width===1440)||(index===10&&width===2560);
  if(capture)await page.screenshot({path:test.info().outputPath(`route-${index}-${width}.png`),fullPage:true});
  if(route==="/upload"){
   const file=await page.getByTestId("upload-file-panel").boundingBox(),details=await page.getByTestId("upload-details-panel").boundingBox();expect(file&&details).toBeTruthy();
   if(width>=1280){expect(file!.x+file!.width).toBeLessThan(details!.x);expect(Math.abs(file!.y-details!.y)).toBeLessThan(3);const form=await page.locator(".upload-form").boundingBox();const main=await page.locator("main").boundingBox();expect(form!.width/main!.width).toBeGreaterThan(width>=2560?.65:.85);}
   else expect(file!.y).toBeLessThan(details!.y);
   if(width<1024){await page.getByRole("button",{name:"Open navigation"}).click();await expect(page.getByRole("dialog",{name:"Navigation"})).toBeVisible();await page.keyboard.press("Escape");await expect(page.getByRole("dialog",{name:"Navigation"})).toHaveCount(0);}
  }
 }
});
test("admin tables stay inside the viewport on phone and desktop",async({page})=>{
 await page.goto("/login");await page.waitForLoadState("networkidle");await page.locator("#email").fill("admin@papervault.dev");await page.locator("#password").fill("papervault123");await page.getByRole("button",{name:/^sign in$/i}).click();await expect(page).toHaveURL(/\/$/);
 for(const width of[390,1024,1920]){await page.setViewportSize({width,height:960});await page.goto("/admin/papers");await page.waitForLoadState("networkidle");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);if(width===390||width===1920)await page.screenshot({path:test.info().outputPath(`admin-${width}.png`),fullPage:true});}
});
test.afterAll(async()=>{await db.$disconnect();});
