#!/usr/bin/env bun

import { webcrypto } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { latLngToCell } from "h3-js";
import { split } from "shamir-secret-sharing";

const FLAGS = {
  easy: "idek{f4k3_m3t45_ce6362bd242f34}",
  hard: "idek{n0_m3t45_d1742ae5ae1e1f21}",
};

// Helper functions
const randomBytes = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  webcrypto.getRandomValues(bytes);
  return bytes;
};

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string): Uint8Array => new Uint8Array(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));

const pad = (data: Uint8Array, blockSize: number): Uint8Array => {
  const padding = blockSize - (data.length % blockSize);
  const padded = new Uint8Array(data.length + padding);
  padded.set(data);
  padded.fill(padding, data.length);
  return padded;
};

const computeArgon2 = async (password: string, salt: string, timeCost: number): Promise<string> => {
  const { hash } = await import("argon2-wasm");
  const result = await hash({
    pass: password,
    salt: salt.padEnd(8, "0"),
    time: timeCost,
    mem: 262144,
    parallelism: 1,
    hashLen: 16,
    type: 0, // Argon2d
  });
  return toHex(new Uint8Array(result.hash));
};

const encryptAES = async (key: Uint8Array, data: Uint8Array): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> => {
  const iv = randomBytes(16);
  const cryptoKey = await webcrypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt"]);
  const encrypted = await webcrypto.subtle.encrypt({ name: "AES-CBC", iv }, cryptoKey, pad(data, 16));
  return { iv, ciphertext: new Uint8Array(encrypted) };
};

async function verifyFlagReconstruction(levels: any, solutions: any) {
  console.log("\nVerifying flag reconstruction...");
  const { combine } = await import("shamir-secret-sharing");

  for (const [difficulty, levelConfig] of Object.entries(levels) as [string, any][]) {
    const challenges = solutions[difficulty];
    const shareBytes = challenges.slice(0, levelConfig.threshold).map((challenge: any) => fromHex(challenge.share));

    // Reconstruct key and decrypt flag
    const key = await combine(shareBytes);
    const iv = fromHex(levelConfig.iv);
    const ciphertext = fromHex(levelConfig.ciphertext);

    const cryptoKey = await webcrypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["decrypt"]);
    const decrypted = await webcrypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, ciphertext);

    // Remove padding and decode
    const decryptedArray = new Uint8Array(decrypted);
    const paddingLength = decryptedArray[decryptedArray.length - 1];
    const unpaddedArray = decryptedArray.slice(0, -paddingLength);
    const flag = new TextDecoder().decode(unpaddedArray);

    const expected = FLAGS[difficulty as keyof typeof FLAGS];
    const success = flag === expected;
    console.log(`${success ? "✅" : "❌"} ${difficulty}: ${flag}`);
  }
}

async function main() {
  console.log("Reading input files...");
  const levels = JSON.parse(readFileSync("static/levels.json", "utf-8"));
  const solutions = JSON.parse(readFileSync("solutions.json", "utf-8"));

  const challs: any = { easy: [], hard: [] };

  for (const [difficulty, levelConfig] of Object.entries(levels) as [string, any][]) {
    console.log(`Processing ${difficulty} challenges...`);
    const challenges = solutions[difficulty];

    // Generate and encrypt flag
    const flagKey = randomBytes(16);
    const flagText = FLAGS[difficulty as keyof typeof FLAGS];
    const { iv: flagIv, ciphertext: flagCiphertext } = await encryptAES(flagKey, new TextEncoder().encode(flagText));

    levels[difficulty].iv = toHex(flagIv);
    levels[difficulty].ciphertext = toHex(flagCiphertext);

    // Split flag key using Shamir's Secret Sharing
    const shares = await split(flagKey, challenges.length, levelConfig.threshold);

    for (let i = 0; i < challenges.length; i++) {
      const challenge = challenges[i];
      const shareIndex = i + 1;

      // Compute challenge validation data
      const h3Index = latLngToCell(challenge.lat, challenge.lng, levelConfig.resolution);
      const argon2Hash = await computeArgon2(h3Index, challenge.name, levelConfig.t);
      const sha256Hash = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(argon2Hash));

      // Update solution data
      Object.assign(challenge, {
        h3Index,
        argon2: argon2Hash,
        shareIndex,
        share: toHex(shares[i]),
      });

      // Encrypt share for public challenges
      const { iv, ciphertext } = await encryptAES(fromHex(argon2Hash), shares[i]);
      challs[difficulty].push({
        name: challenge.name,
        sha256: toHex(new Uint8Array(sha256Hash)),
        shareIndex,
        iv: toHex(iv),
        ciphertext: toHex(ciphertext),
      });
    }
  }

  console.log("Writing output files...");
  writeFileSync("static/challs.json", JSON.stringify(challs, null, 2));
  writeFileSync("static/levels.json", JSON.stringify(levels, null, 2));
  writeFileSync("solutions.json", JSON.stringify(solutions, null, 2));

  console.log("CTF build complete!");

  // Verify flag reconstruction works
  await verifyFlagReconstruction(levels, solutions);
}

main().catch(console.error);
