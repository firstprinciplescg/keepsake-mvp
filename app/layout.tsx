import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Keepsake MVP',
  description: 'Capture and preserve stories as a beautiful keepsake.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
