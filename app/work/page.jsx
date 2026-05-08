export const metadata = {
  title: 'Work',
};

const experience = [
  {
    title: 'Vice President — Product Owner',
    org: 'JPMorganChase',
    location: 'Warsaw, Poland',
    period: 'Feb 2024 – Present',
    bullets: [
      'Led strategic product ownership of 3 regulatory reporting applications, driving prioritisation across BAU support, infrastructure upgrades and transformational projects.',
      'Managed matrix team of 12 across USA and Poland, providing mentoring and technical leadership while facilitating cross-team collaboration.',
      'Saved 600 person-hours per year across ~100 users by spearheading a major automation initiative for comment generation.',
      'Spearheaded major application decommissioning initiative as single point of contact, rapidly assessing multiple product offerings while managing critical timelines.',
      'Developed new product concepts for long-term strategic challenges: metric store, variance analysis tool, and anomaly detection.',
    ],
  },
  {
    title: 'Senior Associate — Data Engineer / Product Owner',
    org: 'JPMorganChase',
    location: 'Warsaw, Poland',
    period: 'May 2022 – Feb 2024',
    bullets: [
      'Developed and implemented changes to complex SQL-based ETL pipelines for regulatory reporting in the Loans & Commitments space.',
      'Created comprehensive Standard Operating Procedures for data engineering processes, from initial request through post-deployment validation.',
      'Led training initiatives for team members and stakeholders on data models and tools, bridging technical and business perspectives.',
    ],
  },
  {
    title: 'Postdoctoral Researcher',
    org: 'Polish Academy of Sciences — Nencki Institute',
    location: 'Warsaw, Poland',
    period: 'Jul 2019 – Apr 2022',
    bullets: [
      'Developed Python-based machine learning solutions for medical image analysis, resulting in multiple peer-reviewed publications.',
      'Designed and deployed user-facing applications for data collection and validation with consensus-driven ground truth for ML model training.',
      'Defined data management strategy for the research group, establishing governance frameworks and comprehensive onboarding documentation.',
      'Implemented a lightweight data tracking system for laboratory animal studies, migrating from legacy Google Sheets.',
    ],
  },
  {
    title: 'Clinical Laboratory Scientist',
    org: 'GlaxoSmithKline',
    location: 'Cambridge, UK',
    period: 'Jul 2013 – Jun 2019',
    bullets: [
      'Conceived and implemented a digital transformation initiative migrating all laboratory processes to an electronic data capture system (FDA 21 CFR 11 compliant).',
      'Acted as data management SME for 5 clinical trials, ensuring alignment with CDISC and ADAM requirements.',
      'Led development and validation of an innovative breath analysis platform, from sample collection through data analysis and clinical reporting.',
      'Worked in a multi-functional team of 8 processing human clinical samples across 10 clinical studies.',
    ],
  },
];

const education = [
  { degree: 'Ph.D. Biochemical Engineering', institution: 'University of Birmingham', year: '2009' },
  { degree: 'M.Sc. Biochemical Engineering', institution: 'University College London', year: '2004' },
  { degree: 'B.Sc. (Hons) Biochemistry', institution: 'University of Bristol', year: '2002' },
];

const skills = {
  Technical: ['SQL', 'Python', 'Databricks', 'AWS', 'Docker', 'Git', 'ETL', 'Data Modelling', 'Machine Learning', 'Neural Networks', 'Data Pipeline Design', 'Data Visualisation', 'UI/UX'],
  'Product & Process': ['Agile', 'SDLC', 'Product Ownership', 'Release Management', 'Change Management', 'Requirements Gathering', 'Process Optimisation', 'SOP Development', 'Jira'],
  Leadership: ['Matrix Management', 'Stakeholder Management', 'Strategic Planning', 'Team Development', 'Cross-functional Leadership', 'Vendor Management'],
  'Regulatory': ['GCP', 'GCLP', 'FDA 21 CFR 11', 'US Federal Reserve Regulatory Reporting', 'CDISC / ADAM'],
};

export default function WorkPage() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <h1 className="text-4xl font-bold mb-2">Experience</h1>
        <p className="text-slate-400 max-w-xl">
          A career spanning biochemical research, clinical data science, and financial services product — always at the intersection of regulated data and technical delivery.
        </p>
      </section>

      <section className="flex flex-col gap-12">
        {experience.map((role, i) => (
          <div key={i} className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1">
              <div>
                <h2 className="text-xl font-semibold">{role.title}</h2>
                <p className="text-slate-400">{role.org} &middot; {role.location}</p>
              </div>
              <span className="text-sm text-slate-500 shrink-0 sm:text-right">{role.period}</span>
            </div>
            <ul className="flex flex-col gap-2">
              {role.bullets.map((b, j) => (
                <li key={j} className="flex gap-3 text-slate-300 text-sm leading-relaxed">
                  <span className="text-slate-600 mt-1 shrink-0">&mdash;</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-6 pt-4 border-t border-slate-800">
        <h2 className="text-2xl font-bold">Education</h2>
        <div className="flex flex-col gap-4">
          {education.map((e, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <p className="font-medium">{e.degree}</p>
                <p className="text-sm text-slate-400">{e.institution}</p>
              </div>
              <span className="text-sm text-slate-500">{e.year}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6 pt-4 border-t border-slate-800">
        <div>
          <h2 className="text-2xl font-bold mb-1">Publications</h2>
          <p className="text-slate-400 text-sm">
            17 peer-reviewed publications (4 as first author) spanning Biochemical Engineering, Clinical Trials, Alzheimer&apos;s Disease, Cancer Research, and Method &amp; Device development. Multiple presentations at international conferences.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-8 pt-4 border-t border-slate-800">
        <h2 className="text-2xl font-bold">Skills</h2>
        <div className="grid sm:grid-cols-2 gap-8">
          {Object.entries(skills).map(([category, items]) => (
            <div key={category} className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{category}</h3>
              <div className="flex flex-wrap gap-2">
                {items.map((skill) => (
                  <span key={skill} className="px-2.5 py-1 text-xs bg-slate-800 text-slate-300 rounded-md border border-slate-700">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
