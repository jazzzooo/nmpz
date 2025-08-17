<script lang="ts">
  let { children } = $props();
</script>

{@render children?.()}

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: #1a1a1a;
    color: #e5e5e5;
    line-height: 1.5;
    min-height: 100vh;
  }

  :global(main) {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  :global(h1) {
    font-size: 2.5rem;
    font-weight: 700;
    color: #4a9eff;
    text-align: center;
    margin-bottom: 0.5rem;
  }

  :global(h2) {
    font-size: 1.25rem;
    color: #ccc;
    margin-bottom: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global(h3) {
    font-size: 1.1rem;
    color: #e5e5e5;
    margin-bottom: 0.5rem;
  }

  :global(p) {
    color: #999;
    text-align: center;
    margin-bottom: 2rem;
  }

  :global(button) {
    background: #4a9eff;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  :global(button:hover:not(:disabled)) {
    background: #3585e6;
  }

  :global(button:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global(progress) {
    width: 100%;
    height: 0.5rem;
    border-radius: 0.25rem;
    background: #444;
    border: none;
    margin-bottom: 0.5rem;
  }

  :global(progress::-webkit-progress-value) {
    background: #4a9eff;
    border-radius: 0.25rem;
  }

  :global(progress::-moz-progress-bar) {
    background: #4a9eff;
    border-radius: 0.25rem;
  }

  :global(output) {
    display: block;
    padding: 1rem;
    border-radius: 0.25rem;
    text-align: center;
    margin: 1rem 0;
    background: #2a2a2a;
    border: 1px solid #444;
  }
</style>
