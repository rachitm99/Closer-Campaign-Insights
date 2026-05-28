import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Ignore the archived web/ copy so root-level tooling only targets the app at the repository root.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "web/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;