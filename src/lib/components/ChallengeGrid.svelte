<script lang="ts">
  import { goto } from "$app/navigation";
  import { solvedChallenges, isSolved } from "$lib/stores/gameState";
  import { onMount } from "svelte";
  let challengesByDifficulty: Record<string, Array<{ name: string }>> = $state({});
  onMount(async () => (challengesByDifficulty = await (await fetch("/challs.json")).json()));
</script>

{#each Object.entries(challengesByDifficulty) as [difficulty, challengeSet] (difficulty)}
  <section>
    <h2>
      Difficulty: {difficulty === "easy" ? "JoshL" : difficulty === "hard" ? "enscribe" : difficulty}
    </h2>
    {#each challengeSet as challenge (challenge.name)}
      <article data-solved={isSolved(challenge.name, $solvedChallenges)}>
        <button onclick={() => goto(`/${challenge.name}`)}>
          <img src="/panoramas/{challenge.name}/1/f0_0.avif" alt={challenge.name} />
          <h3>
            {challenge.name}
            {#if isSolved(challenge.name, $solvedChallenges)}✅{/if}
          </h3>
        </button>
      </article>
    {/each}
  </section>
{/each}

<style>
  section {
    margin-bottom: 2rem;
  }

  section > h2 {
    border-bottom: 1px solid #444;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
    text-transform: none;
  }

  article {
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 0.5rem;
    padding: 0;
    margin-bottom: 1rem;
    transition: border-color 0.2s;
    overflow: hidden;
  }

  article:hover {
    border-color: #4a9eff;
  }

  article[data-solved="true"] {
    border-color: #22c55e;
  }

  article button {
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    display: block;
    border-radius: 0.5rem;
    overflow: hidden;
    transition: none;
  }

  article button img {
    width: 100%;
    height: 200px;
    object-fit: cover;
  }

  article button:hover {
    background: none;
    transform: none;
  }

  article button:hover h3 {
    background: #2a2a2a;
    color: inherit;
  }

  article button h3 {
    padding: 1rem;
    background: #2a2a2a;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  @media (min-width: 768px) {
    section {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }

    section > h2 {
      grid-column: 1 / -1;
    }
  }
</style>
