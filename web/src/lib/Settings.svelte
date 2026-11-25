<script lang="ts">
  import { translator as t, feedback, language, setLanguage } from './i18n';
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
  import { formatters as fmt } from './format';
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

<section class="panel">
  <h2>{$t('Language')}</h2>
  <label
    >{$t('Language')}<select
      value={$language}
      onchange={(e) => setLanguage(e.currentTarget.value as 'en' | 'de')}
      ><option value="en" lang="en">English</option><option value="de" lang="de"
        >Deutsch</option
      ></select
    ></label
  >
  <small>{$t('Saved in this browser only.')}</small>
</section>
{#if $data && configuration}
  <p class="muted">
    {$t(
      'Private installation. Profiles organize vehicles; anyone with access can switch profiles.'
    )}
  </p>
  {#if error}<p class="error" role="alert">
      {$feedback(error)}
    </p>{/if}{#if notice}<p class="notice" role="status">
      {$feedback(notice)}
    </p>{/if}
  <form class="panel" id="vehicle-setup" onsubmit={saveVehicle}>
    <h2>
      {form.id
        ? $t('Edit vehicle')
        : $data.state.vehicles.length
          ? $t('Add another vehicle')
          : $t('Your first vehicle')}
    </h2>
    <div class="grid">
      <label
        >{$t('Vehicle name')}<input
          bind:value={form.name}
          required
          maxlength="120"
          placeholder={$t('e.g. Our Golf')}
        /></label
      >
      <label
        >{$t('Vehicle type')}<select bind:value={form.kind}
          ><option value="car">{$t('Car')}</option><option value="motorbike"
            >{$t('Motorbike')}</option
          ><option value="other">{$t('Other')}</option></select
        ></label
      >
      <label
        >{$t('Fuel type')}<input
          bind:value={form.fuel_type}
          placeholder={$t('e.g. Super E10')}
        /></label
      >
      <label
        >{$t('Ownership start')}<input
          type="date"
          bind:value={form.ownership_start}
        /><small>{$t('Optional · needed for the monthly upkeep average')}</small
        ></label
      >
      <label
        >{$t('Ownership end')}<input
          type="date"
          bind:value={form.ownership_end}
        /><small>{$t('Optional · keep historical records after sale')}</small
        ></label
      >
      <label
        >{$t('Initial odometer')}<input
          inputmode="decimal"
          bind:value={odometer}
        /><small
          >{$data.state.settings.distance_unit}
          {$t('· optional baseline before your first fill')}</small
        ></label
      >
      {#if !form.id}<label
          >{$t('Purchase price')}<input
            inputmode="decimal"
            bind:value={purchase}
          /><small>{$t('Optional · creates one purchase expense')}</small
          ></label
        >{/if}
    </div>
    {#if $data.state.profiles.length > 1}<fieldset>
        <legend>{$t('Share this vehicle with')}</legend
        >{#each $data.state.profiles as p (p.id)}<label class="checkbox"
            ><input
              type="checkbox"
              value={p.id}
              bind:group={form.members}
              disabled={p.id === $data.profile_id}
            />{p.name}{p.id === $data.profile_id
              ? $t(' (owner)')
              : $t('')}</label
          >{/each}
      </fieldset>{/if}
    <div class="row">
      <button disabled={busy}
        >{form.id ? $t('Save vehicle') : $t('Add vehicle')}</button
      >{#if form.id}<button
          type="button"
          class="secondary"
          onclick={resetVehicle}>{$t('Cancel')}</button
        >{/if}
    </div>
  </form>
  <section class="panel">
    <h2>{$t('Your vehicles')}</h2>
    {#each $data.state.vehicles as v (v.id)}<div class="recent">
        <span
          >{v.name}{v.ownership_end ? $t(' · Archived') : $t('')}{v.members
            .length > 1
            ? $t(' · Shared')
            : $t('')}</span
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
              notice = $t('');
            }}>{$t('Edit vehicle')}</button
          >{/if}
      </div>{:else}<p class="muted">{$t('No vehicles yet.')}</p>{/each}
  </section>
  <form class="panel" onsubmit={saveSettings}>
    <h2>{$t('Units & locale')}</h2>
    <div class="grid">
      <label
        >{$t('Distance unit')}<select bind:value={configuration.distance_unit}
          ><option value="km">{$t('Kilometres')}</option><option value="mi"
            >{$t('Miles')}</option
          ></select
        ></label
      >
      <label
        >{$t('Fuel unit')}<select bind:value={configuration.fuel_unit}
          ><option value="L">{$t('Litres')}</option><option value="US gal"
            >{$t('US gallons')}</option
          ><option value="Imp gal">{$t('Imperial gallons')}</option></select
        ></label
      >
      <label
        >{$t('Currency')}<select
          bind:value={configuration.currency}
          disabled={$data.state.records.length > 0 ||
            $data.state.schedules.length > 0}
          >{#each ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD'] as c (c)}<option
              >{c}</option
            >{/each}</select
        ></label
      >
      <label
        >{$t('Timezone')}<input
          bind:value={configuration.timezone}
          required
        /></label
      >
    </div>
    <small
      >{$t(
        'Unit changes convert measurements. Currency cannot change after records exist.'
      )}</small
    ><button>{$t('Save settings')}</button>
  </form>
  <section class="panel">
    <h2>{$t('Profiles')}</h2>
    <p class="muted">
      {$t(
        'Add another person to enable profile switching, vehicle sharing and payer selection.'
      )}
    </p>
    <ul>
      {#each $data.state.profiles as p (p.id)}<li>{p.name}</li>{/each}
    </ul>
    <form onsubmit={addProfile}>
      <label
        >{$t('New profile name')}<input
          bind:value={profileName}
          required
          maxlength="120"
        /></label
      ><button>{$t('Add profile')}</button>
    </form>
  </section>
  <section class="panel">
    <h2>{$t('Recurring expenses')}</h2>
    <p class="muted">
      {$t(
        'Add a repeating expense under Costs & upkeep. Due charges count automatically. Editing changes future charges; existing charges stay recorded.'
      )}
    </p>
    {#each $data.state.schedules as s (s.id)}<form
        class="schedule"
        onsubmit={(e) => editSchedule(e, s)}
      >
        <h3>
          {s.template.description || $t(s.template.category)}
          {$t('· every')}
          {s.months}
          {$t('month(s)')}
        </h3>
        <p>
          {$fmt.money(
            s.template.amount_minor || 0,
            $data.state.settings.currency
          )}
          {$t('· first due')}
          {$fmt.date(s.first)}
        </p>
        <div class="grid">
          <label
            >{$t('Future amount')}<input
              name="amount"
              value={moneyInput(s.template.amount_minor)}
              required
              inputmode="decimal"
            /></label
          ><label
            >{$t('Last due date')}<input
              type="date"
              name="end"
              value={s.end}
            /></label
          >
        </div>
        <label class="checkbox"
          ><input type="checkbox" name="active" checked={s.active} />{$t(
            'Active'
          )}</label
        ><button class="secondary">{$t('Update schedule')}</button>
      </form>{:else}<p class="muted">{$t('No recurring expenses.')}</p>{/each}
  </section>
  <Importer />
  <section class="panel">
    <h2>{$t('Export & recovery')}</h2>
    <p>
      {$t(
        'Export includes all profiles, canonical record values and attachment metadata. Original images need a file backup too.'
      )}
    </p>
    <button onclick={exportData}>{$t('Export records')}</button>
  </section>
  <section class="panel">
    <h2>{$t('About Roadbook')}</h2>
    <p>{$t('Source-available under Elastic License 2.0.')}</p>
    <div class="row">
      <a href="/license.txt" rel="external">{$t('License')}</a><a
        href="/third-party-notices.txt"
        rel="external">{$t('Third-party notices')}</a
      >
    </div>
  </section>
{:else}<p class="muted">{$t('Loading settings…')}</p>{/if}
