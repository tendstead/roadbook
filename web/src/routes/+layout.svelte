<script lang="ts">
  import { AppShell } from '@tendstead/ui';
  import '@tendstead/ui/theme.css';
  import { page } from '$app/state';
  import '../app.css';
  import { onMount } from 'svelte';
  import {
    data,
    selectedVehicle,
    appError,
    reload,
    chooseVehicle
  } from '../lib/api';
  onMount(() => {
    void reload().catch(() => {});
  });
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
  {#if $appError}<div class="error" role="alert">
      {$appError}
      <button class="secondary" onclick={() => reload().catch(() => {})}
        >Retry</button
      >
    </div>{/if}
  {#if $data}
    <div class="toolbar context-controls">
      <p class="muted">Your road. Your records.</p>
      <div class="row">
        {#if $data.state.profiles.length > 1}<label
            >Profile<select
              value={$data.profile_id}
              onchange={(e) => reload(e.currentTarget.value).catch(() => {})}
              >{#each $data.state.profiles as p (p.id)}<option value={p.id}
                  >{p.name}</option
                >{/each}</select
            ></label
          >{/if}
        {#if $data.state.vehicles.length > 1}<label
            >Vehicle<select
              value={$selectedVehicle}
              onchange={(e) => chooseVehicle(e.currentTarget.value)}
              >{#each $data.state.vehicles as v (v.id)}<option value={v.id}
                  >{v.name}</option
                >{/each}</select
            ></label
          >{/if}
      </div>
    </div>
  {/if}
  {@render children()}
</AppShell>
