<script lang="ts">
  import { formatters as fmt } from './format';
  import { translator as t } from './i18n';
  let {
    title,
    series,
    unit = '',
    bars = false,
    extraLabels = []
  }: {
    title: string;
    series: {
      name: string;
      color: string;
      values: { label: string; value: number }[];
    }[];
    unit?: string;
    bars?: boolean;
    extraLabels?: string[];
  } = $props();
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
  function x(label: string) {
    return 55 + (labels.indexOf(label) * 560) / Math.max(1, labels.length - 1);
  }
  function y(value: number) {
    return 180 - (value / max) * 145;
  }
</script>

<section class="panel chart">
  <h2>{title}</h2>
  {#if labels.length}
    <svg viewBox="0 0 670 225" role="img" aria-label={title}>
      <title
        >{title}{$t('. Exact values are available in the table below.')}</title
      >
      <path d="M45 25V180H635" stroke="var(--ts-border)" fill="none" />
      <text x="0" y="32" font-size="11" fill="currentColor"
        >{$fmt.number(max)}</text
      >
      {#each labels as label, index (label)}{#if index % Math.max(1, Math.ceil(labels.length / 6)) === 0 || index === labels.length - 1}<text
            x={x(label)}
            y="205"
            text-anchor="middle"
            font-size="11"
            fill="currentColor">{$fmt.period(label)}</text
          >{/if}{/each}
      {#each series as s, seriesIndex (seriesIndex)}
        {#if !bars}<polyline
            points={s.values
              .map((v) => `${x(v.label)},${y(v.value)}`)
              .join(' ')}
            fill="none"
            stroke={s.color}
            stroke-width="2.5"
          />{/if}
        {#each s.values as v (v.label)}{#if bars}<rect
              x={x(v.label) - Math.min(18, 450 / labels.length) / 2}
              y={y(v.value)}
              width={Math.min(18, 450 / labels.length)}
              height={Math.max(0, 180 - y(v.value))}
              rx="3"
              fill={s.color}
              ><title
                >{$fmt.period(v.label)}: {$fmt.number(v.value, 2)} {unit}</title
              ></rect
            >{:else}<circle
              cx={x(v.label)}
              cy={y(v.value)}
              r="4.5"
              fill={s.color}
              ><title
                >{s.name}, {$fmt.period(v.label)}: {$fmt.number(v.value, 2)}
                {unit}</title
              ></circle
            >{/if}{/each}
      {/each}
    </svg>
    {#if series.length > 1}<div class="row">
        {#each series as s, i (i)}<small
            ><span style:color={s.color}>●</span> {s.name}</small
          >{/each}
      </div>{/if}
    <details>
      <summary>{$t('View values ·')} {unit}</summary>
      <div class="scroll">
        <table>
          <thead
            ><tr
              ><th>{$t('Period')}</th
              >{#each series as s, seriesIndex (seriesIndex)}<th
                  ><span style:color={s.color}>●</span> {s.name}</th
                >{/each}</tr
            ></thead
          ><tbody
            >{#each labels as label (label)}<tr
                ><th>{$fmt.period(label)}</th
                >{#each series as s, seriesIndex (seriesIndex)}<td
                    >{s.values.find((v) => v.label === label)
                      ? $fmt.number(
                          s.values.find((v) => v.label === label)!.value,
                          2
                        )
                      : $t('No recorded distance')}</td
                  >{/each}</tr
              >{/each}</tbody
          >
        </table>
      </div>
    </details>
  {:else}<p class="muted">{$t('No recorded data yet.')}</p>{/if}
</section>
