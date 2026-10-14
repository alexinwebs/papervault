import { describe, it, expect } from "vitest";
import { estimateSkew } from "@/server/services/scan-preparation";
describe("local bounded deskew", () => {
 const make = (angle: number) => { const width=600,height=800;const pixels=new Uint8Array(width*height).fill(255);for(let row=100;row<550;row+=45)for(let x=60;x<540;x++){const y=Math.round(row+Math.tan(angle*Math.PI/180)*(x-width/2));for(let d=0;d<3;d++)pixels[(y+d)*width+x]=0;}return {pixels,width,height}; };
 it("does not rotate a blank or already straight page", () => {expect(estimateSkew(new Uint8Array(600*800).fill(255),600,800)).toBe(0);const p=make(0);expect(estimateSkew(p.pixels,p.width,p.height)).toBe(0);});
 it("corrects mild tilt in either direction", () => {for(const angle of [-3,3]){const p=make(angle);expect(estimateSkew(p.pixels,p.width,p.height)).toBeCloseTo(-angle,0);}});
});
