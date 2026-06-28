import { defineConfig } from "vite";
import { fileURLToPath, URL } from "url";

const page = (name) => fileURLToPath(new URL(name, import.meta.url));

// WSL2 + /mnt/c (Windows drive) doesn't reliably fire inotify events,
// so Vite's watcher misses file edits without polling.
export default defineConfig({
  server: {
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: page("index.html"),
        services: page("services.html"),
        work: page("work.html"),
        about: page("about.html"),
        contact: page("contact.html"),
        notfound: page("404.html"),
        terms: page("terms.html"),
        privacy: page("privacy.html"),
        questionnaire: page("questionnaire.html"),
      },
    },
  },
});
