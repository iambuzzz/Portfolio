import type { TerminalData } from "~/types";
import { profile } from "~/data/profile";

const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a className="text-blue-300 hover:underline" href={href} target="_blank" rel="noreferrer">
    {children}
  </a>
);

const projectFiles: TerminalData[] = profile.projects.map((p) => ({
  id: `project-${p.id}`,
  title: `${p.id}.md`,
  type: "file",
  content: (
    <div className="py-1 space-y-1">
      <div>
        <span className="text-yellow-300 font-bold"># {p.name}</span>{" "}
        <span className="text-gray-400">({p.date})</span>
      </div>
      <div>{p.tagline}</div>
      <div className="text-green-300">{p.stack.join(" · ")}</div>
      <ul className="list-disc ml-6">
        {p.highlights.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <div>
        <Link href={p.live}>live</Link> · <Link href={p.github}>github</Link>
      </div>
    </div>
  )
}));

const terminal: TerminalData[] = [
  {
    id: "about",
    title: "about",
    type: "folder",
    children: [
      {
        id: "about-intro",
        title: "intro.txt",
        type: "file",
        content: (
          <div className="py-1">
            <div>
              Hi, I'm {profile.name} — {profile.role}.
            </div>
            <div className="mt-1">{profile.summary}</div>
          </div>
        )
      },
      {
        id: "about-education",
        title: "education.txt",
        type: "file",
        content: (
          <ul className="list-disc ml-6 py-1">
            {profile.education.map((e) => (
              <li key={e.school}>
                <span className="text-yellow-200">{e.school}</span>, {e.place}
                <div>
                  {e.degree}
                  {e.period && ` · ${e.period}`}
                </div>
                <div className="text-gray-300">{e.score}</div>
              </li>
            ))}
          </ul>
        )
      },
      {
        id: "about-interests",
        title: "interests.txt",
        type: "file",
        content: (
          <ul className="list-disc ml-6 py-1">
            {profile.interests.map((i) => (
              <li key={i.title}>
                <span className="text-yellow-200">{i.title}</span>: {i.text}
              </li>
            ))}
          </ul>
        )
      },
      {
        id: "about-contact",
        title: "contact.txt",
        type: "file",
        content: (
          <ul className="list-disc ml-6 py-1">
            <li>
              Email: <Link href={`mailto:${profile.email}`}>{profile.email}</Link>
            </li>
            {profile.showPhone && <li>Phone: {profile.phone}</li>}
            <li>
              GitHub: <Link href={profile.socials.github}>@{profile.handle}</Link>
            </li>
            <li>
              LinkedIn: <Link href={profile.socials.linkedin}>{profile.name}</Link>
            </li>
            <li>
              LeetCode: <Link href={profile.socials.leetcode}>iambuzz</Link>
            </li>
            <li>
              CodeChef: <Link href={profile.socials.codechef}>iambuzz</Link>
            </li>
            <li>
              Codolio: <Link href={profile.socials.codolio}>iambuzz</Link>
            </li>
          </ul>
        )
      }
    ]
  },
  {
    id: "projects",
    title: "projects",
    type: "folder",
    children: projectFiles
  },
  {
    id: "skills",
    title: "skills.txt",
    type: "file",
    content: (
      <ul className="list-disc ml-6 py-1">
        {Object.entries(profile.skills).map(([group, items]) => (
          <li key={group}>
            <span className="text-yellow-200">{group}</span>: {items.join(", ")}
          </li>
        ))}
      </ul>
    )
  },
  {
    id: "achievements",
    title: "achievements.txt",
    type: "file",
    content: (
      <ul className="list-disc ml-6 py-1">
        {profile.achievements.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    )
  },
  {
    id: "certifications",
    title: "certifications.txt",
    type: "file",
    content: (
      <ul className="list-disc ml-6 py-1">
        {profile.certifications.map((c) => (
          <li key={c.id}>
            {c.title} — {c.issuer} ({c.year}) · <Link href={c.file}>view</Link> ·{" "}
            <Link href={c.url}>verify</Link>
          </li>
        ))}
      </ul>
    )
  }
];

export default terminal;
