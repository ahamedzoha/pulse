import { HEALTH_THRESHOLDS } from '@pulse/shared-types';

export type HealthColor = 'green' | 'amber' | 'red';

export function healthColor(score: number): HealthColor {
  if (score > HEALTH_THRESHOLDS.green) return 'green';
  if (score >= HEALTH_THRESHOLDS.amber) return 'amber';
  return 'red';
}

export const healthBarClasses: Record<HealthColor, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};
