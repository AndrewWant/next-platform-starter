import Link from 'next/link';

export const metadata = {
  title: 'Andrew Want',
};

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 sm:gap-24">
      <section className="flex flex-col gap-6 pt-8 sm:pt-16">
        <div>
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-3">
            Warsaw, Poland
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-1">
            Andrew Want
          </h1>
          <p className="text-slate-400 text-lg font-light">
            B.Sc. (Hons) &middot; M.Sc. &middot; Ph.D.
          </p>
        </div>

        <p className="text-xl text-slate-300 max-w-2xl leading-relaxed">
          Product leader and data engineer bridging life sciences and financial services.
          Currently VP Product Owner at JPMorganChase, building regulatory reporting
          platforms for global markets.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/work" className="px-5 py-2.5 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 transition-colors text-sm">
            View experience
          </Link>
          <Link href="/projects" className="px-5 py-2.5 border border-slate-600 text-slate-200 font-medium rounded-lg hover:border-slate-400 hover:text-white transition-colors text-sm">
            Explore projects
          </Link>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-px bg-slate-800/50 rounded-xl overflow-hidden border border-slate-800">
        <Stat value="17" label="Peer-reviewed publications" />
        <Stat value="12+" label="Years in regulated industries" />
        <Stat value="3" label="Domains: science, data, product" />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Currently
        </h2>
        <div className="flex flex-col gap-3">
          <RoleItem
            title="VP — Product Owner"
            org="JPMorganChase"
            period="Feb 2024 – Present"
            note="Regulatory reporting · Loans & Commitments"
          />
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="flex flex-col gap-1 p-6 bg-slate-900/60">
      <span className="text-3xl font-bold">{value}</span>
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  );
}

function RoleItem({ title, org, period, note }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-3 border-b border-slate-800">
      <div>
        <span className="font-medium">{title}</span>
        <span className="text-slate-400"> · {org}</span>
        {note && <p className="text-sm text-slate-500 mt-0.5">{note}</p>}
      </div>
      <span className="text-sm text-slate-500 shrink-0">{period}</span>
    </div>
  );
}
