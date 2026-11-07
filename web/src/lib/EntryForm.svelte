<script lang="ts">
  import { untrack } from 'svelte';
  import { data, blank, request, reload, message, type Entry } from './api';
  import { scaled, display, minor, moneyInput } from './units';
  let {
    entry = blank(),
    onSaved = () => {}
  }: {
    entry?: Entry;
    onSaved?: () => void;
  } = $props();
  let draft = $state<Entry>(
    structuredClone($state.snapshot(untrack(() => entry)))
  );
  const settings = untrack(() => $data!.state.settings);
  let odometer = $state(
    display(
      untrack(() => draft.odometer_m),
      settings.distance_unit
    )
  );
  let distance = $state(
    display(
      untrack(() => draft.distance_m),
      settings.distance_unit
    )
  );
  let volume = $state(
    display(
      untrack(() => draft.volume_ml),
      settings.fuel_unit
    )
  );
  let amount = $state(moneyInput(untrack(() => draft.amount_minor)));
  const originalDistance = untrack(() => distance);
  const originalOdometer = untrack(() => odometer);
  const originalVolume = untrack(() => volume);
  let months = $state('0');
  let end = $state('');
  let error = $state('');
  let busy = $state(false);
  let dashboard = $state<File[]>([]);
  let receipts = $state<File[]>([]);
  async function save(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    busy = true;
    try {
      if (odometer !== originalOdometer)
        draft.odometer_m = scaled(odometer, settings.distance_unit);
      if (distance !== originalDistance)
        draft.distance_m = scaled(distance, settings.distance_unit);
      if (volume !== originalVolume)
        draft.volume_ml = scaled(volume, settings.fuel_unit);
      draft.amount_minor = minor(amount);
      if (months !== '0') {
        await request('/schedules', 'POST', {
          id: '',
          template: draft,
          first: draft.date,
          end,
          months: Number(months),
          active: true
        });
      } else {
        draft = await request<Entry>(
          '/entries' + (draft.id ? '/' + draft.id : ''),
          draft.id ? 'PUT' : 'POST',
          draft
        );
        for (const [files, purpose] of [
          [dashboard, 'dashboard'],
          [receipts, 'receipt']
        ] as const) {
          while (files.length) {
            const form = new FormData();
            form.set('entry_id', draft.id);
            form.set('purpose', purpose);
            form.set('file', files[0]);
            await request('/attachments', 'POST', form);
            files.shift();
          }
        }
      }
      await reload();
      onSaved();
    } catch (e) {
      error =
        message(e) +
        (draft.id
          ? ' Your record is saved; retry any remaining attachments.'
          : '');
    } finally {
      busy = false;
    }
  }
</script>

<form class="panel" onsubmit={save}>
  <h2>
    {draft.id
      ? 'Edit'
      : draft.kind === 'fuel'
        ? 'New fuel stop'
        : 'New expense'}
  </h2>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="grid">
    <label
      >Vehicle<select bind:value={draft.vehicle_id} disabled={!!draft.id}
        >{#each $data!.state.vehicles as v (v.id)}<option value={v.id}
            >{v.name}</option
          >{/each}</select
      ></label
    >
    <label
      >Date<input
        type="date"
        bind:value={draft.date}
        required
        readonly={!!draft.schedule_id}
      /></label
    >
    {#if $data!.state.profiles.length > 1}<label
        >Paid by<select bind:value={draft.payer_id}
          >{#each $data!.state.profiles as p (p.id)}<option value={p.id}
              >{p.name}</option
            >{/each}</select
        ></label
      >{/if}
    <label
      >{draft.kind === 'fuel' ? 'Total paid' : 'Amount'}<input
        inputmode="decimal"
        bind:value={amount}
        placeholder={draft.kind === 'fuel' ? 'Unknown allowed' : '0.00'}
        required={draft.kind !== 'fuel'}
      /><small>{settings.currency}</small></label
    >
    {#if draft.kind === 'fuel'}
      <label
        >Volume<input
          inputmode="decimal"
          bind:value={volume}
          placeholder="Unknown allowed"
        /><small>{settings.fuel_unit}</small></label
      >
      <label
        >Distance driven<input
          inputmode="decimal"
          bind:value={distance}
          placeholder="Since the preceding fill"
        /><small
          >{settings.distance_unit} · Takes precedence over odometer difference</small
        ></label
      >
      <label
        >Tank status<select bind:value={draft.tank}
          ><option value="unknown">Unknown</option><option value="full"
            >Full</option
          ><option value="partial">Partial</option></select
        ></label
      >
      <label>Station<input bind:value={draft.station} maxlength="200" /></label>
      <label
        >Fuel type<input
          bind:value={draft.fuel_type}
          placeholder="e.g. Super E10"
        /></label
      >
    {:else}
      <label
        >Category<select bind:value={draft.category}
          >{#each ['repair', 'service', 'tyres', 'inspection', 'parts', 'purchase', 'insurance', 'tax', 'lease', 'parking', 'toll', 'other'] as category (category)}<option
              value={category}>{category}</option
            >{/each}</select
        ></label
      >
      <label
        >Description<input
          bind:value={draft.description}
          maxlength="1000"
        /></label
      >
      {#if !draft.id}<label
          >Repeat<select bind:value={months}
            ><option value="0">One time</option><option value="1"
              >Monthly</option
            ><option value="3">Quarterly</option><option value="12"
              >Annually</option
            ></select
          ></label
        >
        {#if months !== '0'}<label
            >Last due date (optional)<input
              type="date"
              bind:value={end}
            /></label
          >{/if}
      {/if}
    {/if}
    <label
      >Odometer<input
        inputmode="decimal"
        bind:value={odometer}
        placeholder="Optional"
      /><small>{settings.distance_unit}</small></label
    >
  </div>
  {#if draft.kind === 'fuel'}<label class="checkbox"
      ><input type="checkbox" bind:checked={draft.gap} /> Missing fuel record or odometer
      reset before this entry</label
    >{/if}
  <label
    >Notes<textarea bind:value={draft.notes} rows="2" maxlength="20000"
    ></textarea></label
  >
  {#if months === '0'}<div class="grid">
      <label
        >Dashboard photos<input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onchange={(e) =>
            (dashboard = Array.from(e.currentTarget.files || []))}
        /></label
      >
      <label
        >Receipts or bills<input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onchange={(e) => (receipts = Array.from(e.currentTarget.files || []))}
        /></label
      >
    </div>
    <small>Originals are retained. JPEG, PNG or WebP; up to 20 MiB each.</small
    >{/if}
  <div class="row">
    <button disabled={busy}
      >{busy
        ? 'Saving…'
        : draft.kind === 'fuel'
          ? 'Save fuel'
          : 'Save expense'}</button
    ><button type="button" class="secondary" disabled={busy} onclick={onSaved}
      >Cancel</button
    >
  </div>
</form>
