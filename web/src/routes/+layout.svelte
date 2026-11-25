<script lang="ts">
  import OverviewIcon from '../lib/icons/OverviewIcon.svelte';
  import FuelIcon from '../lib/icons/FuelIcon.svelte';
  import CostsIcon from '../lib/icons/CostsIcon.svelte';
  import SettingsIcon from '../lib/icons/SettingsIcon.svelte';
  import AddIcon from '../lib/icons/AddIcon.svelte';
  import ThemeToggle from '../lib/ThemeToggle.svelte';
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
      icon: OverviewIcon,
      label: $t('Overview'),
      href: '/',
      match: 'exact' as const
    },
    { id: 'fuel', icon: FuelIcon, label: $t('Fuel'), href: '/fuel' },
    {
      id: 'costs',
      icon: CostsIcon,
      label: $t('Costs & upkeep'),
      href: '/costs'
    },
    {
      id: 'settings',
      icon: SettingsIcon,
      label: $t('Settings'),
      href: '/settings'
    }
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
  mobilePrimaryIds={['overview', 'fuel', 'costs', 'settings']}
  primaryAction={{
    icon: AddIcon,
    id: 'add-fuel',
    label: $t('Add fuel'),
    href: '/fuel?new=1'
  }}
>
  {#snippet pageActions()}<ThemeToggle />{/snippet}
  {#if $appError}<div class="error" role="alert">
      {$feedback($appError)}
      <button class="secondary" onclick={() => reload().catch(() => {})}
        >{$t('Retry')}</button
      >
    </div>{/if}
  {#if $data}
    <div
      class="toolbar context-controls"
      class:history-context={page.url.pathname === '/fuel' ||
        page.url.pathname === '/costs'}
    >
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
