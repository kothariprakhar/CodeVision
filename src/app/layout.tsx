import type { Metadata } from 'next';
import './globals.css';

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
        <nav className="glass-strong sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <a href="/" className="flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:shadow-purple-500/30 transition-shadow">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <span className="text-2xl font-bold gradient-text">Code Vision</span>
                </a>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-400">AI-Powered Analysis</span>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
