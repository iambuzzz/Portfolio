// Single source of truth for everything personal on the site.
// Every app (Terminal, Bear, Finder, Siri, Safari, Launchpad, ...) reads from here.
// Content comes from Ambuj's résumé — don't add anything that isn't on it.

export interface Project {
  id: string;
  name: string;
  tagline: string;
  date: string;
  stack: string[];
  github: string;
  live: string;
  highlights: string[];
  /** App icon under public/projects/<id>/. */
  logo: string;
  /** Screenshots under public/projects/<id>/: `n.webp` (1600px) plus `n-thumb.webp` (480px). */
  screenshots: Screenshot[];
}

export interface Screenshot {
  src: string;
  caption: string;
}

/** The small version of a project screenshot, for grids and file icons. */
export const thumbOf = (src: string) => src.replace(/\.webp$/, "-thumb.webp");

const shots = (id: string, captions: string[]): Screenshot[] =>
  captions.map((caption, i) => ({ src: `/projects/${id}/${i + 1}.webp`, caption }));

export interface Certification {
  id: string;
  title: string;
  issuer: string;
  year: number;
  /** Original verification link (Google Drive). */
  url: string;
  /** Unmodified local copy under public/certificates. */
  file: string;
  /** Rendered preview image for fast display. */
  preview: string;
}

export const profile = {
  name: "Ambuj Jaiswal",
  firstName: "Ambuj",
  handle: "iambuzzz",
  role: "Software Engineer | Full-Stack Developer | DSA & System Design Enthusiast",
  location: "Kota, Rajasthan, India",
  /** Replace with the real photo once provided (public/img/ui/…). */
  avatar: "/img/Profile/avatar.jpg",
  /** Google Drive. Update it there with "Manage versions" and this link keeps working. */
  resume: "https://drive.google.com/file/d/1IJ2_cZDjH5wiw7GpG40k3QXP9qb9HzTY/view?usp=drive_link",
  /** Direct download of the same Drive file. */
  resumeDownload: "https://drive.google.com/uc?export=download&id=1IJ2_cZDjH5wiw7GpG40k3QXP9qb9HzTY",
  resumeFileName: "Ambuj_Jaiswal_Resume.pdf",

  email: "ambujjais1@gmail.com",
  collegeEmail: "2023kucp1048@iiitkota.ac.in",
  phone: "+91-9793409528",
  /** Phone numbers on public sites get scraped by spammers; opt in explicitly. */
  showPhone: false,

  socials: {
    github: "https://github.com/iambuzzz",
    linkedin: "https://www.linkedin.com/in/ambuj-jaiswal-68385a290",
    codolio: "https://codolio.com/profile/iambuzz",
    leetcode: "https://leetcode.com/u/iambuzz/",
    codechef: "https://www.codechef.com/users/iambuzz"
  },

  summary:
    "Computer Science undergraduate at IIIT Kota, graduating in 2027, with strong foundations in Data Structures & Algorithms, software engineering, and system design. Passionate about building scalable and production-oriented applications, with hands-on experience developing full-stack products and designing real-time, distributed, and event-driven systems.",

  education: [
    {
      school: "Indian Institute of Information Technology Kota (IIIT Kota)",
      place: "Kota, Rajasthan",
      degree: "Bachelor of Technology in Computer Science and Engineering",
      period: "Aug 2023 – Aug 2027",
      score: "CGPA: 7.58 / 10 (till 6th semester)"
    },
    {
      school: "Jagat Taran Golden Jubilee School (CBSE)",
      place: "Prayagraj, Uttar Pradesh",
      degree: "Class 10 & 12",
      period: "",
      score: "10th: 91.4% · 12th: 84.2%"
    }
  ],

  projects: [
    {
      id: "devtinder",
      name: "DevTinder",
      tagline:
        "A scalable social networking platform with distributed real-time communication and an event-driven backend architecture.",
      date: "Jan 2026",
      stack: ["MERN", "Kafka", "gRPC", "Redis", "AWS", "Nginx", "Redux Toolkit"],
      github: "https://github.com/iambuzzz/DevTinder",
      live: "https://devtinder.iambuzzdev.in/",
      highlights: [
        "Architected a horizontally scalable platform behind an Nginx Load Balancer, integrating Razorpay for subscriptions, AWS S3 for media storage, and Redux Toolkit for global state.",
        "Engineered a distributed real-time chat across multiple Node.js nodes, utilizing Redis for centralized sessions and gRPC for low-latency, cross-server message routing.",
        "Transitioned to an Event-Driven Architecture with Apache Kafka, ensuring message durability via offline queues, and optimizing online presence tracking by reducing O(N²) broadcast overheads to O(1) targeted events.",
        "Streamlined operations by offloading emails (AWS SES) to a Bull (Redis) background queue, and deployed on AWS EC2 with PM2 & Cloudflare SSL for high availability."
      ],
      logo: "/projects/devtinder/logo.png",
      screenshots: shots("devtinder", ["Landing page", "Swipe feed", "Connections", "Messages", "Real-time chat", "Gold membership"])
    },
    {
      id: "buddyboard",
      name: "BuddyBoard",
      tagline:
        "A real-time collaborative productivity platform for managing tasks, goals, notes and shared progress.",
      date: "Feb 2026",
      stack: ["Next.js", "Tailwind CSS", "Firebase Firestore", "Framer Motion", "Recharts"],
      github: "https://github.com/iambuzzz/BuddyBoard",
      live: "https://buddy-board-one.vercel.app/",
      highlights: [
        "Developed a real-time productivity app using Next.js and Firebase Firestore, engineering live data sync for a secure user pairing and group collaboration via a custom invitation system.",
        "Developed categorized task management featuring real-time timers (Deep Work, Growth, Chores), and visualized user progress trends using interactive Recharts with brush-based time filtering.",
        "Integrated engagement drivers including an auto-saving notes editor, goal tracking, and a streak system, managing complex client-side state across dynamic UI components.",
        "Designed a polished, theme-aware UI with Tailwind CSS and Framer Motion, implementing engaging animations (card-flips, overlays) and a highly responsive dark mode."
      ],
      logo: "/projects/buddyboard/logo.svg",
      screenshots: shots("buddyboard", ["Daily tasks with timers", "Study stats: trend", "Study stats: daily hours", "Goals", "Auto-saving notes"])
    },
    {
      id: "foodiehub",
      name: "FoodieHub",
      tagline:
        "A Swiggy-inspired food ordering web application with cart management, responsive UI and cross-device synchronization.",
      date: "Aug 2025",
      stack: ["React", "Vite", "Redux Toolkit", "Tailwind CSS", "Firebase Firestore", "Vitest", "React Testing Library"],
      github: "https://github.com/iambuzzz/FoodieHub",
      live: "https://foodie-hub-blue-ten.vercel.app/",
      highlights: [
        "Built a Swiggy-like food ordering app using React, Vite, and Redux Toolkit, managing cart workflows, quantity updates, dynamic bill calculation, and reusable custom hooks.",
        "Engineered cross-device cart sync via Firebase Firestore with debounced updates (500ms); structured high-fidelity custom JSON datasets emulating Swiggy's nested API schema.",
        "Optimized bundle size via dynamic code splitting (React.lazy & Suspense) for sub-pages, and utilized Higher-Order Components (HOC) to badge promoted restaurants.",
        "Designed a responsive UI with Tailwind CSS featuring category accordions, instant search, and rating filters; authored component tests using Vitest and React Testing Library."
      ],
      logo: "/projects/foodiehub/logo.png",
      screenshots: shots("foodiehub", ["Restaurants", "Restaurant menu", "Menu category", "Cart", "About", "Contact"])
    }
  ] satisfies Project[],

  skills: {
    "Core CS": ["Data Structures & Algorithms", "OOPs", "DBMS", "System Design (HLD)"],
    Languages: ["C", "Java", "Python", "JavaScript", "TypeScript"],
    "Frameworks & Libraries": [
      "React.js", "Next.js", "Node.js", "Express.js", "Tailwind CSS", "Shadcn UI", "Redux Toolkit",
      "Zustand", "TanStack React Query", "Socket.io", "Better Auth", "Clerk"
    ],
    "Databases & ORMs": ["MongoDB", "MySQL", "PostgreSQL", "Redis", "Prisma", "Drizzle"],
    "Tools, Platform & Architecture": ["Git", "GitHub", "Postman", "Linux", "Docker", "Cloudinary", "AWS", "Kafka", "gRPC", "Microservices"],
    "AI-Assisted Development": ["Claude Code", "Google Antigravity", "Firebase Studio", "Gemini"]
  } as Record<string, string[]>,

  certifications: [
    {
      id: "delta",
      title: "Delta 5.0 – Full Stack Web Development (MERN Stack)",
      issuer: "Apna College",
      year: 2024,
      url: "https://drive.google.com/file/d/1a_QWd0-gJQJv3ltGnCM5iO6dS4mv2CEi/view?usp=sharing",
      file: "/certificates/delta-5-apna-college.pdf",
      preview: "/certificates/delta-5-apna-college-preview.webp"
    },
    {
      id: "sheryians",
      title: "Job Ready AI-Powered Cohort: Web Development + DSA + Aptitude",
      issuer: "Sheryians Coding School",
      year: 2025,
      url: "https://drive.google.com/file/d/1iVGbXv9hiK4ZnCfi5Wx2x3RnAu8YwfYt/view?usp=sharing",
      file: "/certificates/sheryians-job-ready-cohort.pdf",
      preview: "/certificates/sheryians-job-ready-cohort-preview.webp"
    },
    {
      id: "udemy",
      title: "Complete React and NextJS Course",
      issuer: "Udemy",
      year: 2026,
      url: "https://drive.google.com/file/d/1affSRv7XHQnJD_84FjgpJWnBz4Sw0Twe/view?usp=sharing",
      file: "/certificates/udemy-react-nextjs.jpg",
      preview: "/certificates/udemy-react-nextjs-preview.webp"
    }
  ] satisfies Certification[],

  achievements: [
    "Solved 600+ Data Structures and Algorithms problems across platforms.",
    "CodeChef: 2-star, max rating 1585.",
    "LeetCode: max rating 1830."
  ],

  interests: [
    { title: "Problem Solving", text: "Enjoy solving DSA problems to strengthen logical thinking and coding efficiency." },
    { title: "Web Development", text: "Interested in building scalable full-stack applications and exploring modern web architectures." },
    { title: "System Design", text: "Exploring high-level design, real-time event-driven architectures, microservices and scalable backend infrastructure." },
    { title: "Music", text: "Singing, playing guitar and piano." },
    { title: "Spirituality", text: "Meditation." }
  ]
};

export type Profile = typeof profile;

/** Plain-text résumé used as Siri's knowledge. */
export function profileAsText(p: Profile = profile): string {
  const lines = [
    `${p.name} — ${p.role}. Based in ${p.location}.`,
    p.summary,
    "",
    "Education:",
    ...p.education.map((e) => `- ${e.school}, ${e.place}. ${e.degree}${e.period ? `, ${e.period}` : ""}. ${e.score}`),
    "",
    "Projects:",
    ...p.projects.map(
      (pr) => `- ${pr.name} (${pr.date}; ${pr.stack.join(", ")}): ${pr.tagline} Live: ${pr.live} GitHub: ${pr.github}\n  ${pr.highlights.join("\n  ")}`
    ),
    "",
    "Skills:",
    ...Object.entries(p.skills).map(([k, v]) => `- ${k}: ${v.join(", ")}`),
    "",
    "Certifications:",
    ...p.certifications.map((c) => `- ${c.title}, ${c.issuer} (${c.year})`),
    "",
    "Achievements:",
    ...p.achievements.map((a) => `- ${a}`),
    "",
    "Interests:",
    ...p.interests.map((i) => `- ${i.title}: ${i.text}`),
    "",
    `Contact: email ${p.email}; GitHub ${p.socials.github}; LinkedIn ${p.socials.linkedin}; LeetCode ${p.socials.leetcode}; CodeChef ${p.socials.codechef}; Codolio ${p.socials.codolio}`
  ];
  return lines.join("\n");
}
