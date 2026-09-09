/**
 * One-time interactive Garmin login. Run it yourself (never in CI):
 *
 *   npx tsx scripts/garmin-login.ts
 *
 * It prompts for your Garmin email + password, performs the OAuth exchange,
 * and writes long-lived tokens (~1 year) to .garmin-tokens.json (gitignored).
 * The password itself is never persisted anywhere.
 *
 * Then, for production: copy the file's contents into a GARMIN_TOKENS env var
 * on Vercel. Local dev reads the file directly.
 */
import { writeFileSync } from "fs";
import { createInterface } from "readline/promises";
import { GarminConnect } from "garmin-connect";

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = await rl.question("Garmin email: ");
  const password = await rl.question("Garmin password: ");
  rl.close();

  const client = new GarminConnect({ username: email.trim(), password });
  await client.login();
  const tokens = client.exportToken();

  writeFileSync(".garmin-tokens.json", JSON.stringify(tokens, null, 2));
  console.log("\nTokens written to .garmin-tokens.json (gitignored).");
  console.log(
    "For production, add the file's contents as the GARMIN_TOKENS env var on Vercel:",
  );
  console.log("  npx vercel env add GARMIN_TOKENS  (paste the JSON)");
}

main().catch((error) => {
  console.error("\nLogin failed:", error?.message ?? error);
  console.error(
    "If your account uses two-factor auth, disable it temporarily or mint tokens with garth (python) instead.",
  );
  process.exit(1);
});
