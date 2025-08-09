'use client';
import { useEffect, useState } from 'react';

type Chapter = { title: string; bullets?: string[] };

export default function OutlinePage({ params }: { params: { projectId: string } }){
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [outlineId, setOutlineId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

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
    setChapters((data.structure?.chapters || []) as Chapter[]);
  }

  async function generateOutline(sid: string){
    setStatus('Generating outline…');
    const res = await fetch('/api/outline', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionId: sid }) });
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setOutlineId(data.outlineId);
    setChapters((data.structure?.chapters || []) as Chapter[]);
    setStatus('Outline ready.');
  }

  useEffect(()=>{
    (async () => {
      try{
        const cur = await fetchCurrent();
        if(!cur.sessionId){ setError('No session yet. Upload audio first.'); return; }
        // try fetch first, else generate
        try{ await fetchOutline(cur.sessionId); } catch{ await generateOutline(cur.sessionId); }
      }catch(e:any){
        setError(e.message || 'Failed to load outline');
      } finally{
        setLoading(false);
      }
    })();
  }, []);

  function updateTitle(i:number, val:string){
    setChapters(prev => prev.map((c,idx)=> idx===i ? ({...c, title: val}) : c));
  }
  function updateBullet(i:number, j:number, val:string){
    setChapters(prev => prev.map((c,idx)=> idx===i ? ({...c, bullets: (c.bullets||[]).map((b,k)=> k===j ? val : b)}) : c));
  }
  function addBullet(i:number){ setChapters(prev => prev.map((c,idx)=> idx===i ? ({...c, bullets:[...(c.bullets||[]), '']}) : c)); }

  async function save(approve=false){
    if(!outlineId) return;
    setStatus(approve ? 'Saving & approving…' : 'Saving…');
    const res = await fetch('/api/outline', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ outlineId, structure: { chapters }, approved: approve }) });
    if(!res.ok) throw new Error(await res.text());
    setStatus(approve ? 'Saved & approved.' : 'Saved.');
  }

  if(loading) return <main className="p-6 md:p-12"><p>Loading…</p></main>;
  if(error) return <main className="p-6 md:p-12"><p className="text-red-700">{error}</p></main>;

  return (
    <main className="p-6 md:p-12">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-3xl font-black mb-3">Outline</h1>
        <p className="text-sm opacity-80 mb-4">Edit chapter titles and bullets, then approve to continue to draft generation.</p>
        <div className="space-y-6">
          {chapters.map((ch, i)=>(
            <div key={i} className="border rounded p-3">
              <input value={ch.title} onChange={e=>updateTitle(i, e.target.value)} className="w-full font-semibold text-lg border-b pb-1 mb-2" />
              <div className="space-y-2 mt-2">
                {(ch.bullets||[]).map((b,j)=>(
                  <div key={j} className="flex gap-2">
                    <span className="opacity-60 mt-2">•</span>
                    <input value={b} onChange={e=>updateBullet(i,j,e.target.value)} className="flex-1 border rounded px-2 py-1" />
                  </div>
                ))}
                <button onClick={()=>addBullet(i)} className="text-sm underline text-terracotta">+ Add bullet</button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={()=>save(false)} className="bg-terracotta text-white font-bold rounded px-4 py-2">Save</button>
          <button onClick={()=>save(true)} className="bg-warmbrown text-white font-bold rounded px-4 py-2">Approve Outline</button>
          {status && <span className="text-green-700 text-sm">{status}</span>}
        </div>
      </div>
    </main>
  );
}
