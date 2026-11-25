<script lang="ts">
  import { formatters as fmt } from './format';
  import { translator as t, feedback } from './i18n';
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

{#if error}<p class="error" role="alert">{$feedback(error)}</p>{/if}
<div class="attachments">
  {#each images as at (at.id)}<div class="attachment">
      <button
        class="thumbnail"
        onclick={() => open(at)}
        aria-label={$t('Open {purpose}: {filename}', {
          purpose: $t(at.purpose),
          filename: at.filename
        })}
      >
        {#if at.has_thumbnail && !failed.includes(at.id)}<img
            src={url(at, 'thumb')}
            alt={`${$t(at.purpose)}: ${at.filename}`}
            loading="lazy"
            decoding="async"
            onerror={() => (failed = [...failed, at.id])}
          />{:else}<span
            >{$t('Preview unavailable')}<br /><small
              >{$t('Open original')}</small
            ></span
          >{/if}
      </button><small>{$t(at.purpose)}</small>
      {#if deleting === at.id}<button
          class="danger"
          onclick={() => remove(at.id)}>{$t('Confirm image deletion')}</button
        ><button class="secondary" onclick={() => (deleting = $t(''))}
          >{$t('Keep image')}</button
        >{:else}<button class="text-button" onclick={() => (deleting = at.id)}
          >{$t('Remove image')}</button
        >{/if}
    </div>{/each}
</div>
<dialog
  bind:this={viewer}
  onclose={() => (opened = null)}
  aria-label={$t('Attachment viewer')}
>
  {#if opened}<div class="toolbar">
      <span
        >{opened.filename} · {$fmt.number(opened.bytes / 1048576, 1)}
        {$t('MiB original')}</span
      ><button class="secondary" onclick={() => viewer.close()}
        >{$t('Close image')}</button
      >
    </div>
    <img class="original" src={url(opened, 'original')} alt={opened.filename} />
    <!-- API download, not SPA navigation. -->
    <a
      class="button secondary"
      href={url(opened, 'original') + '&download=1'}
      rel="external"
      download={opened.filename}>{$t('Download original')}</a
    >{/if}
</dialog>
