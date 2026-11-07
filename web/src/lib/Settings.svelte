<script lang="ts">
  import {
    data,
    chooseVehicle,
    request,
    reload,
    blank,
    message,
    type Vehicle,
    type Settings,
    type Schedule
  } from './api';
  import { scaled, display, minor, moneyInput } from './units';
  import { money } from './format';
  import Importer from './Importer.svelte';
  let form = $state<Vehicle>({
    id: '',
    name: '',
    kind: 'car',
    fuel_type: '',
    owner_id: '',
    members: [],
    ownership_start: '',
    ownership_end: '',
    initial_odometer_m: null
  });
  let odometer = $state('');
  let originalOdometer = $state('');
  let editingDistanceUnit = $state('');
  let purchase = $state('');
  let profileName = $state('');
  let error = $state('');
  let notice = $state('');
  let busy = $state(false);
  let configuration = $state<Settings | null>(null);
  $effect(() => {
    if ($data) configuration = { ...$data.state.settings };
  });
  async function saveVehicle(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    notice = '';
    busy = true;
    try {
      const isNew = !form.id;
      if (!isNew && editingDistanceUnit !== $data!.state.settings.distance_unit)
        throw new Error(
          'Units changed; cancel and reopen the vehicle editor before saving.'
        );
      if (isNew || odometer !== originalOdometer)
        form.initial_odometer_m = scaled(
          odometer,
          $data!.state.settings.distance_unit
        );
      const amount = minor(purchase);
      const result = await request<Vehicle>(
        '/vehicles' + (form.id ? '/' + form.id : ''),
        form.id ? 'PUT' : 'POST',
        form
      );
      form = result;
      chooseVehicle(result.id);
      await reload();
      if (isNew && amount !== null) {
        const entry = blank('expense');
        entry.vehicle_id = result.id;
        entry.category = 'purchase';
        entry.description = 'Vehicle purchase';
        entry.amount_minor = amount;
        entry.date = result.ownership_start || entry.date;
        await request('/entries', 'POST', entry);
        await reload();
      }
      notice = 'Vehicle saved';
      resetVehicle();
    } catch (e) {
      error =
        message(e) +
        (form.id
          ? ' Vehicle saved; add any missing purchase expense under Costs.'
          : '');
    } finally {
      busy = false;
    }
  }
  function resetVehicle() {
    form = {
      id: '',
      name: '',
      kind: 'car',
      fuel_type: '',
      owner_id: '',
      members: [],
      ownership_start: '',
      ownership_end: '',
      initial_odometer_m: null
    };
    odometer = '';
    purchase = '';
  }
  async function addProfile(e: SubmitEvent) {
    e.preventDefault();
    try {
      await request('/profiles', 'POST', { id: '', name: profileName });
      profileName = '';
      await reload();
      notice = 'Profile added';
    } catch (e) {
      error = message(e);
    }
  }
  async function saveSettings(e: SubmitEvent) {
    e.preventDefault();
    try {
      await request('/settings', 'PUT', configuration);
      await reload();
      notice = 'Settings saved';
    } catch (e) {
      error = message(e);
    }
  }
  async function editSchedule(e: SubmitEvent, s: Schedule) {
    e.preventDefault();
    try {
      const f = new FormData(e.currentTarget as HTMLFormElement);
      const next = {
        ...s,
        template: {
          ...s.template,
          amount_minor: minor(String(f.get('amount')))
        },
        end: String(f.get('end') || ''),
        active: f.get('active') === 'on'
      };
      await request('/schedules/' + s.id, 'PUT', next);
      await reload();
      notice = 'Schedule updated';
    } catch (e) {
      error = message(e);
    }
  }
  async function exportData() {
    try {
      const value = await request<unknown>('/export');
      const blob = new Blob([JSON.stringify(value, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'roadbook-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      error = message(e);
    }
  }
</script>

{#if $data && configuration}
  <p class="muted">
    Private installation. Profiles organize vehicles; anyone with access can
    switch profiles.
  </p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}{#if notice}<p
      class="notice"
      role="status"
    >
      {notice}
    </p>{/if}
  <form class="panel" onsubmit={saveVehicle}>
    <h2>
      {form.id
        ? 'Edit vehicle'
        : $data.state.vehicles.length
          ? 'Add another vehicle'
          : 'Your first vehicle'}
    </h2>
    <div class="grid">
      <label
        >Vehicle name<input
          bind:value={form.name}
          required
          maxlength="120"
          placeholder="e.g. Our Golf"
        /></label
      >
      <label
        >Vehicle type<select bind:value={form.kind}
          ><option value="car">Car</option><option value="motorbike"
            >Motorbike</option
          ><option value="other">Other</option></select
        ></label
      >
      <label
        >Fuel type<input
          bind:value={form.fuel_type}
          placeholder="e.g. Super E10"
        /></label
      >
      <label
        >Ownership start<input
          type="date"
          bind:value={form.ownership_start}
        /><small>Optional · needed for the monthly upkeep average</small></label
      >
      <label
        >Ownership end<input
          type="date"
          bind:value={form.ownership_end}
        /><small>Optional · keep historical records after sale</small></label
      >
      <label
        >Initial odometer<input
          inputmode="decimal"
          bind:value={odometer}
        /><small
          >{$data.state.settings.distance_unit} · optional baseline before your first
          fill</small
        ></label
      >
      {#if !form.id}<label
          >Purchase price<input
            inputmode="decimal"
            bind:value={purchase}
          /><small>Optional · creates one purchase expense</small></label
        >{/if}
    </div>
    {#if $data.state.profiles.length > 1}<fieldset>
        <legend>Share this vehicle with</legend
        >{#each $data.state.profiles as p (p.id)}<label class="checkbox"
            ><input
              type="checkbox"
              value={p.id}
              bind:group={form.members}
              disabled={p.id === $data.profile_id}
            />{p.name}{p.id === $data.profile_id ? ' (owner)' : ''}</label
          >{/each}
      </fieldset>{/if}
    <div class="row">
      <button disabled={busy}>{form.id ? 'Save vehicle' : 'Add vehicle'}</button
      >{#if form.id}<button
          type="button"
          class="secondary"
          onclick={resetVehicle}>Cancel</button
        >{/if}
    </div>
  </form>
  <section class="panel">
    <h2>Your vehicles</h2>
    {#each $data.state.vehicles as v (v.id)}<div class="recent">
        <span
          >{v.name}{v.ownership_end ? ' · Archived' : ''}{v.members.length > 1
            ? ' · Shared'
            : ''}</span
        >{#if v.owner_id === $data.profile_id}<button
            class="secondary"
            onclick={() => {
              form = { ...v, members: [...v.members] };
              odometer = display(
                v.initial_odometer_m,
                $data!.state.settings.distance_unit
              );
              originalOdometer = odometer;
              editingDistanceUnit = $data!.state.settings.distance_unit;
              notice = '';
            }}>Edit vehicle</button
          >{/if}
      </div>{:else}<p class="muted">No vehicles yet.</p>{/each}
  </section>
  <form class="panel" onsubmit={saveSettings}>
    <h2>Units & locale</h2>
    <div class="grid">
      <label
        >Distance unit<select bind:value={configuration.distance_unit}
          ><option value="km">Kilometres</option><option value="mi"
            >Miles</option
          ></select
        ></label
      >
      <label
        >Fuel unit<select bind:value={configuration.fuel_unit}
          ><option value="L">Litres</option><option value="US gal"
            >US gallons</option
          ><option value="Imp gal">Imperial gallons</option></select
        ></label
      >
      <label
        >Currency<select
          bind:value={configuration.currency}
          disabled={$data.state.records.length > 0 ||
            $data.state.schedules.length > 0}
          >{#each ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD'] as c (c)}<option
              >{c}</option
            >{/each}</select
        ></label
      >
      <label
        >Timezone<input bind:value={configuration.timezone} required /></label
      >
    </div>
    <small
      >Unit changes convert measurements. Currency cannot change after records
      exist.</small
    ><button>Save settings</button>
  </form>
  <section class="panel">
    <h2>Profiles</h2>
    <p class="muted">
      Add another person to enable profile switching, vehicle sharing and payer
      selection.
    </p>
    <ul>
      {#each $data.state.profiles as p (p.id)}<li>{p.name}</li>{/each}
    </ul>
    <form onsubmit={addProfile}>
      <label
        >New profile name<input
          bind:value={profileName}
          required
          maxlength="120"
        /></label
      ><button>Add profile</button>
    </form>
  </section>
  <section class="panel">
    <h2>Recurring expenses</h2>
    <p class="muted">
      Add a repeating expense under Costs & upkeep. Due charges count
      automatically. Editing changes future charges; existing charges stay
      recorded.
    </p>
    {#each $data.state.schedules as s (s.id)}<form
        class="schedule"
        onsubmit={(e) => editSchedule(e, s)}
      >
        <h3>
          {s.template.description || s.template.category} · every {s.months} month(s)
        </h3>
        <p>
          {money(s.template.amount_minor || 0, $data.state.settings.currency)} · first
          due {s.first}
        </p>
        <div class="grid">
          <label
            >Future amount<input
              name="amount"
              value={moneyInput(s.template.amount_minor)}
              required
              inputmode="decimal"
            /></label
          ><label
            >Last due date<input type="date" name="end" value={s.end} /></label
          >
        </div>
        <label class="checkbox"
          ><input
            type="checkbox"
            name="active"
            checked={s.active}
          />Active</label
        ><button class="secondary">Update schedule</button>
      </form>{:else}<p class="muted">No recurring expenses.</p>{/each}
  </section>
  <Importer />
  <section class="panel">
    <h2>Export & recovery</h2>
    <p>
      Export includes all profiles, canonical record values and attachment
      metadata. Original images need a file backup too.
    </p>
    <button onclick={exportData}>Export records</button>
  </section>
  <section class="panel">
    <h2>About Roadbook</h2>
    <p>Source-available under Elastic License 2.0.</p>
    <div class="row">
      <a href="/license.txt" rel="external">License</a><a
        href="/third-party-notices.txt"
        rel="external">Third-party notices</a
      >
    </div>
  </section>
{:else}<p class="muted">Loading settings…</p>{/if}
