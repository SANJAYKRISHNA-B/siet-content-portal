import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SIET Content Collection Portal',
  description: 'Institutional website content submission and approval portal',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
