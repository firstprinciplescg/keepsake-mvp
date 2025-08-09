export default function TokenLanding({ params }: { params: { token: string } }) {
  return (
    <main className="p-6 md:p-12">
      <div className="mx-auto max-w-md bg-white rounded-2xl shadow p-6 text-center">
        <h1 className="text-2xl font-black mb-2">Join Project</h1>
        <p className="opacity-80 mb-4">This private link grants access to the interview workspace.</p>
        <form method="post" action="/api/token/exchange">
          <input type="hidden" name="token" value={params.token} />
          <button className="bg-terracotta text-white font-bold rounded px-4 py-2">
            Continue
          </button>
        </form>
        <p className="text-xs opacity-60 mt-3">Links are one-time; if this was shared or previewed by a bot, ask for a new one.</p>
      </div>
    </main>
  );
}
