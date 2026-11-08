<script lang="ts">
  import { formatters as fmt } from './format';
  import { translator as t } from './i18n';
  import { labelIndexes } from './chart-layout';
  type Value = { label: string; value: number };
  type Series = { name: string; color: string; values: Value[] };
  let {
    title,
    series,
    unit = '',
    currency = '',
    bars = false,
    extraLabels = []
  }: {
    title: string;
    series: Series[];
    unit?: string;
    currency?: string;
    bars?: boolean;
    extraLabels?: string[];
  } = $props();
  const id = $props.id();
  let width = $state(640);
  const chartWidth = $derived(Math.max(260, width));
  const left = 90;
  const plotWidth = $derived(chartWidth - left - 18);
  const labels = $derived(
    [
      ...new Set([
        ...series.flatMap((s) => s.values.map((v) => v.label)),
        ...extraLabels
      ])
    ].sort()
  );
  const max = $derived(
    Math.max(1, ...series.flatMap((s) => s.values.map((v) => v.value)))
  );
  const visibleLabels = $derived(
    labelIndexes(labels.length, Math.max(2, Math.floor(plotWidth / 105) + 1))
  );
  let active = $state<{ name: string; label: string; value: number } | null>(
    null
  );
  let pinned = $state(false);
  $effect(() => {
    void series;
    void unit;
    void currency;
    active = null;
    pinned = false;
  });
  function x(label: string) {
    if (labels.length === 1) return left + plotWidth / 2;
    const inset = bars
      ? Math.min(22, (plotWidth / labels.length) * 0.75) / 2
      : 0;
    return (
      left +
      inset +
      (labels.indexOf(label) * (plotWidth - 2 * inset)) / (labels.length - 1)
    );
  }
  function y(value: number) {
    return 190 - (value / max) * 155;
  }
  function formatted(value: number) {
    return currency
      ? $fmt.money(Math.round(value * 100), currency)
      : `${$fmt.number(value, value % 1 ? 2 : 0)} ${unit}`;
  }
  function show(name: string, value: Value) {
    active = { name, ...value };
  }
  function toggle(name: string, value: Value) {
    if (pinned && active?.name === name && active.label === value.label) {
      active = null;
      pinned = false;
    } else {
      show(name, value);
      pinned = true;
    }
  }
  function close() {
    active = null;
    pinned = false;
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') close();
  }}
  onpointerdown={(e) => {
    if (
      !(e.target instanceof Element) ||
      !e.target.closest(`[data-chart="${id}"]`)
    )
      close();
  }}
/>
<section class="panel chart">
  <h2>{title}</h2>
  {#if labels.length}
    <div class="chart-plot" bind:clientWidth={width} data-chart={id}>
      <svg viewBox={`0 0 ${chartWidth} 235`} role="group" aria-label={title}>
        <title>{title}</title>
        {#each [0, 0.25, 0.5, 0.75, 1] as fraction (fraction)}
          <line
            class="chart-grid"
            x1={left}
            x2={chartWidth - 18}
            y1={y(max * fraction)}
            y2={y(max * fraction)}
            stroke="var(--ts-border)"
          />
          <text
            class="y-axis-label"
            x={left - 9}
            y={y(max * fraction) + 4}
            text-anchor="end"
            font-size="11"
            fill="currentColor">{formatted(max * fraction)}</text
          >
        {/each}
        {#each visibleLabels as index (index)}
          <text
            class="x-axis-label"
            x={labels.length === 1
              ? left + plotWidth / 2
              : index === 0
                ? left
                : index === labels.length - 1
                  ? chartWidth - 18
                  : x(labels[index])}
            y="218"
            text-anchor={labels.length === 1
              ? 'middle'
              : index === 0
                ? 'start'
                : index === labels.length - 1
                  ? 'end'
                  : 'middle'}
            font-size="11"
            fill="currentColor">{$fmt.period(labels[index])}</text
          >
        {/each}
        {#each series as s, seriesIndex (seriesIndex)}
          {#if !bars}<polyline
              points={s.values
                .map((v) => `${x(v.label)},${y(v.value)}`)
                .join(' ')}
              fill="none"
              stroke={s.color}
              stroke-width="2.5"
            />{/if}
          {#each s.values as v (v.label)}
            <g
              role="button"
              tabindex="0"
              aria-label={`${s.name}, ${$fmt.period(v.label)}: ${formatted(v.value)}`}
              aria-describedby={active?.name === s.name &&
              active.label === v.label
                ? id + '-tooltip'
                : undefined}
              onpointerenter={() => {
                if (!pinned) show(s.name, v);
              }}
              onpointerleave={() => {
                if (!pinned) active = null;
              }}
              onfocus={() => show(s.name, v)}
              onblur={() => {
                if (!pinned) active = null;
              }}
              onclick={() => toggle(s.name, v)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(s.name, v);
                }
              }}
            >
              {#if bars}
                <rect
                  class="chart-mark"
                  x={x(v.label) -
                    Math.min(22, (plotWidth / labels.length) * 0.75) / 2}
                  y={y(v.value)}
                  width={Math.min(22, (plotWidth / labels.length) * 0.75)}
                  height={Math.max(0, 190 - y(v.value))}
                  rx="3"
                  fill={s.color}
                />
                <rect
                  x={x(v.label) - plotWidth / labels.length / 2}
                  y="30"
                  width={plotWidth / labels.length}
                  height="162"
                  fill="transparent"
                />
              {:else}
                <circle
                  class="chart-mark"
                  cx={x(v.label)}
                  cy={y(v.value)}
                  r="4.5"
                  fill={s.color}
                />
                <circle
                  cx={x(v.label)}
                  cy={y(v.value)}
                  r="12"
                  fill="transparent"
                />
              {/if}
            </g>
          {/each}
        {/each}
      </svg>
      {#if active}
        <div
          class="chart-tooltip"
          id={id + '-tooltip'}
          role="tooltip"
          style:left={`${Math.max(0, Math.min(chartWidth - 210, x(active.label) - 100))}px`}
          style:top={`${Math.max(0, y(active.value) - 78)}px`}
        >
          <strong>{$fmt.period(active.label)}</strong><span>{active.name}</span
          ><span>{formatted(active.value)}</span>
        </div>
      {/if}
    </div>
    {#if series.length > 1}<div class="row">
        {#each series as s, i (i)}<small
            ><span style:color={s.color}>●</span> {s.name}</small
          >{/each}
      </div>{/if}
    <div class="sr-only">
      <table>
        <caption>{title} · {unit}</caption><thead
          ><tr
            ><th>{$t('Period')}</th>{#each series as s, i (i)}<th>{s.name}</th
              >{/each}</tr
          ></thead
        >
        <tbody
          >{#each labels as label (label)}<tr
              ><th>{$fmt.period(label)}</th>{#each series as s, i (i)}<td
                  >{s.values.find((v) => v.label === label)
                    ? formatted(s.values.find((v) => v.label === label)!.value)
                    : $t('No recorded distance')}</td
                >{/each}</tr
            >{/each}</tbody
        >
      </table>
    </div>
  {:else}<p class="muted">{$t('No recorded data yet.')}</p>{/if}
</section>
