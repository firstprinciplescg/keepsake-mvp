'use client';
import { useState } from 'react';
import Link from 'next/link';

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
      setMessage(`Uploaded! Session ${data.sessionId}. Continue to Transcript.`);
    } catch(err:any){
      setError(err.message || 'Upload failed');
    } finally{
      setLoading(false);
    }
  };

  return (
    <main className="p-6 md:p-12">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-3xl font-black">Upload Audio</h1>
        <form onSubmit={doUpload} className="space-y-4 mt-4">
          <input type="file" accept=".mp3,.wav,.m4a" onChange={e=>setFile(e.target.files?.[0] || null)} />
          <button disabled={!file || loading} className="bg-terracotta text-white font-bold rounded px-4 py-2">{loading ? 'Uploading…' : 'Upload'}</button>
        </form>
        {message && <p className="text-green-700 mt-3">{message} <Link className="underline text-terracotta" href={`/session/${params.projectId}/transcript`}>Go to Transcript →</Link></p>}
        {error && <p className="text-red-700 mt-3">{error}</p>}
      </div>
    </main>
  );
}
