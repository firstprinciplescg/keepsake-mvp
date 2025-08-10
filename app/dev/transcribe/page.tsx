// app/dev/transcribe/page.tsx
"use client";

import { useState } from "react";

export default function TranscribeDevPage() {
  const [sessionId, setSessionId] = useState("");
  const [out, setOut] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setOut(null);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setOut(data);
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">/api/transcribe — dev</h1>
        <p className="text-sm text-gray-600">
          Requires a Session with <code>audio_url</code> set to a Storage key like{" "}
          <code>audio/&lt;sessionId&gt;/file.webm</code>.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Session ID (UUID)</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            required
            aria-label="Session ID"
          />
        </label>

        <button
          type="submit"
          className="inline-flex items-center rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? "Transcribing..." : "Transcribe"}
        </button>
      </form>

      <section aria-live="polite" className="min-h-6 space-y-2">
        {err && <p className="text-red-700">{err}</p>}
        {out && (
          <div className="text-sm">
            <div>ok: {String(out.ok)}</div>
            <div>transcriptId: {out.transcriptId}</div>
            <div>textLength: {out.textLength}</div>
            <div>segments: {out.segments}</div>
          </div>
        )}
      </section>
    </main>
  );
}
