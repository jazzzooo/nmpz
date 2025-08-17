import { writable } from "svelte/store";

export const iconNames = ["waifu.ico", "cactus.ico", "egg.ico", "goose.ico", "octopus.ico"];
export const selectedIcon = writable<string>("waifu.ico");
type SolvedChallenges = Record<string, { share: string; shareIndex: number; difficulty?: string }>;
const storedData = localStorage.getItem("nmpz-solved-challenges");
export const solvedChallenges = writable<SolvedChallenges>(storedData ? JSON.parse(storedData) : {});

export const reconstructedFlags = writable<Record<string, string>>({});

// Helper function to convert hex string to Uint8Array
const fromHex = (hex: string): Uint8Array => new Uint8Array(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));

async function reconstructFlags(solvedChallenges: SolvedChallenges) {
  try {
    const [levels, challs] = await Promise.all([
      fetch("/levels.json").then((r) => r.json()),
      fetch("/challs.json").then((r) => r.json()),
    ]);

    // Group challenges by difficulty
    const challengesByDifficulty: Record<string, SolvedChallenges[string][]> = {};

    for (const [name, data] of Object.entries(solvedChallenges)) {
      const difficulty = data.difficulty || findDifficulty(name, challs);
      if (!difficulty) continue;

      if (!challengesByDifficulty[difficulty]) challengesByDifficulty[difficulty] = [];
      challengesByDifficulty[difficulty].push(data);
    }

    // Reconstruct flags for each difficulty
    const flags: Record<string, string> = {};
    const { combine } = await import("shamir-secret-sharing");

    for (const [difficulty, challenges] of Object.entries(challengesByDifficulty)) {
      const levelConfig = levels[difficulty];
      if (!levelConfig || challenges.length < levelConfig.threshold) continue;

      try {
        // Convert shares to bytes and reconstruct key
        const shareBytes = challenges.slice(0, levelConfig.threshold).map((challenge) => fromHex(challenge.share));

        const key = await combine(shareBytes);

        // Decrypt flag
        const iv = fromHex(levelConfig.iv);
        const ciphertext = fromHex(levelConfig.ciphertext);

        const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["decrypt"]);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, ciphertext);

        // Remove padding and decode
        const decryptedArray = new Uint8Array(decrypted);
        const paddingLength = decryptedArray[decryptedArray.length - 1];
        const unpaddedArray = decryptedArray.slice(0, -paddingLength);

        flags[difficulty] = new TextDecoder().decode(unpaddedArray);
      } catch {
        // Failed to reconstruct flag
      }
    }

    return flags;
  } catch {
    return {};
  }
}

// Helper to find difficulty when not stored
function findDifficulty(challengeName: string, challs: any): string | null {
  for (const [difficulty, challenges] of Object.entries(challs)) {
    if ((challenges as any[]).find((c: any) => c.name === challengeName)) {
      return difficulty;
    }
  }
  return null;
}

// Update reconstructed flags when solved challenges change
solvedChallenges.subscribe(async (solved) => {
  const flags = await reconstructFlags(solved);
  reconstructedFlags.set(flags);
});

// Initialize flags on load if there are solved challenges
if (storedData) {
  const initialSolved = JSON.parse(storedData);
  reconstructFlags(initialSolved).then((flags) => reconstructedFlags.set(flags));
}

export function markSolved(challengeName: string, share: string, shareIndex: number, difficulty?: string) {
  solvedChallenges.update((solved) => {
    const updated = { ...solved, [challengeName]: { share, shareIndex, difficulty } };
    localStorage.setItem("nmpz-solved-challenges", JSON.stringify(updated));
    return updated;
  });
}
export function isSolved(challengeName: string, solved: SolvedChallenges) {
  return challengeName in solved;
}
