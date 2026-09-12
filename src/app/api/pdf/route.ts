import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 60;

// Renders /report/[id]/print in a headless browser and returns a real PDF.
export async function GET(req: NextRequest){
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if(!user) return NextResponse.json({ error:"unauthorized" }, { status:401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if(!id) return NextResponse.json({ error:"missing id" }, { status:400 });

  const origin = req.nextUrl.origin;
  // Pass the auth cookie through so the print page can load the report.
  const cookie = req.headers.get("cookie") || "";

  let browser:any = null;
  try {
    const isVercel = !!process.env.VERCEL;
    let puppeteer:any, launchOpts:any;
    if(isVercel){
      const chromium = (await import("@sparticuz/chromium")).default;
      puppeteer = await import("puppeteer-core");
      launchOpts = {
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
        defaultViewport: { width: 1240, height: 1600 },
      };
    } else {
      puppeteer = await import("puppeteer");
      launchOpts = { headless: true, args:["--no-sandbox","--disable-setuid-sandbox"] };
    }
    browser = await puppeteer.launch(launchOpts);
    const page = await browser.newPage();
    // forward auth cookies so the print route (which needs the logged-in session) works
    if(cookie){
      const cookies = cookie.split(";").map(c=>{
        const idx=c.indexOf("="); const name=c.slice(0,idx).trim(); const value=c.slice(idx+1).trim();
        return { name, value, url: origin };
      }).filter(c=>c.name);
      try{ await page.setCookie(...cookies); }catch{}
    }
    await page.goto(`${origin}/report/${id}/print?pdf=1`, { waitUntil:"networkidle0", timeout: 45000 });
    // give fonts/images a moment
    await new Promise(r=>setTimeout(r, 800));
    const pdf = await page.pdf({
      format:"Letter", printBackground:true, preferCSSPageSize:true,
      margin:{ top:"0", right:"0", bottom:"0", left:"0" },
    });
    await browser.close(); browser=null;

    return new NextResponse(pdf, {
      status:200,
      headers:{
        "Content-Type":"application/pdf",
        "Content-Disposition":`inline; filename="ProSight-Report-${id}.pdf"`,
      },
    });
  } catch(e:any){
    if(browser) try{ await browser.close(); }catch{}
    return NextResponse.json({ error: e.message || "pdf generation failed" }, { status:500 });
  }
}
