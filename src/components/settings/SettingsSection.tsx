import { motion } from 'framer-motion';

export function SettingsSection({
  icon,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="plate rounded-2xl p-6"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="page-eyebrow">{eyebrow}</span>
      </div>
      <h2 className="page-title text-2xl mt-1">{title}</h2>
      <p className="text-[12.5px] text-muted-foreground mt-1 max-w-prose leading-relaxed">{subtitle}</p>
      <div className="mt-5 flex flex-col gap-3">{children}</div>
    </motion.section>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="section-kicker">{label}</span>
      {children}
      {hint ? <span className="text-[12px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function ReadonlyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="section-kicker">{label}</span>
      <div className={`input-base ${mono ? 'font-mono text-[12.5px]' : ''}`} aria-readonly="true">
        {value}
      </div>
    </div>
  );
}
