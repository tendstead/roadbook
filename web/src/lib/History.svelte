<script lang="ts">
  import { translator as t, feedback } from './i18n';
  import { page } from '$app/state';
  import {
    data,
    selectedVehicle,
    blank,
    request,
    reload,
    message,
    type Entry
  } from './api';
  import EntrySummary from './EntrySummary.svelte';
  import { sourceInformation } from './source-information';
  import EntryForm from './EntryForm.svelte';
  import Attachments from './Attachments.svelte';
  import { historyRange, type HistoryPreset } from './history-range';
  let { kind }: { kind: string } = $props();
  let editing = $state<Entry | null>(null);
  let notice = $state('');
  let error = $state('');
  let from = $state('');
  let to = $state('');
  let selectedRange = $state<HistoryPreset | ''>('all');
  const presets: { id: HistoryPreset; label: string }[] = [
    { id: '7', label: '7 days' },
    { id: '30', label: '30 days' },
    { id: '6months', label: '6 months' },
    { id: 'all', label: 'All dates' }
  ];
  function selectRange(preset: HistoryPreset) {
    const range = historyRange(preset, blank().date);
    from = range.from;
    to = range.to;
    selectedRange = preset;
  }
  let pendingDelete = $state('');
  const records = $derived(
    $data?.state.records
      .filter(
        (e) =>
          e.kind === kind &&
          e.vehicle_id === $selectedVehicle &&
          (!from || e.date >= from) &&
          (!to || e.date <= to)
      )
      .toReversed() || []
  );
  const hasHistory = $derived(
    $data?.state.records.some(
      (entry) => entry.kind === kind && entry.vehicle_id === $selectedVehicle
    )
  );
  let openedFromURL = $state(false);
  $effect(() => {
    if (
      page.url.searchParams.get('new') &&
      $data &&
      $selectedVehicle &&
      !openedFromURL
    ) {
      openedFromURL = true;
      editing = blank(kind);
    }
  });
  async function remove(id: string) {
    try {
      await request('/entries/' + id, 'DELETE');
      pendingDelete = '';
      await reload();
    } catch (e) {
      error = message(e);
    }
  }
  function saved() {
    editing = null;
    notice = kind === 'fuel' ? 'Fuel saved' : 'Expense saved';
    history.replaceState(null, '', page.url.pathname);
  }
</script>

{#if $data}
  {#if !$data.state.vehicles.length}<section class="empty">
      <h2>{$t('Add your first vehicle')}</h2>
      <p>{$t('Open Settings to start your vehicle history.')}</p>
    </section>
  {:else}
    <div class="toolbar history-toolbar">
      <p class="muted">
        {records.length}
        {kind === 'fuel' ? $t('fuel stops') : $t('expenses')} · {$data.state.vehicles.find(
          (v) => v.id === $selectedVehicle
        )?.name}
      </p>
      <button
        onclick={() => {
          editing = blank(kind);
          notice = $t('');
        }}>{kind === 'fuel' ? $t('New fuel stop') : $t('New expense')}</button
      >
    </div>
    {#if notice}<p class="notice" role="status">
        {$feedback(notice)}
      </p>{/if}{#if error}<p class="error" role="alert">
        {$feedback(error)}
      </p>{/if}
    {#if editing}{#key editing.id}<EntryForm
          entry={editing}
          onSaved={saved}
        />{/key}{/if}
    <div class="history-filters">
      <div class="filters">
        <label
          >{$t('From')}<input
            type="date"
            bind:value={from}
            oninput={() => (selectedRange = '')}
          /></label
        >
        <label
          >{$t('Through')}<input
            type="date"
            bind:value={to}
            oninput={() => (selectedRange = '')}
          /></label
        >
      </div>
      <div
        class="date-presets"
        role="group"
        aria-label={$t('Date range shortcuts')}
      >
        {#each presets as preset (preset.id)}
          <button
            type="button"
            class="secondary"
            aria-pressed={selectedRange === preset.id}
            onclick={() => selectRange(preset.id)}>{$t(preset.label)}</button
          >
        {/each}
      </div>
    </div>
    {#if !records.length}<section
        class="empty"
        class:filtered-empty={hasHistory}
      >
        {#if hasHistory}
          <h2>{$t('No entries in this date range.')}</h2>
          <button class="secondary" onclick={() => selectRange('all')}
            >{$t('Show all dates')}</button
          >
        {:else}
          <h2>{$t('A fresh page')}</h2>
          <p>
            {$t(
              kind === 'fuel'
                ? 'Add your first fuel stop, or import existing records in Settings.'
                : 'Add your first expense, or import existing records in Settings.'
            )}
          </p>
        {/if}
      </section>{/if}
    {#each records as entry (entry.id)}
      <article class="panel history-entry" class:compact-fuel={kind === 'fuel'}>
        <EntrySummary {entry} settings={$data.state.settings} />
        <Attachments entryID={entry.id} />
        <div class="entry-provenance">
          {#if entry.extra}<details>
              <summary>{$t('Imported source information')}</summary>
              <dl>
                {#each sourceInformation(entry.extra) as [key, value] (key)}<dt>
                    {key}
                  </dt>
                  <dd>{value}</dd>{/each}
              </dl>
            </details>{/if}
          {#if $data.state.profiles.length > 1}<small
              >{$t('Paid by')}
              {$data.state.profiles.find((p) => p.id === entry.payer_id)
                ?.name}</small
            >{/if}
        </div>
        <div
          class="row entry-actions"
          class:confirming={pendingDelete === entry.id}
        >
          <button
            class="secondary"
            onclick={() => {
              editing = structuredClone(entry);
              notice = $t('');
            }}>{$t('Edit')}</button
          >
          {#if !entry.schedule_id}<button
              class="secondary"
              onclick={() => (pendingDelete = entry.id)}>{$t('Delete')}</button
            >{/if}
          {#if pendingDelete === entry.id}<span
              >{$t('Delete this entry and its attachments?')}</span
            ><button class="danger" onclick={() => remove(entry.id)}
              >{$t('Confirm delete')}</button
            ><button class="secondary" onclick={() => (pendingDelete = $t(''))}
              >{$t('Keep entry')}</button
            >{/if}
        </div>
      </article>
    {/each}
  {/if}
{:else}<p class="muted">{$t('Loading your records…')}</p>{/if}
