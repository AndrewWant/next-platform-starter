import '../styles/globals.css';
import { Footer } from '../components/footer';
import { Header } from '../components/header';
import { createClient } from '../lib/supabase/server';

export const metadata = {
  title: {
    template: '%s | Andrew Want',
    default: 'Andrew Want',
  },
  description: 'Product leader and data engineer based in Warsaw, Poland.',
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" sizes="any" />
      </head>
      <body className="antialiased text-white bg-slate-950">
        <div className="flex flex-col min-h-screen px-6 sm:px-12">
          <div className="flex flex-col w-full max-w-5xl mx-auto grow">
            <Header user={user} />
            <main className="grow">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
