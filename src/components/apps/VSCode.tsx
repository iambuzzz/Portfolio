import { profile } from "~/data/profile";

// Browse the flagship project's source in a web VS Code (github1s).
export default function VSCode() {
  return (
    <iframe
      className="size-full bg-[#202020]"
      src={profile.projects[0].github.replace("github.com", "github1s.com")}
      title="VSCode"
    />
  );
}
