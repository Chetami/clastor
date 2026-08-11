import { Image, ImageStyle, ViewStyle } from 'react-native';

export function Logo({ style, size = 40 }: { style?: ViewStyle; size?: number }) {
  return (
    <Image
      source={require('../assets/logo.svg')}
      style={{ width: size, height: size, ...(style as ImageStyle) }}
      resizeMode="contain"
    />
  );
}