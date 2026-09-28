import { motion } from "framer-motion";
import { profile, thumbOf } from "~/data/profile";

// A single scrolling profile page ("contact card"). It's the first thing a
// recruiter sees, on desktop and especially on phones.

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginTop: 28 }}>
    <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--a-text-2)", margin: "0 0 10px" }}>
      {title}
    </h2>
    {children}
  </section>
);

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: "var(--a-bg-side)", border: "0.5px solid var(--a-border)", borderRadius: 14, padding: 16, ...style }}>
    {children}
  </div>
);

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "inline-block", fontSize: 12, padding: "3px 9px", borderRadius: 999, background: "var(--a-fill)", color: "var(--a-text)", margin: "0 6px 6px 0" }}>
    {children}
  </span>
);

const ActionButton = ({ href, icon, label, download, primary }: { href: string; icon: string; label: string; download?: string; primary?: boolean }) => (
  <a
    href={href}
    target={download ? undefined : "_blank"}
    rel="noreferrer"
    download={download}
    className="flex-center"
    style={{
      gap: 6,
      padding: "8px 14px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 600,
      background: primary ? "#007AFF" : "var(--a-fill)",
      color: primary ? "white" : "var(--a-text)",
      whiteSpace: "nowrap"
    }}
  >
    <span className={icon} style={{ width: 15, height: 15 }} />
    {label}
  </a>
);

function ProjectCard({ project, index }: { project: (typeof profile.projects)[number]; index: number }) {
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState(0);
  const current = project.screenshots[shot];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * index }}>
      <Card style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {current && (
          <div style={{ marginBottom: 12 }}>
            <a href={current.src} target="_blank" rel="noreferrer" title="Open full size">
              <img
                src={current.src}
                alt={`${project.name}: ${current.caption}`}
                loading="lazy"
                style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover", objectPosition: "top", borderRadius: 10, border: "0.5px solid var(--a-border, rgba(0,0,0,0.1))" }}
              />
            </a>
            <div style={{ fontSize: 11.5, color: "var(--a-text-2)", margin: "6px 2px" }}>{current.caption}</div>
            <div className="flex" style={{ gap: 6, overflowX: "auto" }} role="tablist" aria-label={`${project.name} screenshots`}>
              {project.screenshots.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  role="tab"
                  aria-selected={i === shot}
                  title={s.caption}
                  onClick={() => setShot(i)}
                  style={{ flexShrink: 0, padding: 0, borderRadius: 6, overflow: "hidden", outline: i === shot ? "2px solid #007AFF" : "none", outlineOffset: 1, opacity: i === shot ? 1 : 0.65 }}
                >
                  <img src={thumbOf(s.src)} alt="" loading="lazy" style={{ display: "block", width: 52, height: 30, objectFit: "cover", objectPosition: "top" }} />
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center" style={{ gap: 10 }}>
          <img src={project.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--a-text)" }}>{project.name}</div>
            <div style={{ fontSize: 12, color: "var(--a-text-2)" }}>{project.date}</div>
          </div>
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--a-text)", margin: "10px 0" }}>{project.tagline}</p>
        <div>
          {project.stack.map((s) => (
            <Chip key={s}>{s}</Chip>
          ))}
        </div>
        {open && (
          <ul style={{ fontSize: 13, lineHeight: 1.55, color: "var(--a-text)", paddingLeft: 18, margin: "6px 0 4px", listStyle: "disc" }}>
            {project.highlights.map((h) => (
              <li key={h} style={{ marginBottom: 4 }}>
                {h}
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center flex-wrap" style={{ gap: 8, marginTop: "auto", paddingTop: 8 }}>
          <ActionButton href={project.live} icon="i-ph:arrow-square-out" label="Live" primary />
          <ActionButton href={project.github} icon="i-fa6-brands:github" label="Code" />
          <button onClick={() => setOpen((o) => !o)} style={{ fontSize: 13, color: "#007AFF", padding: "8px 4px" }}>
            {open ? "Less" : "Highlights"}
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

export default function About() {
  const p = profile;
  return (
    <div className="app-theme" style={{ height: "100%", overflowY: "auto", background: "var(--a-bg)", color: "var(--a-text)" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 20px 60px" }}>
        {/* Header */}
        <div className="flex flex-col items-center" style={{ textAlign: "center" }}>
          <motion.img
            src={p.avatar}
            alt={p.name}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ width: 104, height: 104, borderRadius: "50%", objectFit: "cover", boxShadow: "0 6px 24px rgba(0,0,0,0.18)" }}
          />
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "14px 0 4px", letterSpacing: "-0.02em" }}>{p.name}</h1>
          <div style={{ fontSize: 14.5, color: "var(--a-text-2)", maxWidth: 520 }}>{p.role}</div>
          <div className="flex items-center" style={{ gap: 4, fontSize: 13, color: "var(--a-text-2)", marginTop: 6 }}>
            <span className="i-ph:map-pin" style={{ width: 13, height: 13 }} />
            {p.location}
          </div>
          <div className="flex flex-wrap justify-center" style={{ gap: 8, marginTop: 16 }}>
            <ActionButton href={p.resume} icon="i-ph:file-arrow-down" label="Résumé" download={p.resumeFileName} primary />
            <ActionButton href={`mailto:${p.email}`} icon="i-ph:envelope-simple" label="Email" />
            <ActionButton href={p.socials.github} icon="i-fa6-brands:github" label="GitHub" />
            <ActionButton href={p.socials.linkedin} icon="i-fa6-brands:linkedin" label="LinkedIn" />
          </div>
        </div>

        <Section title="About">
          <Card>
            <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{p.summary}</p>
          </Card>
        </Section>

        <Section title="Projects">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
            {p.projects.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>
        </Section>

        <Section title="Skills">
          <Card>
            {Object.entries(p.skills).map(([group, items]) => (
              <div key={group} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--a-text-2)", marginBottom: 6 }}>{group}</div>
                {items.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            ))}
          </Card>
        </Section>

        <Section title="Education">
          <div style={{ display: "grid", gap: 10 }}>
            {p.education.map((e) => (
              <Card key={e.school}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{e.school}</div>
                <div style={{ fontSize: 13, color: "var(--a-text-2)", marginTop: 2 }}>
                  {e.degree}
                  {e.period && ` · ${e.period}`} · {e.place}
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>{e.score}</div>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="Achievements">
          <Card>
            <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc", fontSize: 14, lineHeight: 1.7 }}>
              {p.achievements.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
              <ActionButton href={p.socials.leetcode} icon="i-ph:code" label="LeetCode" />
              <ActionButton href={p.socials.codechef} icon="i-ph:chef-hat" label="CodeChef" />
              <ActionButton href={p.socials.codolio} icon="i-ph:chart-line-up" label="Codolio" />
            </div>
          </Card>
        </Section>

        <Section title="Certifications">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {p.certifications.map((c) => (
              <a key={c.id} href={c.file} target="_blank" rel="noreferrer">
                <Card style={{ padding: 10 }}>
                  <img src={c.preview} alt={c.title} loading="lazy" style={{ width: "100%", aspectRatio: "1.41", objectFit: "cover", borderRadius: 8 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, color: "var(--a-text)" }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: "var(--a-text-2)" }}>
                    {c.issuer} · {c.year}
                  </div>
                </Card>
              </a>
            ))}
          </div>
        </Section>

        <Section title="Interests">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {p.interests.map((i) => (
              <Card key={i.title} style={{ padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{i.title}</div>
                <div style={{ fontSize: 13, color: "var(--a-text-2)", marginTop: 4, lineHeight: 1.5 }}>{i.text}</div>
              </Card>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
