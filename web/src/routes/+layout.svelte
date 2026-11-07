<script lang="ts">
  import { AppShell } from '@tendstead/ui';
  import '@tendstead/ui/theme.css';
  import { page } from '$app/state';
  import '../app.css';
  let { children } = $props();
  const destinations = [
    { id: 'overview', label: 'Overview', href: '/', match: 'exact' as const },
    { id: 'fuel', label: 'Fuel', href: '/fuel' },
    { id: 'costs', label: 'Costs & upkeep', href: '/costs' },
    { id: 'settings', label: 'Settings', href: '/settings' }
  ];
  const title = $derived(
    destinations.find((d) => d.href === page.url.pathname)?.label || 'Roadbook'
  );
</script>

<svelte:head
  ><title>{title} · Roadbook</title><meta
    name="description"
    content="Your vehicle history, fuel and running costs."
  /></svelte:head
>
<AppShell
  brand="Tendstead"
  appLabel="Roadbook"
  pageTitle={title}
  pathname={page.url.pathname}
  {destinations}
  mobilePrimaryIds={['overview', 'fuel', 'costs']}
  primaryAction={{ id: 'add-fuel', label: 'Add fuel', href: '/fuel?new=1' }}
>
  {@render children()}
</AppShell>
