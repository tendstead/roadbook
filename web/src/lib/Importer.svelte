<script lang="ts">
  import { resolve } from '$app/paths';
  import { translator as t, feedback } from './i18n';
  import {
    data,
    selectedVehicle,
    request,
    reload,
    message,
    type Entry,
    type Schedule
  } from './api';
  import { moneyInput, minor, display, scaled } from './units';
  import { inspectCSV, previewRows, dateFormats } from './import-preview';
  import { onMount } from 'svelte';
  import EntrySummary from './EntrySummary.svelte';
  interface Row {
    source_row: number;
    entry: Entry;
    schedule?: Schedule;
    warnings: string[];
    errors: string[];
    field_errors?: Record<string, string>;
    unknown_fields: string[];
  }
  let source = $state('');
  let filename = $state('');
  let delimiter = $state(',');
  let decimal = $state(',');
  let dateFormat = $state('DD.MM.YYYY');
  let distanceUnit = $state('km');
  let fuelUnit = $state('L');
  let kind = $state('fuel');
  let first = $state(2);
  let last = $state(0);
  let defaultCategory = $state('repair');
  let tankOverride = $state('full');
  let mappings = $state<Record<string, number>>({});
  let activeColumn = $state<number | null>(null);
  let rows = $state<Row[]>([]);
  let selected = $state<number[]>([]);
  let allowMatches = $state(false);
  let error = $state('');
  let notice = $state('');
  let busy = $state(false);
  let page = $state(0);
  let fileVersion = 0;
  onMount(() => {
    if (location.hash === '#import')
      document.getElementById('import')?.scrollIntoView();
  });
  const inspection = $derived.by(() => {
    try {
      return { cells: source ? inspectCSV(source, delimiter) : [], error: '' };
    } catch (e) {
      return { cells: [], error: message(e) };
    }
  });
  const headers = $derived(inspection.cells[0] || []);
  const columns = $derived(
    Object.fromEntries(Object.entries(mappings).filter(([, v]) => v >= 0))
  );
  const spec = $derived({
    csv: source,
    delimiter,
    decimal,
    date_format: dateFormat,
    kind,
    vehicle_id: $selectedVehicle,
    payer_id: $data?.profile_id || '',
    distance_unit: distanceUnit,
    fuel_unit: fuelUnit,
    start_row: Number(first),
    end_row: Number(last),
    columns,
    tank_override: kind === 'fuel' ? tankOverride : ''
  });
  const signature = $derived(
    JSON.stringify({
      spec,
      defaultCategory,
      currency: $data?.state.settings.currency
    })
  );
  let reviewKey = $state('');
  let previewSpec = $state<typeof spec | null>(null);
  $effect(() => {
    // Track interpretation/context only; edited review values do not invalidate it.
    void signature;
    rows = [];
    selected = [];
    previewSpec = null;
    reviewKey = '';
    allowMatches = false;
    page = 0;
  });
  const examples = $derived(
    previewRows(inspection.cells, {
      ...spec,
      default_category: defaultCategory
    })
  );
  const groups = $derived([
    {
      name: 'Required for saving',
      fields:
        kind === 'fuel'
          ? ['date']
          : kind === 'schedule'
            ? ['date', 'amount_minor', 'frequency']
            : ['date', 'amount_minor']
    },
    {
      name: 'Useful for statistics',
      fields:
        kind === 'fuel'
          ? [
              'amount_minor',
              'volume_ml',
              'distance_m',
              'odometer_m',
              'tank',
              'gap'
            ]
          : ['odometer_m']
    },
    {
      name: 'Optional details',
      fields:
        kind === 'fuel'
          ? ['station', 'fuel_type', 'notes']
          : kind === 'schedule'
            ? ['category', 'description', 'notes', 'end_date']
            : ['category', 'description', 'notes']
    }
  ]);
  const names: Record<string, string> = {
    date: 'Date',
    amount_minor: 'Amount paid',
    volume_ml: 'Fuel volume',
    distance_m: 'Distance driven',
    odometer_m: 'Total odometer',
    tank: 'Filled to full?',
    gap: 'Missing-record flag',
    station: 'Station',
    fuel_type: 'Fuel type',
    notes: 'Notes',
    category: 'Category',
    description: 'Description',
    frequency: 'Frequency',
    end_date: 'Last due date'
  };
  async function readFile(file?: File) {
    if (!file) return;
    const version = ++fileVersion;
    error = '';
    notice = '';
    source = '';
    filename = '';
    tankOverride = 'full';
    mappings = {};
    activeColumn = null;
    if (file.size > 1500000) {
      error = 'Use a CSV smaller than 1.5 MB';
      return;
    }
    try {
      const text = await file.text();
      if (version !== fileVersion) return;
      source = text;
      filename = file.name;
      distanceUnit = $data?.state.settings.distance_unit || 'km';
      fuelUnit = $data?.state.settings.fuel_unit || 'L';
    } catch (e) {
      if (version === fileVersion) error = message(e);
    }
  }
  function fileChosen(e: Event) {
    void readFile((e.currentTarget as HTMLInputElement).files?.[0]);
  }
  function dropFile(e: DragEvent) {
    e.preventDefault();
    void readFile(e.dataTransfer?.files[0]);
  }
  function dropColumn(e: DragEvent, field: string) {
    e.preventDefault();
    const raw = e.dataTransfer?.getData('application/x-roadbook-column');
    if (!raw || !/^\d+$/.test(raw)) return;
    const col = Number(raw);
    if (col < headers.length) {
      mappings[field] = col;
      activeColumn = null;
    }
  }
  async function preview() {
    error = '';
    notice = '';
    busy = true;
    const key = signature;
    const submitted = JSON.parse(JSON.stringify(spec)) as typeof spec;
    const category = defaultCategory;
    try {
      const result = await request<{ rows: Row[] }>(
        '/import/preview',
        'POST',
        submitted
      );
      if (key !== signature) return;
      rows = result.rows.map((row) => ({ ...row, unknown_fields: [] }));
      if (kind !== 'fuel' && !('category' in submitted.columns)) {
        for (const row of rows) {
          row.entry.category = category;
          if (row.schedule) row.schedule.template.category = category;
        }
      }
      selected = rows.filter((r) => !r.errors.length).map((r) => r.source_row);
      previewSpec = submitted;
      reviewKey = key;
      page = 0;
    } catch (e) {
      if (key === signature) error = message(e);
    } finally {
      busy = false;
    }
  }
  async function commit() {
    if (!previewSpec || reviewKey !== signature) return;
    error = '';
    busy = true;
    try {
      const result = await request<{ imported: number }>(
        '/import/commit',
        'POST',
        {
          spec: previewSpec,
          rows: rows.filter((r) => selected.includes(r.source_row)),
          allow_matches: allowMatches
        }
      );
      notice = `Imported ${result.imported} new records. Previously imported rows were skipped.`;
      await reload();
      rows = [];
    } catch (e) {
      error = message(e);
    } finally {
      busy = false;
    }
  }
</script>

<section
  class="panel import-workspace"
  id="import"
  aria-labelledby="import-title"
>
  <h2 id="import-title">{$t('Import CSV history')}</h2>
  <p class="muted">
    {$t(
      'Choose a table range and map its columns. Repeat for other tables in the same file. Every original cell is preserved with its record; summaries are not automatically treated as itemized expenses.'
    )}
  </p>
  {#if error}<p class="error" role="alert">{$feedback(error)}</p>{/if}
  {#if notice}<p class="notice" role="status">{$feedback(notice)}</p>{/if}
  {#if !$data?.state.vehicles.length}
    <p>{$t('Add a vehicle before importing.')}</p>
    <a class="button secondary" href={resolve('/settings#vehicle-setup')}
      >{$t('Add your first vehicle')}</a
    >
  {:else}
    <div
      class="file-drop"
      role="region"
      aria-label={$t('Drop CSV file')}
      ondragover={(e) => e.preventDefault()}
      ondrop={dropFile}
    >
      <strong>{$t('Drop a CSV file here')}</strong>
      <p>
        {$t(
          'Or choose a file. Your file stays in this browser until you request the import review.'
        )}
      </p>
      <label
        >{$t('CSV file')}<input
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          onchange={fileChosen}
        /></label
      >
      {#if filename}<small>{filename}</small>{/if}
    </div>
    {#if source}
      {#if kind === 'fuel'}
        <label
          >{$t('Fill type for this import')}
          <select
            bind:value={tankOverride}
            aria-label={$t('Fill type for this import')}
            aria-describedby="fill-override-help"
          >
            <option value="full">{$t('All fills were full')}</option>
            <option value=""
              >{$t('Use CSV values · unknown when not mapped')}</option
            >
            <option value="partial">{$t('All fills were partial')}</option>
            <option value="unknown">{$t('Mark all as unknown')}</option>
          </select>
          <small id="fill-override-help"
            >{$t(
              'A full fill means you filled the tank completely. This choice overrides the mapped column; individual rows can still be corrected in review.'
            )}</small
          >
        </label>
      {/if}
      <div class="grid source-controls">
        <label
          >{$t('Delimiter')}<select
            bind:value={delimiter}
            onchange={() => {
              mappings = {};
              activeColumn = null;
            }}
            ><option value=",">{$t('Comma')}</option><option value=";"
              >{$t('Semicolon')}</option
            ><option value="&#9;">{$t('Tab')}</option></select
          ></label
        >
        <label
          >{$t('Decimal separator')}<select bind:value={decimal}
            ><option value=",">{$t('Comma (1.234,56)')}</option><option
              value=".">{$t('Point (1,234.56)')}</option
            ></select
          ></label
        >
        <label
          >{$t('Date format')}<select bind:value={dateFormat}
            >{#each dateFormats as format (format)}<option>{format}</option
              >{/each}</select
          ></label
        >
        <label
          >{$t('Table type')}<select
            bind:value={kind}
            onchange={() => {
              mappings = {};
              activeColumn = null;
            }}
            ><option value="fuel">{$t('Fuel')}</option><option value="expense"
              >{$t('Expenses / upkeep')}</option
            ><option value="schedule">{$t('Recurring expenses')}</option
            ></select
          ></label
        >
        <label
          >{$t('First data row')}<input
            type="number"
            min="2"
            bind:value={first}
          /></label
        >
        <label
          >{$t('Last data row (0 = end)')}<input
            type="number"
            min="0"
            bind:value={last}
          /></label
        >
        <label
          >{$t('Source distance unit')}<select bind:value={distanceUnit}
            >{#each ['km', 'mi'] as unit (unit)}<option>{unit}</option
              >{/each}</select
          ></label
        >
        <label
          >{$t('Source fuel unit')}<select bind:value={fuelUnit}
            >{#each ['L', 'US gal', 'Imp gal'] as unit (unit)}<option
                >{unit}</option
              >{/each}</select
          ></label
        >
        {#if kind !== 'fuel'}<label
            >{$t('Default category')}<select bind:value={defaultCategory}
              >{#each ['repair', 'service', 'tyres', 'inspection', 'parts', 'purchase', 'insurance', 'tax', 'lease', 'parking', 'toll', 'other'] as category (category)}<option
                  value={category}>{$t(category)}</option
                >{/each}</select
            ></label
          >{/if}
      </div>
      <p class="muted">
        {$t(
          'Source currency: {currency}. Amounts are not converted between currencies.',
          { currency: $data!.state.settings.currency }
        )}
      </p>
      {#if inspection.error}<p class="error" role="alert">
          {$feedback(inspection.error)}
        </p>{:else}
        <h3>{$t('Source columns')}</h3>
        <p class="muted">
          {$t(
            'Drag a column onto a field, or select a column and choose its field. Dropdowns also work with touch and keyboard.'
          )}
        </p>
        <div class="source-columns">
          {#each headers as header, i (i)}
            <button
              class="secondary source-column"
              class:chosen={activeColumn === i}
              draggable="true"
              aria-label={$t('Use column {number}: {header}', {
                number: i + 1,
                header: header || $t('(unnamed)')
              })}
              aria-pressed={activeColumn === i}
              onclick={() => (activeColumn = activeColumn === i ? null : i)}
              ondragstart={(e) => {
                e.dataTransfer?.setData(
                  'application/x-roadbook-column',
                  String(i)
                );
                activeColumn = i;
              }}
            >
              <strong>{i + 1}: {header || $t('(unnamed)')}</strong>
              {#each examples as sample (sample.source_row)}<span
                  >{inspection.cells[sample.source_row - 1]?.[i] || '—'}</span
                >{/each}
            </button>
          {/each}
        </div>
        {#each groups as group (group.name)}
          <fieldset class="mapping-group">
            <legend>{$t(group.name)}</legend>
            <div class="mapping-fields">
              {#each group.fields as field (field)}
                <div
                  class="mapping-target"
                  data-field={field}
                  role="group"
                  aria-label={$t(names[field])}
                  ondragover={(e) => e.preventDefault()}
                  ondrop={(e) => dropColumn(e, field)}
                >
                  <button
                    class="secondary"
                    disabled={activeColumn === null}
                    aria-label={$t('Map {field}', { field: $t(names[field]) })}
                    onclick={() => {
                      if (activeColumn !== null) {
                        mappings[field] = activeColumn;
                        activeColumn = null;
                      }
                    }}>{$t(names[field])}</button
                  >
                  <label
                    >{$t(names[field])}
                    {$t('column')}
                    <select
                      value={mappings[field] ?? -1}
                      onchange={(e) =>
                        (mappings[field] = Number(e.currentTarget.value))}
                    >
                      <option value="-1"
                        >{$t('Not mapped · preserve source')}</option
                      >
                      {#each headers as header, i (i)}<option value={i}
                          >{i + 1}: {header || $t('(unnamed)')}</option
                        >{/each}
                    </select>
                  </label>
                  {#if (mappings[field] ?? -1) >= 0}<button
                      class="text-button"
                      onclick={() => {
                        mappings[field] = -1;
                      }}
                      aria-label={$t('Clear {field}', {
                        field: $t(names[field])
                      })}>{$t('Clear mapping')}</button
                    >{/if}
                </div>
              {/each}
            </div>
          </fieldset>
        {/each}
        <h3>{$t('Live examples')}</h3>
        <p class="muted">
          {$t(
            'Unsaved examples · Values update as you map columns. Nothing has been imported.'
          )}
        </p>
        {#if !examples.length}<p>{$t('No source rows in this range.')}</p>{/if}
        <div class="example-entries">
          {#each examples as sample (sample.source_row)}
            <article
              class="panel history-entry import-example"
              class:incomplete={sample.issues.length > 0}
            >
              <small
                >{$t('Source row')}
                {sample.source_row} · {$t('Unsaved example')}</small
              >
              <EntrySummary
                entry={sample.entry}
                settings={$data!.state.settings}
              />
              {#if sample.issues.length}<ul class="muted">
                  {#each sample.issues as issue (issue)}<li>
                      {$feedback(issue)}
                    </li>{/each}
                </ul>{/if}
            </article>
          {/each}
        </div>
        <button
          class="secondary"
          disabled={busy || !examples.length}
          onclick={preview}>{$t('Preview import')}</button
        >
      {/if}
    {/if}
    {#if rows.length}<h3>{$t('Review')} {rows.length} {$t('rows')}</h3>
      <p>
        {$t(
          'Correct dates and values before selecting a row. Source warnings remain visible for reference. Nothing is saved until you import.'
        )}
      </p>
      <div class="scroll">
        <table>
          <thead
            ><tr
              ><th>{$t('Include')}</th><th>{$t('Source row')}</th><th
                >{$t('Date')}</th
              ><th>{$t('Amount')}</th>{#if kind === 'fuel'}<th
                  >{$t('Volume')}</th
                ><th>{$t('Distance')}</th><th>{$t('Filled to full?')}</th
                >{:else}<th>{$t('Category')}</th
                >{/if}{#if kind === 'schedule'}<th>{$t('Frequency')}</th><th
                  >{$t('Last due date')}</th
                >{/if}<th>{$t('Source issues')}</th></tr
            ></thead
          ><tbody>
            {#each rows.slice(page * 100, (page + 1) * 100) as row (row.source_row)}<tr
                ><td
                  ><input
                    type="checkbox"
                    aria-label={$t('Include row {row}', {
                      row: row.source_row
                    })}
                    value={row.source_row}
                    bind:group={selected}
                  /></td
                ><td>{row.source_row}</td>
                <td
                  ><input
                    type="date"
                    aria-label={$t('Date row {row}', { row: row.source_row })}
                    bind:value={row.entry.date}
                  /></td
                >
                <td
                  ><input
                    aria-label={$t('Amount row {row}', { row: row.source_row })}
                    value={moneyInput(row.entry.amount_minor)}
                    onchange={(e) => {
                      try {
                        row.entry.amount_minor = minor(e.currentTarget.value);
                      } catch (e) {
                        error = message(e);
                      }
                    }}
                  /></td
                >
                {#if kind === 'fuel'}<td
                    ><input
                      aria-label={$t('Volume row {row}', {
                        row: row.source_row
                      })}
                      value={display(
                        row.entry.volume_ml,
                        $data!.state.settings.fuel_unit
                      )}
                      onchange={(e) => {
                        try {
                          row.entry.volume_ml = scaled(
                            e.currentTarget.value,
                            $data!.state.settings.fuel_unit
                          );
                        } catch (e) {
                          error = message(e);
                        }
                      }}
                    /></td
                  ><td
                    ><input
                      aria-label={$t('Distance row {row}', {
                        row: row.source_row
                      })}
                      value={display(
                        row.entry.distance_m,
                        $data!.state.settings.distance_unit
                      )}
                      onchange={(e) => {
                        try {
                          row.entry.distance_m = scaled(
                            e.currentTarget.value,
                            $data!.state.settings.distance_unit
                          );
                        } catch (e) {
                          error = message(e);
                        }
                      }}
                    /></td
                  ><td
                    ><select
                      aria-label={$t('Fill type row {row}', {
                        row: row.source_row
                      })}
                      bind:value={row.entry.tank}
                      ><option value="full">{$t('Full fill')}</option><option
                        value="partial">{$t('Partial fill')}</option
                      ><option value="unknown">{$t('Unknown')}</option></select
                    ></td
                  >{:else}<td
                    ><select
                      bind:value={row.entry.category}
                      aria-label={$t('Category row {row}', {
                        row: row.source_row
                      })}
                      >{#each ['repair', 'service', 'tyres', 'inspection', 'parts', 'purchase', 'insurance', 'tax', 'lease', 'parking', 'toll', 'other'] as category (category)}<option
                          value={category}>{$t(category)}</option
                        >{/each}</select
                    ></td
                  >{/if}
                {#if row.schedule}<td
                    ><select
                      aria-label={$t('Frequency row {row}', {
                        row: row.source_row
                      })}
                      bind:value={row.schedule.months}
                      ><option value={1}>{$t('Monthly')}</option><option
                        value={3}>{$t('Quarterly')}</option
                      ><option value={12}>{$t('Annually')}</option></select
                    ></td
                  ><td
                    ><input
                      type="date"
                      aria-label={$t('End date row {row}', {
                        row: row.source_row
                      })}
                      bind:value={row.schedule.end}
                    /></td
                  >{/if}
                <td
                  >{[...row.errors, ...row.warnings]
                    .map((value) => $feedback(value))
                    .join('; ') || $t('Ready')}
                  {#each Object.keys(row.field_errors || {}) as field (field)}
                    <label class="checkbox"
                      ><input
                        type="checkbox"
                        value={field}
                        bind:group={row.unknown_fields}
                      />
                      {field === 'end_date'
                        ? $t('Continue without an end date (until stopped)')
                        : $t('Explicitly accept invalid {field} as unknown', {
                            field: $t(names[field])
                          })}</label
                    >
                  {/each}
                </td></tr
              >{/each}
          </tbody>
        </table>
      </div>
      {#if rows.length > 100}<div class="row">
          <button class="secondary" disabled={page === 0} onclick={() => page--}
            >{$t('Previous rows')}</button
          ><span>{$t('Page')} {page + 1} / {Math.ceil(rows.length / 100)}</span
          ><button
            class="secondary"
            disabled={(page + 1) * 100 >= rows.length}
            onclick={() => page++}>{$t('Next rows')}</button
          >
        </div>{/if}
      <label class="checkbox"
        ><input type="checkbox" bind:checked={allowMatches} />
        {$t(
          'I reviewed matching existing records and want to allow them'
        )}</label
      >
      <button
        disabled={busy || !selected.length || reviewKey !== signature}
        onclick={commit}
        >{$t('Import {count} selected rows', {
          count: selected.length
        })}</button
      >
    {/if}{/if}
</section>
