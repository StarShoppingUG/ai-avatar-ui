// Thin pub/sub layer on top of window CustomEvents, shared by every
// avatar-* custom element and by AvatarController. Nothing here depends on
// any component, so it's safe for all of them to import.

// avatar-status can connect/register its listener slightly after the very
// first status events fire (AvatarController.init() starts emitting status
// as soon as <avatar-model> is upgraded, which can race the upgrade/connect
// of <avatar-status> depending on DOM order). window.dispatchEvent doesn't
// queue or replay events for listeners that weren't there yet, so a missed
// early event used to leave the panel stuck on its hardcoded "Initializing"
// text forever. Caching the last status here lets a late listener catch up
// immediately on connect instead of waiting for (and possibly never
// getting) another update.
const lastStatusDetailByInstance = {};

export function emitAvatarEvent(name, detail = {}, instanceId = 'default') {
  const payload = { ...detail, instance: instanceId };
  if (name === 'update-status') {
    lastStatusDetailByInstance[instanceId] = payload;
  }
  window.dispatchEvent(new CustomEvent(`avatar:${name}`, { detail: payload }));
}

export function getLastStatusDetail(instanceId = 'default') {
  return lastStatusDetailByInstance[instanceId] || null;
}