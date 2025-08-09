'use client';
import { useEffect, useState } from 'react';

export default function ExportPage({ params }: { params: { projectId: string } }){
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [outlineId, setOutlineId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchCurrent(){
    const res = await fetch('/api/session/current');
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setSessionId(data.sessionId);
    return data;
  }
  async function fetchOutline(sid: string){
    const res = await fetch(`/api/outline?sessionId=${sid}`);
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setOutlineId(data.id);
    return data;
  }
  async function exportPdf(){
    if(!outlineId) return;
    setStatus('Generating PDF…');
    const res = await fetch('/api/export', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ outlineId }) });
    if(!res.ok){ setStatus(''); throw new Error(await res.text()); }
    const data = await res.json();
    setPdfUrl(data.pdfUrl || null);
    setStatus('PDF ready.');
  }

  async function submitFeedback(){
    if(rating==null) return;
    setStatus('Submitting feedback…');
    const res = await fetch('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rating, comment: '' }) });
    if(!res.ok){ setStatus(''); alert(await res.text()); return; }
    setStatus('Thanks for your feedback!');
  }

  useEffect(()=>{
    (async () => {
      try{
        const cur = await fetchCurrent();
        if(!cur.sessionId){ setError('No session yet. Upload audio first.'); return; }
        await fetchOutline(cur.sessionId);
      }catch(e:any){
        setError(e.message || 'Failed to load export');
      } finally{
        setLoading(false);
      }
    })();
  }, []);

  if(loading) return <main className="p-6 md:p-12"><p>Loading…</p></main>;
  if(error) return <main className="p-6 md:p-12"><p className="text-red-700">{error}</p></main>;

  return (
    <main className="p-6 md:p-12">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-3xl font-black mb-3">Export</h1>
        <p className="text-sm opacity-80 mb-4">Generate your styled PDF keepsake and download it.</p>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={exportPdf} className="bg-terracotta text-white font-bold rounded px-4 py-2">Generate PDF</button>
          {status && <span className="text-green-700 text-sm">{status}</span>}
        </div>
        {pdfUrl && (
          <div className="space-y-2">
            <a className="text-terracotta underline" href={pdfUrl} target="_blank" rel="noreferrer">Download PDF</a>
            <p className="text-xs opacity-70">Link expires in ~10 minutes.</p>
          </div>
        )}

        <div className="mt-8 border-t pt-4">
          <h2 className="font-semibold mb-2">Quick feedback</h2>
          <div className="flex gap-2">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={()=>setRating(n)} className={`px-3 py-1 rounded border ${rating===n ? 'bg-warmbrown text-white' : ''}`}>{n}</button>
            ))}
          </div>
          <button onClick={submitFeedback} disabled={rating==null} className="mt-3 bg-warmbrown text-white font-bold rounded px-4 py-2 disabled:opacity-50">Submit</button>
        </div>
      </div>
    </main>
  );
}
