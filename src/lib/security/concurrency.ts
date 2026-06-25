let activeJobs = 0;

export function tryAcquireSlot(max: number) {
  if (activeJobs >= max) return false;
  activeJobs += 1;
  return true;
}

export function releaseSlot() {
  activeJobs = Math.max(0, activeJobs - 1);
}

export function getActiveJobs() {
  return activeJobs;
}

export function resetConcurrency() {
  activeJobs = 0;
}
