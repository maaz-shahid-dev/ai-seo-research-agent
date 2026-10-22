/** Top-level screens. Kept outside client components so server code can validate links against it. */
export const APP_VIEWS = ["research", "ideas", "history", "projects", "settings"] as const;
export type AppView = (typeof APP_VIEWS)[number];
