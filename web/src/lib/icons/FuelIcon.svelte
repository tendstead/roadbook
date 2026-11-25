<script lang="ts">
  import Icon from '../Icon.svelte';
  let {
    size = 24
  }: { size?: number | string; 'aria-hidden'?: boolean | 'true' | 'false' } =
    $props();
</script>

<Icon name="fuel" {size} />
