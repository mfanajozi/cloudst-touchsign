import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = { title: 'CloudST TouchSign', description: 'Mobile-first agreements, signatures and completion records by CloudST.' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 return <html lang="en-ZA"><body><header className="navbar"><Link href="/" aria-label="CloudST TouchSign home"><Image src="/cloudst-logo.png" width={230} height={78} alt="CloudST" priority /></Link><span className="product">TouchSign <small>AGREEMENT WORKSPACE</small></span><Link className="nav-link" href="/dashboard">Workspace <span aria-hidden>↗</span></Link></header>{children}<footer><span>© {new Date().getFullYear()} CloudST</span><span>Considered agreements. Confident signatures.</span></footer></body></html>;
}
