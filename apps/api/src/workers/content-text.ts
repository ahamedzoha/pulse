import type { ActivityFeedItem } from '@pulse/shared-types';

/** Human-readable sentence per event — embedded and stored for RAG retrieval. */
export function buildContentText(item: ActivityFeedItem): string {
  const who = item.actorName;
  const title = `"${item.taskTitle}"`;
  const mood = ` (mood: ${item.mood})`;
  const felt = item.emotions?.length ? ` [felt: ${item.emotions.join(', ')}]` : '';

  switch (item.eventType) {
    case 'created':
      return `${who} created task ${title}${mood}`;
    case 'status_changed':
      return `${who} moved ${title} from ${item.oldValue} to ${item.newValue}${mood}`;
    case 'commented':
      return `${who} commented on ${title}: ${item.commentText ?? ''}${mood}${felt}`;
    case 'reassigned':
      return `${who} reassigned ${title}${mood}`;
    default:
      return `${who} updated ${title}${mood}`;
  }
}
