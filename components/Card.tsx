import clsx from 'clsx';

export default function Card({ children, className }: { children: React.ReactNode, className?: string }){
  return (
    <div className={clsx("mx-auto max-w-3xl bg-white rounded-2xl shadow-lg border-t-4 border-terracotta", className)}>
      {children}
    </div>
  )
}
