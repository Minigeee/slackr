import TurndownService from 'turndown';

const turndownService = new TurndownService();

export function htmlToMarkdown(markdown: string) {
  return turndownService.turndown(markdown);
}
