<script lang="ts">
  import {
    data,
    selectedVehicle,
    request,
    reload,
    message,
    type Entry,
    type Schedule
  } from './api';
  import { parseCSV } from './csv';
  import { moneyInput, minor, display, scaled } from './units';
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
  let delimiter = $state(',');
  let decimal = $state(',');
  let dateFormat = $state('DD.MM.YYYY');
  let kind = $state('fuel');
  let first = $state(2);
  let last = $state(0);
  let defaultCategory = $state('repair');
  let mappings = $state<Record<string, number>>({});
  let headers = $state<string[]>([]);
  let rows = $state<Row[]>([]);
  let selected = $state<number[]>([]);
  let allowMatches = $state(false);
  let error = $state('');
  let notice = $state('');
  let busy = $state(false);
  let previewSpec = $state<unknown>(null);
  let page = $state(0);
  const fields = $derived(
    kind === 'fuel'
      ? [
          'date',
          'amount_minor',
          'volume_ml',
          'distance_m',
          'odometer_m',
          'tank',
          'gap',
          'station',
          'fuel_type',
          'notes'
        ]
      : kind === 'schedule'
        ? [
            'date',
            'amount_minor',
            'category',
            'description',
            'frequency',
            'end_date',
            'notes'
          ]
        : [
            'date',
            'amount_minor',
            'category',
            'description',
            'odometer_m',
            'notes'
          ]
  );
  const names: Record<string, string> = {
    date: 'Date',
    amount_minor: 'Amount paid',
    volume_ml: 'Fuel volume',
    distance_m: 'Distance driven',
    odometer_m: 'Total odometer',
    tank: 'Tank status',
    gap: 'Missing-record flag',
    station: 'Station',
    fuel_type: 'Fuel type',
    notes: 'Notes',
    category: 'Category',
    description: 'Description',
    frequency: 'Frequency',
    end_date: 'Last due date'
  };
  function inspect() {
    try {
      headers = parseCSV(source, delimiter)[0] || [];
      rows = [];
      mappings = {};
      error = '';
    } catch (e) {
      error = message(e);
    }
  }
  async function fileChosen(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 1500000) {
      error = 'Use a CSV smaller than 1.5 MB';
      return;
    }
    source = await file.text();
    inspect();
  }
  async function preview() {
    error = '';
    notice = '';
    busy = true;
    try {
      const columns = Object.fromEntries(
        Object.entries(mappings).filter(([, v]) => v >= 0)
      );
      const spec = {
        csv: source,
        delimiter,
        decimal,
        date_format: dateFormat,
        kind,
        vehicle_id: $selectedVehicle,
        payer_id: $data!.profile_id,
        distance_unit: $data!.state.settings.distance_unit,
        fuel_unit: $data!.state.settings.fuel_unit,
        start_row: Number(first),
        end_row: Number(last),
        columns
      };
      const result = await request<{ rows: Row[] }>(
        '/import/preview',
        'POST',
        spec
      );
      rows = result.rows.map((row) => ({ ...row, unknown_fields: [] }));
      if (kind !== 'fuel' && !('category' in columns)) {
        for (const row of rows) {
          row.entry.category = defaultCategory;
          if (row.schedule) row.schedule.template.category = defaultCategory;
        }
      }
      selected = rows.filter((r) => !r.errors.length).map((r) => r.source_row);
      previewSpec = spec;
      page = 0;
    } catch (e) {
      error = message(e);
    } finally {
      busy = false;
    }
  }
  async function commit() {
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

<section class="panel">
  <h2>Import CSV history</h2>
  <p class="muted">
    Choose a table range and map its columns. Repeat for other tables in the
    same file. Every original cell is preserved with its record; summaries are
    not automatically treated as itemized expenses.
  </p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}{#if notice}<p
      class="notice"
      role="status"
    >
      {notice}
    </p>{/if}
  {#if !$data?.state.vehicles.length}<p>
      Add a vehicle before importing.
    </p>{:else}
    <label
      >CSV file<input
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        onchange={fileChosen}
      /></label
    >
    {#if source}<div class="grid">
        <label
          >Delimiter<select bind:value={delimiter} onchange={inspect}
            ><option value=",">Comma</option><option value=";">Semicolon</option
            ><option value="&#9;">Tab</option></select
          ></label
        >
        <label
          >Decimal separator<select bind:value={decimal}
            ><option value=",">Comma (1.234,56)</option><option value="."
              >Point (1,234.56)</option
            ></select
          ></label
        >
        <label
          >Date format<select bind:value={dateFormat}
            >{#each ['DD.MM.YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'] as format (format)}<option
                >{format}</option
              >{/each}</select
          ></label
        >
        <label
          >Table type<select
            bind:value={kind}
            onchange={() => {
              rows = [];
              mappings = {};
            }}
            ><option value="fuel">Fuel</option><option value="expense"
              >Expenses / upkeep</option
            ><option value="schedule">Recurring expenses</option></select
          ></label
        >
        <label
          >First data row<input
            type="number"
            min="2"
            bind:value={first}
          /></label
        ><label
          >Last data row (0 = end)<input
            type="number"
            min="0"
            bind:value={last}
          /></label
        >
        {#if kind !== 'fuel'}<label
            >Default category<select bind:value={defaultCategory}
              >{#each ['repair', 'service', 'tyres', 'inspection', 'parts', 'purchase', 'insurance', 'tax', 'lease', 'other'] as category (category)}<option
                  >{category}</option
                >{/each}</select
            ></label
          >{/if}
      </div>
      <p>
        <small
          >Source measurements use the current installation units: {$data!.state
            .settings.distance_unit}, {$data!.state.settings.fuel_unit}, {$data!
            .state.settings.currency}. Change units before import if needed;
          existing records are converted, not relabelled.</small
        >
      </p>
      <div class="grid">
        {#each fields as field (field)}<label
            >{names[field]} column<select
              value={mappings[field] ?? -1}
              onchange={(e) =>
                (mappings[field] = Number(e.currentTarget.value))}
              ><option value="-1">Not mapped · preserve source</option
              >{#each headers as header, i (i)}<option value={i}
                  >{i + 1}: {header || '(unnamed)'}</option
                >{/each}</select
            ></label
          >{/each}
      </div>
      <button class="secondary" disabled={busy} onclick={preview}
        >Preview import</button
      >
    {/if}
    {#if rows.length}<h3>Review {rows.length} rows</h3>
      <p>
        Correct dates and values before selecting a row. Source warnings remain
        visible for reference. Nothing is saved until you import.
      </p>
      <div class="scroll">
        <table>
          <thead
            ><tr
              ><th>Include</th><th>Source row</th><th>Date</th><th>Amount</th
              >{#if kind === 'fuel'}<th>Volume</th><th>Distance</th><th>Tank</th
                >{:else}<th>Category</th>{/if}{#if kind === 'schedule'}<th
                  >Frequency</th
                ><th>Last due date</th>{/if}<th>Source issues</th></tr
            ></thead
          ><tbody>
            {#each rows.slice(page * 100, (page + 1) * 100) as row (row.source_row)}<tr
                ><td
                  ><input
                    type="checkbox"
                    aria-label={`Include row ${row.source_row}`}
                    value={row.source_row}
                    bind:group={selected}
                  /></td
                ><td>{row.source_row}</td>
                <td
                  ><input
                    type="date"
                    aria-label={`Date row ${row.source_row}`}
                    bind:value={row.entry.date}
                  /></td
                >
                <td
                  ><input
                    aria-label={`Amount row ${row.source_row}`}
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
                      aria-label={`Volume row ${row.source_row}`}
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
                      aria-label={`Distance row ${row.source_row}`}
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
                      aria-label={`Tank row ${row.source_row}`}
                      bind:value={row.entry.tank}
                      ><option value="unknown">Unknown</option><option
                        value="full">Full</option
                      ><option value="partial">Partial</option></select
                    ></td
                  >{:else}<td
                    ><select
                      bind:value={row.entry.category}
                      aria-label={`Category row ${row.source_row}`}
                      >{#each ['repair', 'service', 'tyres', 'inspection', 'parts', 'purchase', 'insurance', 'tax', 'lease', 'parking', 'toll', 'other'] as category (category)}<option
                          >{category}</option
                        >{/each}</select
                    ></td
                  >{/if}
                {#if row.schedule}<td
                    ><select
                      aria-label={`Frequency row ${row.source_row}`}
                      bind:value={row.schedule.months}
                      ><option value={1}>Monthly</option><option value={3}
                        >Quarterly</option
                      ><option value={12}>Annually</option></select
                    ></td
                  ><td
                    ><input
                      type="date"
                      aria-label={`End date row ${row.source_row}`}
                      bind:value={row.schedule.end}
                    /></td
                  >{/if}
                <td
                  >{[...row.errors, ...row.warnings].join('; ') || 'Ready'}
                  {#each Object.keys(row.field_errors || {}) as field (field)}
                    <label class="checkbox"
                      ><input
                        type="checkbox"
                        value={field}
                        bind:group={row.unknown_fields}
                      />
                      {field === 'end_date'
                        ? 'Continue without an end date (until stopped)'
                        : `Explicitly accept invalid ${names[field]} as unknown`}</label
                    >
                  {/each}
                </td></tr
              >{/each}
          </tbody>
        </table>
      </div>
      {#if rows.length > 100}<div class="row">
          <button class="secondary" disabled={page === 0} onclick={() => page--}
            >Previous rows</button
          ><span>Page {page + 1} / {Math.ceil(rows.length / 100)}</span><button
            class="secondary"
            disabled={(page + 1) * 100 >= rows.length}
            onclick={() => page++}>Next rows</button
          >
        </div>{/if}
      <label class="checkbox"
        ><input type="checkbox" bind:checked={allowMatches} /> I reviewed matching
        existing records and want to allow them</label
      >
      <button disabled={busy || !selected.length} onclick={commit}
        >Import {selected.length} selected rows</button
      >
    {/if}{/if}
</section>
