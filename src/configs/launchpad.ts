import type { LaunchpadData } from "~/types";
import { profile } from "~/data/profile";

// Projects open in Safari. Icons are placeholders until real ones are supplied.
const launchpadApps: LaunchpadData[] = profile.projects.map((p) => ({
  id: p.id,
  title: p.name,
  img: `img/icons/projects/${p.id}.svg`,
  link: p.live
}));

export default launchpadApps;
