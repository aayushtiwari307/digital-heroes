export default function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">{description}</p>}
      </div>
      {action}
    </div>
  );
}
