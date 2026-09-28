/// <reference types="vite/client" />

import type { AttributifyAttributes } from "unocss/preset-attributify";

declare module "react" {
  /* eslint-disable-next-line @typescript-eslint/no-empty-interface */
  interface HTMLAttributes<T> extends AttributifyAttributes {}
}

declare global {
  /** Injected by vite.config.ts (Settings › About). */
  const __BUILD_INFO__: {
    commit: string;
    builtAt: string;
  };
}
