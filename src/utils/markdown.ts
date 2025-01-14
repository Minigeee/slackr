import TurndownService from 'turndown';

const turndownService = new TurndownService();

export function markdownToText(markdown: string) {
  return turndownService.turndown(markdown);
}
