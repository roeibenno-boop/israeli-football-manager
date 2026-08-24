import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Polygon, Rect } from 'react-native-svg';

import { clubCrestImages } from '@/components/club-crest-images';
import { baseColors } from '@/theme';

// Simple heraldic shield silhouette, normalized to a 100x120 box.
const SHIELD_PATH = 'M50 0 L100 15 L100 62 Q100 100 50 120 Q0 100 0 62 L0 15 Z';

const SIZES = {
  sm: { width: 32, fontSize: 11 },
  md: { width: 56, fontSize: 18 },
  lg: { width: 96, fontSize: 30 },
} as const;

export type ClubCrestSize = keyof typeof SIZES;

type ClubCrestProps = {
  primaryColour?: string | null;
  secondaryColour?: string | null;
  /** Shown in the generated crest. Falls back to the first letters of `fallbackName` if unset. */
  initials?: string | null;
  /** Real crest image, when available — takes priority over the generated SVG. */
  logoUrl?: string | null;
  /** Used to derive initials if `initials` isn't set. */
  fallbackName?: string;
  size?: ClubCrestSize;
};

function deriveInitials(initials: string | null | undefined, fallbackName: string | undefined): string {
  if (initials) return initials.slice(0, 3).toUpperCase();
  if (fallbackName) return fallbackName.slice(0, 3).toUpperCase();
  return '?';
}

/**
 * Generates a shield crest from a club's two colours + initials (diagonal
 * split fill). Renders `logoUrl` instead when one is set.
 */
export function ClubCrest({
  primaryColour,
  secondaryColour,
  initials,
  logoUrl,
  fallbackName,
  size = 'md',
}: ClubCrestProps) {
  const { width, fontSize } = SIZES[size];
  const height = Math.round(width * 1.2);

  // Priority: an explicit logo_url (e.g. a properly licensed hosted asset,
  // once one exists) beats the bundled local crest, which beats the
  // generated shield.
  const bundledCrest = fallbackName ? clubCrestImages[fallbackName.toUpperCase()] : undefined;
  const imageSource = logoUrl ? { uri: logoUrl } : bundledCrest;

  if (imageSource) {
    return (
      <Image
        source={imageSource}
        style={{ width, height, borderRadius: 4 }}
        resizeMode="contain"
        accessibilityLabel={fallbackName ? `${fallbackName} crest` : 'Club crest'}
      />
    );
  }

  const primary = primaryColour || baseColors.accentFallback;
  const secondary = secondaryColour || baseColors.surfaceElevated;
  const label = deriveInitials(initials, fallbackName);
  const clipId = `shield-clip-${width}`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox="0 0 100 120">
        <Defs>
          <ClipPath id={clipId}>
            <Path d={SHIELD_PATH} />
          </ClipPath>
        </Defs>
        <Rect x={0} y={0} width={100} height={120} fill={secondary} clipPath={`url(#${clipId})`} />
        <Polygon points="0,0 100,0 0,120" fill={primary} clipPath={`url(#${clipId})`} />
        <Path d={SHIELD_PATH} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
      </Svg>
      <View style={styles.labelOverlay} pointerEvents="none">
        <Text style={[styles.label, { fontSize }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '8%',
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
