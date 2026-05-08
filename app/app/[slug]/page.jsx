export async function generateMetadata({ params }) {
  const { slug } = await params;
  return {
    title: slug.charAt(0).toUpperCase() + slug.slice(1),
  };
}

export default async function AppPage({ params }) {
  const { slug } = await params;
  const name = slug.charAt(0).toUpperCase() + slug.slice(1);

  return (
    <div className="flex flex-col gap-6 pt-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">App</p>
        <h1 className="text-4xl font-bold">{name}</h1>
      </div>
      <p className="text-slate-400">
        This is the gated entry point for <strong className="text-white">{name}</strong>. Application content will be built here.
      </p>
    </div>
  );
}
