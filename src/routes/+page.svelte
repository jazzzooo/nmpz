<script lang="ts">
  import ChallengeGrid from "$lib/components/ChallengeGrid.svelte";
  import { selectedIcon, iconNames, solvedChallenges, reconstructedFlags } from "$lib/stores/gameState";

  let progress: Record<string, { solved: number; total: number }> = $state({});
  const flags = $derived($reconstructedFlags);

  $effect(() => {
    (async () => {
      try {
        const challs = await fetch("/challs.json").then((r) => r.json());
        progress = Object.fromEntries(
          Object.entries(challs).map(([diff, challenges]) => [
            diff,
            {
              solved: (challenges as any[]).filter((c) => c.name in $solvedChallenges).length,
              total: (challenges as any[]).length,
            },
          ]),
        );
      } catch {
        // Failed to update progress
      }
    })();
  });
</script>

<svelte:head>
  <title>NMPZ</title>
</svelte:head>

<main>
  <header>
    <h1>
      <s>NMP</s>
      Z
    </h1>

    <div class="marker-selector">
      {#each iconNames as icon (icon)}
        <button class="marker-btn" class:selected={$selectedIcon === icon} onclick={() => selectedIcon.set(icon)}>
          <img src="/img/icons/{icon}" alt={icon.replace(".ico", "")} />
        </button>
      {/each}
    </div>

    {#if Object.keys(progress).length}
      <section>
        <h2>Progress</h2>
        {#each Object.entries(progress) as [difficulty, data] (difficulty)}
          <article>
            <h3>{difficulty.toUpperCase()}</h3>
            <progress value={data.solved} max={data.total}></progress>
            <p>{data.solved}/{data.total} ({data.solved >= 9 ? "✅" : `${9 - data.solved} needed`})</p>
            {#if flags[difficulty]}<output>🚩 {flags[difficulty]}</output>{/if}
          </article>
        {/each}
      </section>
    {/if}
  </header>

  <ChallengeGrid />
</main>

<style>
  header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .marker-selector {
    margin-bottom: 2rem;
    text-align: center;
  }

  .marker-btn {
    background: #333;
    border: 2px solid #444;
    border-radius: 0.5rem;
    padding: 0.5rem;
    margin: 0.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .marker-btn:hover {
    border-color: #4a9eff;
    background: #3a3a3a;
  }

  .marker-btn.selected {
    border-color: #4a9eff;
    background: #4a9eff;
  }

  .marker-btn img {
    width: 24px;
    height: 24px;
    display: block;
  }

  section {
    margin-bottom: 2rem;
  }

  article {
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
    transition: border-color 0.2s;
  }

  article:hover {
    border-color: #4a9eff;
  }

  article output {
    font-family: monospace;
    font-size: 0.9rem;
  }

  @media (min-width: 768px) {
    .marker-btn {
      margin: 0 0.25rem;
    }
  }
</style>
