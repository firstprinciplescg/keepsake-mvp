'use client';
import { useState } from 'react';
import Card from '@/components/Card';
import Section from '@/components/Section';

export default function Home() {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [relationship, setRelationship] = useState('');
  const [themes, setThemes] = useState('');
  const [output, setOutput] = useState('book');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try{
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, dob, relationship, themes, output }),
      });
      if(!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setShareUrl(data.shareUrl);
    } catch(err:any){
      setError(err.message || 'Failed to create project');
    } finally{
      setLoading(false);
    }
  };

  return (
    <main className="p-6 md:p-12">
      <Card>
        <div className="p-6 bg-gradient-to-b from-terracotta/10 to-beige/40 text-center rounded-t-2xl">
          <div className="inline-block bg-terracotta text-white px-3 py-1 rounded-full text-sm">Keepsake MVP</div>
          <h1 className="text-4xl font-black mt-2">Create a New Project</h1>
          <p className="opacity-80 mt-2">Enter interviewee details to generate your private project link.</p>
        </div>
        <Section title="Interviewee Details">
          <form onSubmit={submit} className="grid gap-4">
            <input className="border rounded px-3 py-2" placeholder="Interviewee Name" value={name} onChange={e=>setName(e.target.value)} required />
            <input className="border rounded px-3 py-2" placeholder="Date of Birth (YYYY-MM-DD)" value={dob} onChange={e=>setDob(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder="Relationship (e.g., Father, Grandmother)" value={relationship} onChange={e=>setRelationship(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder="Themes (comma-separated)" value={themes} onChange={e=>setThemes(e.target.value)} />
            <label className="text-sm">Output Type</label>
            <select className="border rounded px-3 py-2" value={output} onChange={e=>setOutput(e.target.value)}>
              <option value="book">Book (multi-chapter)</option>
              <option value="single">Single Story</option>
            </select>
            <button disabled={loading} className="bg-terracotta text-white font-bold rounded px-4 py-2 mt-2">
              {loading ? 'Creating…' : 'Generate Private Link'}
            </button>
          </form>
          {error && <p className="text-red-600">{error}</p>}
          {shareUrl && (
            <div className="bg-beige/60 p-4 rounded">
              <p className="font-semibold">Share this private link (treat like a key):</p>
              <a className="text-terracotta underline break-all" href={shareUrl}>{shareUrl}</a>
            </div>
          )}
        </Section>
      </Card>
    </main>
  );
}
