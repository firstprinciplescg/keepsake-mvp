'use client';
import { useState } from 'react';
import Card from '@/components/Card';
import Section from '@/components/Section';

export default function UploadPage({ params }: { params: { projectId: string } }){
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doUpload = async (e:any) => {
    e.preventDefault();
    if(!file) return;
    setLoading(true); setError(null); setMessage(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('projectId', params.projectId);
    try{
      const res = await fetch('/api/upload-audio', { method:'POST', body: fd });
      if(!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessage(`Uploaded! Session ${data.sessionId}, duration ${data.duration}s`);
    } catch(err:any){
      setError(err.message || 'Upload failed');
    } finally{
      setLoading(false);
    }
  };

  return (
    <main className="p-6 md:p-12">
      <Card>
        <div className="p-6 bg-gradient-to-b from-terracotta/10 to-beige/40 text-center rounded-t-2xl">
          <h1 className="text-3xl font-black">Upload Audio</h1>
        </div>
        <Section title="Choose a File">
          <form onSubmit={doUpload} className="space-y-4">
            <input type="file" accept=".mp3,.wav,.m4a" onChange={e=>setFile(e.target.files?.[0] || null)} />
            <button disabled={!file || loading} className="bg-terracotta text-white font-bold rounded px-4 py-2">{loading ? 'Uploading…' : 'Upload'}</button>
          </form>
          {message && <p className="text-green-700">{message}</p>}
          {error && <p className="text-red-700">{error}</p>}
        </Section>
      </Card>
    </main>
  );
}
