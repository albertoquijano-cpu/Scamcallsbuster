import React from 'react';
import Svg, { Path, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  size?: number;
  active?: boolean;
}

export default function BreastplateIcon({ size = 80, active = true }: Props) {
  const highlight = active ? '#00ff88' : '#777777';
  const shadow = active ? '#007740' : '#333333';

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="armorGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={shadow} />
          <Stop offset="0.4" stopColor={highlight} />
          <Stop offset="0.6" stopColor={highlight} />
          <Stop offset="1" stopColor={shadow} />
        </LinearGradient>
      </Defs>
      <Path d="M18 30 Q14 38 16 52 Q18 68 26 78 Q34 86 50 88 Q66 86 74 78 Q82 68 84 52 Q86 38 82 30 Q66 24 50 24 Q34 24 18 30Z" fill="url(#armorGrad)" stroke={shadow} strokeWidth="1.5" />
      <Path d="M19 38 Q50 33 81 38" fill="none" stroke={shadow} strokeWidth="1.5" />
      <Path d="M17 52 Q50 47 83 52" fill="none" stroke={shadow} strokeWidth="1.5" />
      <Path d="M20 65 Q50 61 80 65" fill="none" stroke={shadow} strokeWidth="1.5" />
      <Path d="M50 24 Q52 40 52 56 Q51 72 50 88" fill="none" stroke={highlight} strokeWidth="2" strokeLinecap="round" />
      <Path d="M50 24 Q48 40 48 56 Q49 72 50 88" fill="none" stroke={shadow} strokeWidth="1" strokeLinecap="round" />
      <Ellipse cx="28" cy="44" rx="2.5" ry="2.5" fill={highlight} />
      <Ellipse cx="72" cy="44" rx="2.5" ry="2.5" fill={highlight} />
      <Ellipse cx="26" cy="58" rx="2.5" ry="2.5" fill={highlight} />
      <Ellipse cx="74" cy="58" rx="2.5" ry="2.5" fill={highlight} />
    </Svg>
  );
}
