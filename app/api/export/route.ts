import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifySessionCookie } from '@/lib/token';
import { renderHtmlForPdf } from '@/lib/pdfTemplate';

export const dynamic = 'force-dynamic'; // ensure Node runtime

export async function POST(req: NextRequest){
  const cookie = req.cookies.get('kp_session')?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if(!session) return new NextResponse('Unauthorized', { status: 401 });

  try{
    const { outlineId } = await req.json();
    if(!outlineId) return new NextResponse('outlineId required', { status: 400 });

    const { data: chapters, error: ce } = await supabaseAdmin.from('draft_chapters').select('title, content').eq('outline_id', outlineId).order('title', { ascending: true });
    if(ce) throw ce;

    const html = renderHtmlForPdf({ title: 'Keepsake', chapters: (chapters || []) as any });

    const execPath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: execPath || undefined,
      headless: true
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'Letter', printBackground: true });
    await browser.close();

    // Upload to Storage and return signed URL
    const bucket = process.env.SUPABASE_BUCKET_PDF || 'pdfs';
    const path = `${session.projectId}/keepsake-${Date.now()}.pdf`;
    const { error: ue } = await supabaseAdmin.storage.from(bucket).upload(path, pdf, { contentType: 'application/pdf' });
    if(ue) throw ue;
    const { data: url } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60 * 10);
    return NextResponse.json({ pdfUrl: url?.signedUrl });
  }catch(e:any){
    return new NextResponse(e.message || 'Export failed', { status: 500 });
  }
}
