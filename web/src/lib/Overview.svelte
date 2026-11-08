<script lang="ts">
  import { translator as t, feedback } from './i18n';
  import { resolve } from '$app/paths';
  import { data, selectedVehicle } from './api';
  import { formatters as fmt } from './format';
  import Chart from './Chart.svelte';
  const vehicle = $derived(
    $data?.state.vehicles.find((v) => v.id === $selectedVehicle)
  );
  const stats = $derived($data?.stats[$selectedVehicle]);
  const settings = $derived($data?.state.settings);
  const distanceFactor = $derived(
    settings?.distance_unit === 'mi' ? 1609.344 : 1000
  );
  const currentYear = new Date().getFullYear().toString();
  const colors = [
    'var(--ts-primary)',
    '#137c8b',
    '#b8662d',
    '#3a7c51',
    '#aa4673',
    '#506bb3'
  ];
</script>

{#if $data && settings}
  {#if !vehicle || !stats}<section class="empty">
      <p class="eyebrow">{$t('Your vehicle, in perspective')}</p>
      <h2>{$t('Every journey has a story.')}</h2>
      <p>
        {$t(
          'Fuel, upkeep and the cost of getting there. Start with a name; add the rest when you have it.'
        )}
      </p>
      <a class="button" href={resolve('/settings')}>{$t('Set up Roadbook')}</a>
    </section>
  {:else}
    <div class="toolbar">
      <div>
        <p class="eyebrow">{$t('The whole picture')}</p>
        <h2>{vehicle.name}</h2>
      </div>
      <span class="muted">{$t('Recorded history ·')} {settings.currency}</span>
    </div>
    <div class="grid metrics">
      <section class="panel">
        <p class="eyebrow">{$t('Total expenses')}</p>
        <strong>{$fmt.money(stats.total_minor, settings.currency)}</strong
        ><small
          >{$t('Purchase, fuel, upkeep, insurance, tax & other costs')}</small
        >
      </section>
      <section class="panel">
        <p class="eyebrow">{$t('Fuel consumption')}</p>
        <strong data-testid="consumption"
          >{stats.fuel.consumption
            ? $fmt.consumption(
                stats.fuel.consumption,
                settings.distance_unit,
                settings.fuel_unit
              )
            : '—'}</strong
        ><small
          >{settings.fuel_unit}/100 {settings.distance_unit}
          {$t('· Complete full-to-full intervals')}</small
        >
      </section>
      <section class="panel">
        <p class="eyebrow">{$t('Fuel cost /')} {settings.distance_unit}</p>
        <strong
          >{stats.fuel.fuel_cost_per_km
            ? $fmt.number(
                Number(stats.fuel.fuel_cost_per_km) *
                  (settings.distance_unit === 'mi' ? 1.609344 : 1),
                4
              )
            : '—'}</strong
        ><small
          >{settings.currency}/{settings.distance_unit} · {$fmt.measurement(
            stats.fuel.priced_distance_m,
            settings.distance_unit
          )}
          {settings.distance_unit}
          {$t('with complete costs')}</small
        >
      </section>
      <section class="panel">
        <p class="eyebrow">{$t('Upkeep / month')}</p>
        <strong
          >{stats.upkeep_monthly
            ? $fmt.money(Number(stats.upkeep_monthly), settings.currency)
            : '—'}</strong
        ><small
          >{stats.upkeep_monthly
            ? $t(
                'Average over ownership · excludes fuel, insurance, tax & lease'
              )
            : $t(
                'Add an ownership start date to calculate this average'
              )}</small
        >
      </section>
    </div>
    <Chart
      title={$t('Fuel spending by month')}
      unit={settings.currency}
      currency={settings.currency}
      bars
      series={[
        {
          name: vehicle.name,
          color: colors[0],
          values: Object.entries(stats.monthly_fuel).map(([label, value]) => ({
            label,
            value: value / 100
          }))
        }
      ]}
    />
    <section class="panel">
      <h2>{$t('Distance through the years')}</h2>
      <p class="muted">
        {$t(
          "Recorded distance is assigned to the closing entry's date. No annual estimates or proportional splits."
        )}
      </p>
      {#if stats.annual_mode === 'total'}<p class="distance-total">
          <strong
            >{$fmt.measurement(
              stats.fuel.total_distance_m,
              settings.distance_unit
            )}</strong
          >
          {settings.distance_unit}
          {$t('recorded')}
        </p>
        <small
          >{$t(
            'Year-by-year comparison appears after one year of distance history.'
          )}</small
        >
      {:else if stats.annual_mode === 'years'}<div class="grid">
          {#each [String(Number(currentYear) - 1), currentYear] as year (year)}<div
            >
              <h3>
                {year}{year === currentYear ? $t(' · In progress') : $t('')}
              </h3>
              <strong
                >{stats.annual_distance[year] !== undefined
                  ? $fmt.measurement(
                      stats.annual_distance[year],
                      settings.distance_unit
                    )
                  : $t('No recorded distance')}</strong
              >
              {settings.distance_unit}
            </div>{/each}
        </div>
      {:else}<Chart
          title={$t('Annual distance by vehicle')}
          extraLabels={[currentYear]}
          unit={settings.distance_unit}
          series={$data.state.vehicles.map((v, i) => ({
            name: v.name,
            color: colors[i % colors.length],
            values: Object.entries(
              $data.stats[v.id]?.annual_distance || {}
            ).map(([label, value]) => ({
              label,
              value: value / distanceFactor
            }))
          }))}
        />{/if}
      <p>
        <small
          title={$t(
            'This is recorded distance, not a prediction. Missing records can leave earlier years incomplete too.'
          )}
          >{currentYear}
          {$t('is in progress. Its total changes as you add records.')}</small
        >
      </p>
    </section>
    {#if !stats.fuel.consumption || stats.fuel.warnings.length}<section
        class="panel"
      >
        <h2>{$t('Understand your coverage')}</h2>
        <p>
          {$t(
            'Spending includes recorded amounts even when consumption cannot be calculated. Consumption uses only complete intervals, assigned to their closing date.'
          )}
        </p>
        {#if !stats.fuel.consumption}<p class="notice">
            {$t(
              'No complete full-to-full fuel interval yet. Missing values are never estimated.'
            )}
          </p>{/if}
        <details>
          <summary
            >{stats.fuel.warnings.length} {$t('data gaps or warnings')}</summary
          >
          <ul>
            {#each stats.fuel.warnings as warning, warningIndex (warningIndex)}<li
              >
                {$feedback(warning)}
              </li>{/each}
          </ul>
        </details>
      </section>{/if}
    <section class="panel">
      <h2>{$t('Recent entries')}</h2>
      {#each $data.state.records
        .filter((e) => e.vehicle_id === vehicle.id)
        .toReversed()
        .slice(0, 5) as e (e.id)}<div class="recent">
          <span
            >{$fmt.date(e.date)} · {e.kind === 'fuel'
              ? e.station || $t('Fuel')
              : e.description || $t(e.category)}</span
          ><strong
            >{e.amount_minor === null
              ? $t('Unknown amount')
              : $fmt.money(e.amount_minor, settings.currency)}</strong
          >
        </div>{:else}<p class="muted">
          {$t('Add a fuel stop or expense to begin.')}
        </p>{/each}
    </section>
  {/if}
{:else}<p class="muted">{$t('Loading your overview…')}</p>{/if}
