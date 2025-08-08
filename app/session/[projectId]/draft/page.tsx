export default function DraftPage({ params }: { params: { projectId: string } }){
  return (
    <main className="p-6 md:p-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black">Drafts (Coming Soon)</h1>
        <p>Generate and review chapter drafts. Regenerate up to your limit.</p>
      </div>
    </main>
  );
}
