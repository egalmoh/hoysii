import { Platform, useWindowDimensions } from 'react-native';

export function useWebLayout() {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 768;
  const gutter = width >= 1200 ? 64 : 32;
  const contentWidth = Math.min(1720, Math.max(0, width - gutter * 2));
  const gap = 20;
  const columns = Math.max(3, Math.min(7, Math.floor((contentWidth + gap) / 220)));
  return { wide, width, gutter, gap, contentWidth, cardWidth: Math.floor((contentWidth - gap * (columns - 1)) / columns) };
}
