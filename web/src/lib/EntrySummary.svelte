<script lang="ts">
  import { translator as t } from './i18n';
  import { formatters as fmt } from './format';
  import type { Entry, Settings } from './api';
  let { entry, settings }: { entry: Entry; settings: Settings } = $props();
</script>

<div class="toolbar">
  <div>
    <small
      >{entry.date
        ? $fmt.date(entry.date)
        : $t('Date unknown')}{#if entry.schedule_id}{$t(
          '· Recurring'
        )}{/if}</small
    >
    <h3>
      {entry.kind === 'fuel'
        ? entry.station || $t('Fuel stop')
        : entry.description || $t(entry.category)}
    </h3>
  </div>
  <strong
    >{entry.amount_minor === null
      ? $t('Amount unknown')
      : $fmt.money(entry.amount_minor, settings.currency)}</strong
  >
</div>
{#if entry.kind === 'fuel'}<p class="entry-measurements">
    {$fmt.measurement(entry.volume_ml, settings.fuel_unit) ||
      $t('Volume unknown')}
    {settings.fuel_unit} · {entry.distance_m !== null
      ? $t('{distance} {unit} driven', {
          distance: $fmt.measurement(entry.distance_m, settings.distance_unit),
          unit: settings.distance_unit
        })
      : entry.odometer_m !== null
        ? $t('Odometer {value} {unit}', {
            value: $fmt.measurement(entry.odometer_m, settings.distance_unit),
            unit: settings.distance_unit
          })
        : $t('Distance unknown')} · {$t('Fill type: {status}', {
      status: $t(
        entry.tank === 'full'
          ? 'Full fill'
          : entry.tank === 'partial'
            ? 'Partial fill'
            : 'Unknown'
      )
    })}
  </p>{/if}
{#if entry.gap || (entry.tank === 'unknown' && entry.kind === 'fuel') || (entry.volume_ml === null && entry.kind === 'fuel')}<p
    class="muted entry-warning"
  >
    {$t(
      'Incomplete interval · Recorded values are retained; no missing data is assumed.'
    )}
  </p>{/if}
{#if entry.notes}<p class="entry-notes">{entry.notes}</p>{/if}
