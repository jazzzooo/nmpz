<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { selectedIcon, solvedChallenges, markSolved, isSolved } from "$lib/stores/gameState";
  import { get } from "svelte/store";
  import { page } from "$app/stores";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import { latLngToCell, cellToBoundary } from "h3-js";

  const challengeName = $page.params.slug;
  const h2b = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)));
  const b2h = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

  let challengeData: any = $state(null),
    levelData: any = $state(null),
    challengeDifficulty: string = $state("");
  let coords: number[] = $state([]),
    result = $state(""),
    submitting = $state(false);
  let pano: HTMLElement,
    map: HTMLElement,
    container: HTMLElement,
    leaflet: L.Map,
    pannellumViewer: any,
    marker: any,
    h3Cell: any;

  async function loadData() {
    try {
      const [challs, levels] = await Promise.all([
        fetch("/challs.json").then((r) => r.json()),
        fetch("/levels.json").then((r) => r.json()),
      ]);
      for (const [diff, challenges] of Object.entries(challs)) {
        const challenge = (challenges as any[]).find((c: any) => c.name === challengeName);
        if (challenge) {
          challengeData = challenge;
          levelData = levels[diff];
          challengeDifficulty = diff;
          return;
        }
      }
      goto("/");
    } catch {
      goto("/");
    }
  }

  function setupMap() {
    leaflet = L.map(map, { center: [0, 0], zoom: 1, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(leaflet);
    leaflet.on("click", (e: any) => {
      [marker, h3Cell].forEach((layer) => layer && leaflet.removeLayer(layer));
      const { lat, lng } = e.latlng,
        h3Index = latLngToCell(lat, lng, levelData.resolution);
      marker = L.marker([lat, lng], {
        icon: L.icon({ iconUrl: `/img/icons/${get(selectedIcon)}`, iconSize: [32, 32], iconAnchor: [16, 16] }),
      }).addTo(leaflet);
      h3Cell = L.polygon(cellToBoundary(h3Index), { color: "#3b82f6", weight: 2, fillOpacity: 0.1 }).addTo(leaflet);
      coords = [lat, lng];
    });
  }

  async function setupPanorama() {
    // Wait for Pannellum to be available
    if (!(window as any).pannellum) {
      const script = document.querySelector('script[src="/lib/pannellum/pannellum.js"]');
      if (script) {
        await new Promise((resolve) => {
          script.addEventListener("load", resolve, { once: true });
        });
      }
    }

    const config = await fetch(`/panoramas/${challengeName}/config.json`).then((r) => r.json());
    pannellumViewer = (window as any).pannellum.viewer(pano, {
      type: "multires",
      multiRes: { basePath: `/panoramas/${challengeName}`, path: "/%l/%s%y_%x", extension: "avif", ...config.multiRes },
      autoLoad: true,
    });
  }

  onMount(() => {
    loadData();
    setupMap();
    setupPanorama();
    const ro = new ResizeObserver(() => leaflet?.invalidateSize());
    ro.observe(container);
    return () => {
      ro.disconnect();
      pannellumViewer?.destroy();
    };
  });

  async function submit() {
    if (!coords.length || !challengeData || !levelData) return;
    submitting = true;
    try {
      const h3Index = latLngToCell(coords[0], coords[1], levelData.resolution);
      const argon2Hash = await new Promise<string>((resolve, reject) => {
        const worker = new Worker("/argon2-worker.js");
        worker.onmessage = (e) => (
          worker.terminate(),
          e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.hash)
        );
        worker.onerror = (error) => (worker.terminate(), reject(error));
        worker.postMessage({
          password: h3Index,
          salt: (challengeName || "").padEnd(8, "0"),
          time: levelData.t,
          mem: 262144,
          parallelism: 1,
          hashLen: 16,
        });
      });
      const computedSha256 = b2h(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(argon2Hash)));
      if (computedSha256 === challengeData.sha256) {
        const key = await crypto.subtle.importKey("raw", h2b(argon2Hash), { name: "AES-CBC" }, false, ["decrypt"]);
        const decryptedData = await crypto.subtle.decrypt(
          { name: "AES-CBC", iv: h2b(challengeData.iv) },
          key,
          h2b(challengeData.ciphertext),
        );

        // Remove PKCS7 padding
        const decryptedArray = new Uint8Array(decryptedData);
        const paddingLength = decryptedArray[decryptedArray.length - 1];
        const unpaddedArray = decryptedArray.slice(0, decryptedArray.length - paddingLength);
        const decryptedShare = b2h(unpaddedArray.buffer);
        if (challengeName) markSolved(challengeName, decryptedShare, challengeData.shareIndex, challengeDifficulty);
        result = "✅ Correct! Challenge solved!";
      } else result = "❌ Incorrect location. Try again!";
    } catch (error) {
      result = `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    } finally {
      submitting = false;
    }
  }

  $effect(() => {
    const h = (e: KeyboardEvent) => e.code === "Space" && (e.preventDefault(), submit());
    return (document.addEventListener("keydown", h), () => document.removeEventListener("keydown", h));
  });

  $effect(() => {
    if (!result && challengeName && isSolved(challengeName, $solvedChallenges)) {
      result = "✅ Challenge already solved!";
    }
  });
</script>

<svelte:head>
  <title>Z - {challengeName}</title>
  <link rel="stylesheet" href="/lib/pannellum/pannellum.css" />
  <script src="/lib/pannellum/pannellum.js"></script>
</svelte:head>

<nav class="home-nav"><a href="/">← Home</a></nav>

<div class="panorama-container" bind:this={pano}></div>

{#if result}
  <div class="result-output">
    <output>{result}</output>
  </div>
{/if}

<div class="map-controls">
  <div class="minimap-container" bind:this={container} role="region" aria-label="Interactive minimap">
    <div bind:this={map}></div>
  </div>
  <button onclick={submit} disabled={!coords.length || submitting}>
    {submitting ? "Computing PoW..." : coords.length ? "Submit" : "Select Location"}
  </button>
</div>

<style>
  .home-nav {
    position: fixed;
    top: 13px;
    left: 40px;
    z-index: 100;
  }

  .home-nav a {
    color: #4a9eff;
    text-decoration: none;
    padding: 10px 15px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 5px;
    border: 1px solid #444;
  }

  .home-nav a:hover {
    background: rgba(0, 0, 0, 0.9);
  }

  .panorama-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
  }

  .result-output {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
  }

  .result-output output {
    display: block;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid #444;
    padding: 10px 20px;
    color: #e5e5e5;
  }

  .map-controls {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 100;
  }

  .minimap-container {
    width: 20vw;
    height: 25vh;
    border: 2px solid #444;
    background: #2a2a2a;
    margin-bottom: 10px;
    transition: all 0.3s ease;
  }

  .minimap-container:hover {
    width: 48vw;
    height: 60vh;
  }

  .minimap-container > div {
    width: 100%;
    height: 100%;
  }

  .map-controls button {
    background: #4a9eff;
    color: white;
    border: none;
    padding: 15px 30px;
    cursor: pointer;
    width: 100%;
  }

  .map-controls button:hover:not(:disabled) {
    background: #3585e6;
  }

  .map-controls button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .minimap-container {
      width: 250px;
      height: 150px;
    }
  }
</style>
