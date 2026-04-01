import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const outDir = resolve(root, "dist");
const watchMode = process.argv.includes("--watch");

const sharedBuildOptions = {
  entryPoints: [resolve(root, "src/content/index.ts")],
  outfile: resolve(outDir, "content.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome114", "firefox115"],
  sourcemap: true,
  logLevel: "info"
};

function prepareOutputDirectory() {
  mkdirSync(outDir, { recursive: true });
  cpSync(resolve(root, "public/manifest.json"), resolve(outDir, "manifest.json"));
}

if (!watchMode) {
  rmSync(outDir, { recursive: true, force: true });
  prepareOutputDirectory();
  await esbuild.build(sharedBuildOptions);
  console.log("Build complete: dist/");
} else {
  prepareOutputDirectory();
  const ctx = await esbuild.context(sharedBuildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
}
