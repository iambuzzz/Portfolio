import type { BearData } from "~/types";
import { profile } from "~/data/profile";

const { socials } = profile;

const aboutMe = `# ${profile.name}

**${profile.role}**  
📍 ${profile.location}

${profile.summary}

## Contact

- Email: [${profile.email}](mailto:${profile.email})
- GitHub: [@${profile.handle}](${socials.github})
- LinkedIn: [${profile.name}](${socials.linkedin})
- LeetCode: [iambuzz](${socials.leetcode})
- CodeChef: [iambuzz](${socials.codechef})
- Codolio: [iambuzz](${socials.codolio})

## Résumé

[Download my résumé (PDF)](${profile.resumeDownload})
`;

const education = `# Education

${profile.education
  .map(
    (e) => `## ${e.school}

${e.place}${e.period ? ` · ${e.period}` : ""}

${e.degree}

**${e.score}**`
  )
  .join("\n\n")}
`;

const skills = `# Technical Skills

${Object.entries(profile.skills)
  .map(([group, items]) => `## ${group}\n\n${items.map((i) => `\`${i}\``).join(" ")}`)
  .join("\n\n")}
`;

const achievements = `# Achievements

${profile.achievements.map((a) => `- ${a}`).join("\n")}

Profiles: [LeetCode](${socials.leetcode}) · [CodeChef](${socials.codechef}) · [Codolio](${socials.codolio})
`;

const certifications = `# Courses & Certifications

${profile.certifications
  .map(
    (c) => `## ${c.title}

${c.issuer} · ${c.year}

[![${c.title}](${c.preview})](${c.file})

[Open certificate](${c.file}) · [Verify original](${c.url})`
  )
  .join("\n\n")}
`;

const interests = `# Interests

${profile.interests.map((i) => `- **${i.title}:** ${i.text}`).join("\n")}
`;

const aboutSite = `# About This Site

My portfolio, built as a macOS Tahoe desktop that runs in the browser.

Built with React, TypeScript, Zustand, UnoCSS, Framer Motion and Vite, and deployed on Vercel.

Try the **Terminal** (\`help\`, \`whoami\`, \`open devtinder\`) or ask **Siri** about me.
`;

const bear: BearData[] = [
  {
    id: "profile",
    title: "Profile",
    icon: "i-ph:user-circle",
    md: [
      { id: "about-me", title: "About Me", icon: "i-ph:hand-waving", excerpt: profile.role, content: aboutMe },
      {
        id: "education",
        title: "Education",
        icon: "i-ph:graduation-cap",
        excerpt: `${profile.education[0].degree}, IIIT Kota`,
        content: education
      },
      {
        id: "skills",
        title: "Skills",
        icon: "i-ph:code",
        excerpt: "Languages, frameworks, databases and tools I work with.",
        content: skills
      },
      {
        id: "achievements",
        title: "Achievements",
        icon: "i-ph:trophy",
        excerpt: profile.achievements[0],
        content: achievements
      },
      {
        id: "certifications",
        title: "Certifications",
        icon: "i-ph:certificate",
        excerpt: profile.certifications.map((c) => c.issuer).join(" · "),
        content: certifications
      },
      {
        id: "interests",
        title: "Interests",
        icon: "i-ph:music-notes",
        excerpt: profile.interests.map((i) => i.title).join(", "),
        content: interests
      },
      {
        id: "about-site",
        title: "About This Site",
        icon: "i-ph:browser",
        excerpt: "How this portfolio is built.",
        content: aboutSite
      }
    ]
  },
  {
    id: "project",
    title: "Projects",
    icon: "i-ph:git-branch",
    md: profile.projects.map((p) => ({
      id: `project-${p.id}`,
      title: p.name,
      icon: "i-ph:rocket-launch",
      excerpt: p.tagline,
      link: p.github,
      content: `# ${p.name}

${p.tagline}

**Stack:** ${p.stack.join(" · ")}  
**Date:** ${p.date}

[Live demo](${p.live}) · [GitHub](${p.github})

## Highlights

${p.highlights.map((h) => `- ${h}`).join("\n")}
${p.screenshots.length ? `\n## Screenshots\n\n${p.screenshots.map((s) => `![${p.name}: ${s.caption}](${s.src})\n*${s.caption}*`).join("\n\n")}\n` : ""}`
    }))
  }
];

export default bear;
