import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NEXO Arena — Small board. Big energy.',
  description: 'A sharper take on tic-tac-toe. Play three levels of AI or challenge a friend on one device. No account required.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'NEXO Arena' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#101115' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="dark"><body>{children}</body></html>;
}
