<script lang="ts">
  import { onMount } from 'svelte';
  import { translator as t } from './i18n';
  import Icon from './Icon.svelte';
  let theme = $state('light');
  function apply(next: string) {
    theme = next;
    document.documentElement.dataset.theme = next;
  }
  onMount(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('roadbook-theme');
    } catch {
      /* Use device preference. */
    }
    apply(
      saved === 'dark' || saved === 'light'
        ? saved
        : matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    );
  });
  function toggle() {
    apply(theme === 'dark' ? 'light' : 'dark');
    try {
      localStorage.setItem('roadbook-theme', theme);
    } catch {
      /* Current tab still works. */
    }
  }
</script>

<button
  class="secondary theme-toggle"
  onclick={toggle}
  aria-label={$t(
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  )}
  title={$t(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
>
  <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
</button>
