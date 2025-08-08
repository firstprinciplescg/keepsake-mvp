export function renderHtmlForPdf(opts: { title: string, chapters: { title: string, content: string }[] }){
  const { title, chapters } = opts;
  const styles = `
  <style>
  @page { margin: 24mm; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #5A3E36; }
  h1,h2 { font-family: Georgia, 'Times New Roman', serif; }
  .cover { text-align:center; margin-top:100px; }
  .chapter { page-break-before: always; }
  .chapter h2 { border-bottom: 2px solid #D98880; padding-bottom: 6px; }
  </style>`;
  const cover = `<div class="cover"><h1>${title}</h1><p>Generated Keepsake</p></div>`;
  const body = chapters.map(c => `<div class="chapter"><h2>${c.title}</h2><div>${c.content}</div></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"/>${styles}</head><body>${cover}${body}</body></html>`;
}
