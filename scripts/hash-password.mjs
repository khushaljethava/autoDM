// Prints an Argon2id hash for OWNER_PASSWORD_HASH. Run: npm run hash-password
import { createInterface } from "node:readline/promises";
import { hash } from "@node-rs/argon2";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Owner password (min 12 chars): ");
rl.close();
if (password.length < 12) {
  console.error("Too short.");
  process.exit(1);
}
console.log(`\nOWNER_PASSWORD_HASH='${await hash(password)}'`);
