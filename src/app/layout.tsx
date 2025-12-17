import type { Metadata } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';
import FeedbackSystem from '@/components/FeedbackSystem';

export const metadata: Metadata = {
  title: 'Code Vision - AI-Powered Code Quality Analysis',
  description: 'Analyze code quality and requirements alignment with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-white">
        <NavBar />
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
        <FeedbackSystem />
      </body>
    </html>
  );
}
