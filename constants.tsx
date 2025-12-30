
import React from 'react';
import { Suit } from './types';

export const SUIT_COLORS_NEON = {
  [Suit.HEARTS]: 'text-[#ff007f]',
  [Suit.DIAMONDS]: 'text-[#ff007f]',
  [Suit.CLUBS]: 'text-[#00f2ff]',
  [Suit.SPADES]: 'text-[#00f2ff]',
};

export const SUIT_COLORS_CLASSIC = {
  [Suit.HEARTS]: 'text-[#d32f2f]',
  [Suit.DIAMONDS]: 'text-[#d32f2f]',
  [Suit.CLUBS]: 'text-[#000000]',
  [Suit.SPADES]: 'text-[#000000]',
};

export const SuitIcon: React.FC<{ suit: Suit; className?: string }> = ({ suit, className = "w-6 h-6" }) => {
  switch (suit) {
    case Suit.HEARTS:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case Suit.DIAMONDS:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 2L4.5 12 12 22l7.5-10L12 2z" />
        </svg>
      );
    case Suit.CLUBS:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 2c1.1 0 2 .9 2 2 0 .73-.4 1.36-1 1.72V7c3.03 0 5.5 2.47 5.5 5.5 0 1.91-1 3.6-2.52 4.57.52.27.87.82.87 1.43 0 1.1-.9 2-2 2H9.15c-1.1 0-2-.9-2-2 0-.61.35-1.16.87-1.43C6.5 16.1 5.5 14.41 5.5 12.5 5.5 9.47 7.97 7 11 7V5.72c-.6-.36-1-.99-1-1.72 0-1.1.9-2 2-2z" />
        </svg>
      );
    case Suit.SPADES:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 2C9 2 4 9 4 13c0 2.21 1.79 4 4 4 .83 0 1.58-.25 2.21-.68.1.53.37 1.01.79 1.34V22h2v-4.34c.42-.33.69-.81.79-1.34.63.43 1.38.68 2.21.68 2.21 0 4-1.79 4-4 0-4-5-11-8-11z" />
        </svg>
      );
  }
};

export const getRankLabel = (rank: number): string => {
  switch (rank) {
    case 1: return 'A';
    case 11: return 'J';
    case 12: return 'Q';
    case 13: return 'K';
    default: return rank.toString();
  }
};
