import type { LaunchpadData } from "~/types";
import { profile } from "~/data/profile";

// Projects open in Safari.
const launchpadApps: LaunchpadData[] = profile.projects.map((p) => ({
  id: p.id,
  title: p.name,
  img: p.logo,
  link: p.live
}));

export default launchpadApps;
