import { describe, it, expect } from "vitest";
import { boundedFormData } from "@/lib/bounded-form-data";
describe("bounded detection intake", () => {
 it("parses a multipart file below the limit", async()=>{const form=new FormData();form.set("file",new Blob(["paper"],{type:"application/pdf"}),"paper.pdf");const result=await boundedFormData(new Request("https://example.test",{method:"POST",body:form}),4096);expect(await (result.get("file") as File).text()).toBe("paper");});
 it("refuses oversized declared bodies before parsing",async()=>{await expect(boundedFormData(new Request("https://example.test",{method:"POST",headers:{"content-length":"5000"},body:"x"}),100)).rejects.toMatchObject({status:413});});
 it("cancels a chunked oversized body without Content-Length",async()=>{let cancelled=false;const stream=new ReadableStream<Uint8Array>({pull(c){c.enqueue(new Uint8Array(64));},cancel(){cancelled=true;}});const request=new Request("https://example.test",{method:"POST",body:stream,duplex:"half"} as RequestInit);await expect(boundedFormData(request,100)).rejects.toMatchObject({status:413});expect(cancelled).toBe(true);});
 it("refuses an empty request",async()=>{await expect(boundedFormData(new Request("https://example.test",{method:"POST"}),100)).rejects.toMatchObject({code:"VALIDATION_ERROR"});});
});
