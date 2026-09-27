import type { WebsitesData } from "~/types";
import { profile } from "~/data/profile";

const { socials } = profile;

const websites: WebsitesData = {
  favorites: {
    title: "Find Me Online",
    sites: [
      { id: "my-email", title: "Email", img: "img/sites/gmail.svg", link: `mailto:${profile.email}` },
      { id: "my-github", title: "GitHub", img: "img/sites/github.svg", link: socials.github },
      { id: "my-linkedin", title: "LinkedIn", img: "img/sites/linkedin.svg", link: socials.linkedin },
      { id: "my-leetcode", title: "LeetCode", img: "img/sites/leetcode.svg", link: socials.leetcode },
      { id: "my-codechef", title: "CodeChef", img: "img/sites/codechef.svg", link: socials.codechef },
      { id: "my-codolio", title: "Codolio", img: "img/sites/codolio.svg", link: socials.codolio }
    ]
  },
  freq: {
    title: "My Projects",
    sites: profile.projects.map((p) => ({
      id: `site-${p.id}`,
      title: p.name,
      img: `img/icons/projects/${p.id}.svg`,
      link: p.live
    }))
  }
};

export default websites;
