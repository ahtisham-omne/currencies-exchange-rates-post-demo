/* Opt-in run: `npm run test:parity`. Runs the module-import parity test
 * (src/test/module-import-validation.parity.ts), which loads the home repos'
 * own validators from the sibling checkouts (radiant-core-fusion,
 * nimble-palette, partner-management-module) next to role-zen's vendored
 * copies. The default `vitest run` never touches the sibling repos.
 *
 * "@/" resolves against the importing file's own repo: role-zen's src for
 * role-zen files, the sibling repo's src for a file of that repo. */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const ROLE_ZEN = path.resolve(__dirname).split(path.sep).join("/");
const SIBLINGS = path.resolve(__dirname, "..").split(path.sep).join("/");
function repoRelativeAlias() {
  return {
    name: "repo-relative-alias",
    enforce: "pre" as const,
    async resolveId(this: { resolve: (s: string, i?: string, o?: { skipSelf?: boolean }) => Promise<unknown> }, source: string, importer?: string) {
      if (!source.startsWith("@/") || !importer) return null;
      const imp = importer.split(path.sep).join("/");
      const sibling = !imp.startsWith(`${ROLE_ZEN}/`) && imp.startsWith(`${SIBLINGS}/`);
      const root = sibling ? `${SIBLINGS}/${imp.slice(SIBLINGS.length + 1).split("/")[0]}` : ROLE_ZEN;
      return this.resolve(`${root}/src/${source.slice(2)}`, importer, { skipSelf: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), repoRelativeAlias()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.parity.ts"],
  },
});
