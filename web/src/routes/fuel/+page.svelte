<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<section class="empty">
  <h2>Your fuel history</h2>
  <p>Add your first vehicle in Settings to start recording fuel stops.</p>
  <a class="button" href={resolve('/settings')}>Add a vehicle</a>
</section>
