export default function Section({ children, title }: { children: React.ReactNode; title: string; }) {
  return (
    <section className="p-6 md:p-10">
      <h2 className="text-2xl font-black mb-3">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
