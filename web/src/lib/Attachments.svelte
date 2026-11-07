<script lang="ts">
  import { data, request, reload, message, type Attachment } from './api';
  let { entryID }: { entryID: string } = $props();
  const images = $derived(
    $data?.state.attachments.filter((a) => a.entry_id === entryID) || []
  );
  let opened = $state<Attachment | null>(null);
  let viewer: HTMLDialogElement;
  let failed = $state<string[]>([]);
  let error = $state('');
  let deleting = $state('');
  function url(at: Attachment, variant: string) {
    return `/api/attachments/${at.id}/${variant}?profile=${$data?.profile_id}`;
  }
  function open(at: Attachment) {
    opened = at;
    viewer.showModal();
  }
  async function remove(id: string) {
    try {
      await request('/attachments/' + id, 'DELETE');
      deleting = '';
      await reload();
    } catch (e) {
      error = message(e);
    }
  }
</script>

{#if error}<p class="error" role="alert">{error}</p>{/if}
<div class="attachments">
  {#each images as at (at.id)}<div class="attachment">
      <button
        class="thumbnail"
        onclick={() => open(at)}
        aria-label={`Open ${at.purpose}: ${at.filename}`}
      >
        {#if at.has_thumbnail && !failed.includes(at.id)}<img
            src={url(at, 'thumb')}
            alt={`${at.purpose}: ${at.filename}`}
            loading="lazy"
            decoding="async"
            onerror={() => (failed = [...failed, at.id])}
          />{:else}<span
            >Preview unavailable<br /><small>Open original</small></span
          >{/if}
      </button><small>{at.purpose}</small>
      {#if deleting === at.id}<button
          class="danger"
          onclick={() => remove(at.id)}>Confirm image deletion</button
        ><button class="secondary" onclick={() => (deleting = '')}
          >Keep image</button
        >{:else}<button class="text-button" onclick={() => (deleting = at.id)}
          >Remove image</button
        >{/if}
    </div>{/each}
</div>
<dialog
  bind:this={viewer}
  onclose={() => (opened = null)}
  aria-label="Attachment viewer"
>
  {#if opened}<div class="toolbar">
      <span
        >{opened.filename} · {(opened.bytes / 1048576).toFixed(1)} MiB original</span
      ><button class="secondary" onclick={() => viewer.close()}
        >Close image</button
      >
    </div>
    <img class="original" src={url(opened, 'original')} alt={opened.filename} />
    <!-- API download, not SPA navigation. -->
    <a
      class="button secondary"
      href={url(opened, 'original') + '&download=1'}
      rel="external"
      download={opened.filename}>Download original</a
    >{/if}
</dialog>
