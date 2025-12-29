
import React from 'react';
import { Card as CardType, CardBackTheme, Suit, GameSpeed } from '../types';
import { SuitIcon, SUIT_COLORS, getRankLabel } from '../constants';

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  backTheme?: CardBackTheme;
  speed?: GameSpeed;
}

const Card: React.FC<CardProps> = ({ card, isSelected, onClick, className = "", backTheme = 'blue', speed = 1 }) => {
  // Map speed factor to CSS transition duration (ms)
  // Standard (1.0) = 200ms
  // Turbo (2.0) = 100ms
  // Instant (4.0) = 50ms
  // Relaxed (0.5) = 400ms
  const duration = Math.round(200 / speed);

  // Base classes for both front and back
  const baseClasses = `relative w-full aspect-[5/7] rounded-sm md:rounded-lg shadow-md md:shadow-xl flex flex-col cursor-pointer transition-all select-none ${className}`;

  if (!card.isFaceUp) {
    const themeClasses = {
      blue: 'bg-blue-800 border-blue-400/30',
      red: 'bg-red-900 border-red-400/30',
      green: 'bg-emerald-800 border-emerald-400/30',
      black: 'bg-zinc-900 border-zinc-400/30',
      gold: 'bg-amber-700 border-amber-400/30',
    };

    const patternClasses = {
      blue: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.1)_1px,_transparent_1px)]',
      red: 'bg-[repeating-linear-gradient(45deg,_rgba(255,255,255,0.05)_0px,_rgba(255,255,255,0.05)_2px,_transparent_2px,_transparent_4px)]',
      green: 'bg-[radial-gradient(circle,_rgba(255,255,255,0.1)_1px,_transparent_1px)] bg-[length:6px_6px]',
      black: 'bg-[conic-gradient(at_top_right,_rgba(255,255,255,0.05)_0deg,_transparent_90deg)]',
      gold: 'bg-[repeating-conic-gradient(rgba(255,255,255,0.1)_0deg_15deg,_rgba(255,255,255,0.05)_15deg_30deg)]',
    };

    return (
      <div 
        onClick={onClick}
        style={{ transitionDuration: `${duration}ms` }}
        className={`${baseClasses} ${themeClasses[backTheme]} border-[1px] md:border-2 hover:-translate-y-1`}
      >
        <div className={`w-full h-full border-2 md:border-4 border-black/20 rounded-sm md:rounded-lg ${patternClasses[backTheme]} flex items-center justify-center`}>
           <div className="opacity-10 md:opacity-20 transform -rotate-12 scale-110 md:scale-150">
             <SuitIcon suit={Suit.SPADES} className="w-6 h-6 md:w-10 md:h-10 text-white" />
           </div>
        </div>
      </div>
    );
  }

  const colorClass = SUIT_COLORS[card.suit];

  return (
    <div 
      onClick={onClick}
      style={{ transitionDuration: `${duration}ms` }}
      className={`${baseClasses} bg-white border-[1px] border-gray-200 p-0.5 md:p-1.5 
        ${isSelected ? 'ring-2 md:ring-4 ring-yellow-400 scale-105 -translate-y-1 md:-translate-y-2 z-50' : 'hover:-translate-y-1'}`}
    >
      <div className={`flex flex-col items-center leading-none ${colorClass}`}>
        <span className="text-[10px] md:text-sm font-bold">{getRankLabel(card.rank)}</span>
        <SuitIcon suit={card.suit} className="w-2 h-2 md:w-4 md:h-4" />
      </div>

      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${colorClass}`}>
        <SuitIcon suit={card.suit} className="w-4 h-4 md:w-8 md:h-8" />
      </div>

      <div className={`flex flex-col items-center leading-none self-end rotate-180 ${colorClass}`}>
        <span className="text-[10px] md:text-sm font-bold">{getRankLabel(card.rank)}</span>
        <SuitIcon suit={card.suit} className="w-2 h-2 md:w-4 md:h-4" />
      </div>
    </div>
  );
};

export default Card;
