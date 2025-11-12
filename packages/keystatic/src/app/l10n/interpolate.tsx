import { ReactNode } from 'react';

export function interpolateMessage(
  message: string,
  values: Record<string, ReactNode>
): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\{(\w+)\}/g;
  let match;

  while ((match = regex.exec(message)) !== null) {
    if (match.index > lastIndex) {
      parts.push(message.slice(lastIndex, match.index));
    }

    const key = match[1];
    if (key in values) {
      parts.push(values[key]);
    } else {
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < message.length) {
    parts.push(message.slice(lastIndex));
  }

  return parts;
}
