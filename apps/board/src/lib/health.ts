import { HEALTH_THRESHOLDS } from '@pulse/shared-types';

export type HealthColor = 'green' | 'amber' | 'red';

export function healthColor(score: number): HealthColor {
  if (score > HEALTH_THRESHOLDS.green) return 'green';
  if (score >= HEALTH_THRESHOLDS.amber) return 'amber';
  return 'red';
}

export const healthClasses: Record<HealthColor, string> = {
  green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  amber: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  red: 'bg-red-500/20 text-red-300 border-red-500/40',
};
