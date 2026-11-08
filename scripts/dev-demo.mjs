import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const config = readFileSync(new URL("../../finmotor_backend/.env.demo", import.meta.url), "utf8");
const values = Object.fromEntries(config.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
  const position = line.indexOf("="); return [line.slice(0, position), line.slice(position + 1)];
}));
if (!values.DEMO_SERVICE_KEY || !values.DEMO_BACKEND_SECRET) throw new Error("Primero genera finmotor_backend/.env.demo");
const root = fileURLToPath(new URL("../", import.meta.url));
const child = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "dev", "--webpack", "-p", "3012", "--hostname", "127.0.0.1"], {
  cwd: root, stdio: "inherit", env: { ...process.env,
    FINMOTOR_DEMO_MODE: "true", BACKEND_API_URL: "http://localhost:8108",
    FINMOTOR_SERVICE_KEY: values.DEMO_SERVICE_KEY, FINMOTOR_BACKEND_SECRET: values.DEMO_BACKEND_SECRET,
    NEXT_PUBLIC_API_ORIGIN: "http://localhost:8108", NEXT_PUBLIC_MEDIA_ORIGIN: "http://localhost:9198",
    NEXT_PUBLIC_WEB_BASE_URL: "http://localhost:3012", NEXT_TELEMETRY_DISABLED: "1",
  },
});
child.on("exit", (code) => process.exit(code ?? 1));
