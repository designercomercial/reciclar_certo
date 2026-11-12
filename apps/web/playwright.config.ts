import { defineConfig, devices } from "@playwright/test";

const PORTA = 3112;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    ...devices["Pixel 5"],
    browserName: "chromium",
    serviceWorkers: "allow",
  },
  webServer: {
    // Build de produção (com as fotos de exemplo) + API com IA mock servindo /reciclar/.
    command: "pnpm run build && pnpm --filter @ecoponto/api exec tsx src/server.ts --pessoa=cidadao-ana --jogo",
    url: `http://127.0.0.1:${PORTA}/reciclar/`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PORT: String(PORTA), NODE_ENV: "test", ECO_IA_MOCK_ATRASO_MS: "400", VITE_FOTOS_EXEMPLO: "1" },
  },
});
