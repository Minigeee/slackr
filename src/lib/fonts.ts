import { Inter, Noto_Color_Emoji } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const emoji = Noto_Color_Emoji({
  weight: '400',
  display: 'swap',
  subsets: ['emoji'],
  preload: true,
});
