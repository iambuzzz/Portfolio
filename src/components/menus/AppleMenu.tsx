import React, { useRef, useState } from "react";
import { useClickOutside } from "~/hooks";
import { profile } from "~/data/profile";

// Lock, Sleep, Log Out, Restart and Force Quit are handled by the desktop
// shell (index.tsx / Desktop.tsx) through this event.
export type SystemCommand = "lock" | "sleep" | "logout" | "restart" | "forcequit";
export const systemCommand = (cmd: SystemCommand) => window.dispatchEvent(new CustomEvent("system:command", { detail: cmd }));

interface AppleMenuProps {
  shut: (e: React.MouseEvent<HTMLLIElement>) => void;
  toggleAppleMenu: () => void;
  openApp?: (id: string) => void;
  openAboutMac?: () => void;
  btnRef: React.RefObject<HTMLDivElement>;
}

export default function AppleMenu({
  shut,
  toggleAppleMenu,
  openApp,
  openAboutMac,
  btnRef
}: AppleMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, toggleAppleMenu, [btnRef]);

  const command = (cmd: SystemCommand) => () => {
    toggleAppleMenu();
    systemCommand(cmd);
  };
  const handleShut = () => {
    shut({ stopPropagation: () => {} } as React.MouseEvent<HTMLLIElement>);
    toggleAppleMenu();
  };

  const open = (id: string) => {
    toggleAppleMenu();
    openApp?.(id);
  };

  const handleAbout = () => {
    toggleAppleMenu();
    openAboutMac?.();
  };

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "3px 10px",
    fontSize: "13.5px",
    lineHeight: "18px",
    cursor: "default",
    borderRadius: "4px",
    transition: "background 0.05s ease, color 0.05s ease",
    userSelect: "none",
    margin: "1px 5px",
  };

  const MenuItem = ({ children, onClick, hint }: { children: React.ReactNode; onClick?: () => void; hint?: string }) => {
    const [hovered, setHovered] = useState(false);
    return (
      <div
        className="text-black dark:text-white"
        style={{
          ...itemStyle,
          background: hovered ? "var(--accent-blue)" : "transparent",
          color: hovered ? "#fff" : "inherit",
        }}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span>{children}</span>
        {hint && (
          <span style={{ fontSize: "12px", opacity: hovered ? 0.9 : 0.5, marginLeft: "auto", fontFamily: "var(--font-system)", letterSpacing: "1px" }}>
            {hint}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      ref={ref}
      className="menu-box"
      style={{
        position: "fixed",
        top: "28px",
        left: "8px",
        width: "240px",
        padding: "5px 0",
        zIndex: 9999,
        fontFamily: "var(--font-system)",
        fontWeight: 400,
      }}
    >
      <MenuItem onClick={handleAbout}>About This Mac</MenuItem>
      <div className="h-px bg-gray-300 dark:bg-white/10 my-1 mx-2" />
      <MenuItem onClick={() => open("system-settings")}>System Settings...</MenuItem>
      <div className="h-px bg-gray-300 dark:bg-white/10 my-1 mx-2" />
      <MenuItem onClick={command("forcequit")}>Force Quit...</MenuItem>
      <div className="h-px bg-gray-300 dark:bg-white/10 my-1 mx-2" />
      <MenuItem onClick={command("sleep")}>Sleep</MenuItem>
      <MenuItem onClick={command("restart")}>Restart...</MenuItem>
      <MenuItem onClick={handleShut}>Shut Down...</MenuItem>
      <div className="h-px bg-gray-300 dark:bg-white/10 my-1 mx-2" />
      <MenuItem onClick={command("lock")}>Lock Screen</MenuItem>
      <MenuItem onClick={command("logout")}>Log Out {profile.firstName}...</MenuItem>
    </div>
  );
}
