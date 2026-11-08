<script lang="ts">
  import { resolve } from '$app/paths';
  import { translator as t, feedback, initializeLanguage } from '../lib/i18n';
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
    const unsubscribe = initializeLanguage();
    void reload().catch(() => {});
    return unsubscribe;
  });
  let { children } = $props();
  const destinations = $derived([
    {
      id: 'overview',
      label: $t('Overview'),
      href: '/',
      match: 'exact' as const
    },
    { id: 'fuel', label: $t('Fuel'), href: '/fuel' },
    { id: 'costs', label: $t('Costs & upkeep'), href: '/costs' },
    { id: 'settings', label: $t('Settings'), href: '/settings' }
  ]);
  const title = $derived(
    destinations.find((d) => d.href === page.url.pathname)?.label || 'Roadbook'
  );
</script>

<svelte:head
  ><title>{title} · Roadbook</title><meta
    name="description"
    content={$t('Your vehicle history, fuel and running costs.')}
  /></svelte:head
>
<AppShell
  brand="Tendstead"
  appLabel="Roadbook"
  pageTitle={title}
  pathname={page.url.pathname}
  {destinations}
  mobilePrimaryIds={['overview', 'fuel', 'costs']}
  primaryAction={{ id: 'add-fuel', label: $t('Add fuel'), href: '/fuel?new=1' }}
>
  {#if $appError}<div class="error" role="alert">
      {$feedback($appError)}
      <button class="secondary" onclick={() => reload().catch(() => {})}
        >{$t('Retry')}</button
      >
    </div>{/if}
  {#if $data}
    <div class="toolbar context-controls">
      <p class="muted">{$t('Your road. Your records.')}</p>
      <div class="row">
        {#if $data.state.profiles.length > 1}<label
            >{$t('Profile')}<select
              value={$data.profile_id}
              onchange={(e) => reload(e.currentTarget.value).catch(() => {})}
              >{#each $data.state.profiles as p (p.id)}<option value={p.id}
                  >{p.name}</option
                >{/each}</select
            ></label
          >{/if}
        {#if $data.state.vehicles.length > 1}<label
            >{$t('Vehicle')}<select
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
  {#if $data && !$data.state.records.length && !(page.url.pathname === '/settings' && page.url.hash === '#import')}
    <section
      class="notice import-banner"
      aria-label={$t('Import existing history')}
    >
      <span
        >{$t(
          'Already tracking your vehicle? Bring your history into Roadbook.'
        )}</span
      >
      <a href={resolve('/settings#import')}>{$t('Import CSV')}</a>
    </section>
  {/if}
  {@render children()}
</AppShell>
