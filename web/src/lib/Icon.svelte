<script lang="ts">
  export let size: number | string = 24;
  export let name = 'road';
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'fuel'}<path
      d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 6h6v5H6zM14 12h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V8l-3-3"
    />
  {:else if name === 'sun'}<circle cx="12" cy="12" r="4" /><path
      d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"
    />
  {:else if name === 'moon'}<path
      d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"
    />
  {:else if name === 'costs'}<path
      d="m14 6 4-3 3 3-3 4-4-4ZM14 6 3 17l4 4L18 10M6 6l3 3M3 3l3 3"
    />
  {:else if name === 'settings'}<circle cx="12" cy="8" r="4" /><path
      d="M4 21v-2a8 8 0 0 1 16 0v2"
    />
  {:else}<path d="m8 3-5 18M16 3l5 18M12 3v3M12 10v4M12 18v3" />{/if}
</svg>
