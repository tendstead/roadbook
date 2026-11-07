<script lang="ts">
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
  import { display } from './units';
  import { money } from './format';
  import EntryForm from './EntryForm.svelte';
  import Attachments from './Attachments.svelte';
  let { kind }: { kind: string } = $props();
  let editing = $state<Entry | null>(null);
  let notice = $state('');
  let error = $state('');
  let from = $state('');
  let to = $state('');
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
      <h2>Add your first vehicle</h2>
      <p>Open Settings to start your vehicle history.</p>
    </section>
  {:else}
    <div class="toolbar">
      <p class="muted">
        {records.length}
        {kind === 'fuel' ? 'fuel stops' : 'expenses'} · {$data.state.vehicles.find(
          (v) => v.id === $selectedVehicle
        )?.name}
      </p>
      <button
        onclick={() => {
          editing = blank(kind);
          notice = '';
        }}>{kind === 'fuel' ? 'New fuel stop' : 'New expense'}</button
      >
    </div>
    {#if notice}<p class="notice" role="status">{notice}</p>{/if}{#if error}<p
        class="error"
        role="alert"
      >
        {error}
      </p>{/if}
    {#if editing}{#key editing.id}<EntryForm
          entry={editing}
          onSaved={saved}
        />{/key}{/if}
    <div class="row filters">
      <label>From<input type="date" bind:value={from} /></label><label
        >Through<input type="date" bind:value={to} /></label
      >
    </div>
    {#if !records.length}<section class="empty">
        <h2>A fresh page</h2>
        <p>
          Add your first {kind === 'fuel' ? 'fuel stop' : 'expense'}, or import
          existing records in Settings.
        </p>
      </section>{/if}
    {#each records as entry (entry.id)}
      <article class="panel history-entry">
        <div class="toolbar">
          <div>
            <small
              >{entry.date}{#if entry.schedule_id}
                · Recurring{/if}</small
            >
            <h3>
              {kind === 'fuel'
                ? entry.station || 'Fuel stop'
                : entry.description || entry.category}
            </h3>
          </div>
          <strong
            >{entry.amount_minor === null
              ? 'Amount unknown'
              : money(
                  entry.amount_minor,
                  $data.state.settings.currency
                )}</strong
          >
        </div>
        {#if kind === 'fuel'}<p>
            {display(entry.volume_ml, $data.state.settings.fuel_unit) ||
              'Volume unknown'}
            {$data.state.settings.fuel_unit} · {entry.distance_m !== null
              ? display(entry.distance_m, $data.state.settings.distance_unit) +
                ' ' +
                $data.state.settings.distance_unit +
                ' driven'
              : entry.odometer_m !== null
                ? 'Odometer ' +
                  display(
                    entry.odometer_m,
                    $data.state.settings.distance_unit
                  ) +
                  ' ' +
                  $data.state.settings.distance_unit
                : 'Distance unknown'} · {entry.tank} tank
          </p>{/if}
        {#if entry.gap || (entry.tank === 'unknown' && kind === 'fuel') || (entry.volume_ml === null && kind === 'fuel')}<p
            class="muted"
          >
            Incomplete interval · Recorded values are retained; no missing data
            is assumed.
          </p>{/if}
        {#if entry.notes}<p>{entry.notes}</p>{/if}
        <Attachments entryID={entry.id} />
        {#if entry.extra}<details>
            <summary>Imported source information</summary>
            <dl>
              {#each Object.entries(entry.extra) as [key, value] (key)}<dt>
                  {key}
                </dt>
                <dd>{value}</dd>{/each}
            </dl>
          </details>{/if}
        {#if $data.state.profiles.length > 1}<small
            >Paid by {$data.state.profiles.find((p) => p.id === entry.payer_id)
              ?.name}</small
          >{/if}
        <div class="row">
          <button
            class="secondary"
            onclick={() => {
              editing = structuredClone(entry);
              notice = '';
            }}>Edit</button
          >
          {#if !entry.schedule_id}<button
              class="secondary"
              onclick={() => (pendingDelete = entry.id)}>Delete</button
            >{/if}
          {#if pendingDelete === entry.id}<span
              >Delete this entry and its attachments?</span
            ><button class="danger" onclick={() => remove(entry.id)}
              >Confirm delete</button
            ><button class="secondary" onclick={() => (pendingDelete = '')}
              >Keep entry</button
            >{/if}
        </div>
      </article>
    {/each}
  {/if}
{:else}<p class="muted">Loading your records…</p>{/if}
