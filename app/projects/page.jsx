import Link from 'next/link';

export const metadata = {
  title: 'Projects',
};

const projects = [
  {
    slug: 'lineup',
    name: 'LineUp',
    description: 'A scheduling and queue management tool. Access is by invitation.',
    status: 'active',
    tags: ['Productivity', 'Scheduling'],
  },
  {
    slug: 'polish',
    name: 'Polish',
    description: 'Language learning tools and practice aids. Access is by invitation.',
    status: 'active',
    tags: ['Education', 'Language'],
  },
];

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-12">
      <section>
        <h1 className="text-4xl font-bold mb-2">Projects</h1>
        <p className="text-slate-400 max-w-xl">
          A collection of tools and applications built for specific problems. Some are open for collaboration — get in touch if you&apos;d like access.
        </p>
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </section>
    </div>
  );
}

function ProjectCard({ project }) {
  return (
    <div className="flex flex-col gap-4 p-6 bg-slate-900/60 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold">{project.name}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800/50">
          {project.status}
        </span>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{project.description}</p>
      <div className="flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <span key={tag} className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
            {tag}
          </span>
        ))}
      </div>
      <div className="pt-2 mt-auto">
        <Link
          href={`/app/${project.slug}`}
          className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
        >
          Open app &rarr;
        </Link>
      </div>
    </div>
  );
}
