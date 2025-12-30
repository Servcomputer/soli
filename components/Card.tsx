
import React from 'react';
import { Card as CardType, CardBackTheme, Suit, GameSpeed } from '../types';
import { SuitIcon, SUIT_COLORS_NEON, SUIT_COLORS_CLASSIC, getRankLabel } from '../constants';

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  isDragging?: boolean;
  isNeon?: boolean;
  onClick?: (e: React.MouseEvent | React.PointerEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  className?: string;
  backTheme?: CardBackTheme;
  speed?: GameSpeed;
}

const Card: React.FC<CardProps> = ({ 
  card, 
  isSelected, 
  isDragging,
  isNeon = true,
  onClick, 
  onPointerDown,
  className = "", 
  backTheme = 'blue', 
  speed = 1 
}) => {
  const duration = Math.round(200 / speed);

  const themeClassesNeon = {
    blue: 'border-[#00f2ff] shadow-[0_0_10px_rgba(0,242,255,0.2)] bg-[#000d1a]',
    red: 'border-[#ff007f] shadow-[0_0_10px_rgba(255,0,127,0.2)] bg-[#1a000d]',
    green: 'border-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.2)] bg-[#051a00]',
    black: 'border-[#7f00ff] shadow-[0_0_10px_rgba(127,0,255,0.2)] bg-[#0a001a]',
    gold: 'border-[#ffcc00] shadow-[0_0_10px_rgba(255,204,0,0.2)] bg-[#1a1400]',
  };

  const themeClassesClassic = {
    blue: 'bg-blue-800',
    red: 'bg-red-800',
    green: 'bg-emerald-900',
    black: 'bg-zinc-900',
    gold: 'bg-amber-700',
  };

  const baseClasses = `relative w-full aspect-[5/7] rounded-md md:rounded-2xl border-[1px] md:border-2 flex flex-col cursor-grab active:cursor-grabbing transition-all select-none touch-none overflow-hidden ${className}`;

  if (!card.isFaceUp) {
    if (isNeon) {
      return (
        <div 
          onClick={onClick}
          onPointerDown={onPointerDown}
          style={{ transitionDuration: isDragging ? '0ms' : `${duration}ms` }}
          className={`${baseClasses} ${themeClassesNeon[backTheme]} ${!isDragging && 'hover:brightness-125'}`}
        >
          <div className="absolute inset-1 border border-white/5 rounded-md pointer-events-none flex items-center justify-center">
            <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
            <div className="absolute inset-0 flex items-center justify-center">
               <SuitIcon suit={Suit.SPADES} className="w-4 h-4 md:w-16 md:h-16 text-white/10" />
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div 
          onClick={onClick}
          onPointerDown={onPointerDown}
          style={{ transitionDuration: isDragging ? '0ms' : `${duration}ms` }}
          className={`${baseClasses} ${themeClassesClassic[backTheme]} border-white shadow-sm`}
        />
      );
    }
  }

  const isRed = card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS;
  
  if (isNeon) {
    const neonColor = isRed ? '#ff007f' : '#00f2ff';
    const colorClass = SUIT_COLORS_NEON[card.suit];

    return (
      <div 
        onClick={onClick}
        onPointerDown={onPointerDown}
        style={{ 
          transitionDuration: isDragging ? '0ms' : `${duration}ms`,
          opacity: isDragging ? 0.85 : 1,
          zIndex: isDragging ? 1000 : 'auto',
          boxShadow: isSelected ? `0 0 20px ${neonColor}88` : `0 2px 5px rgba(0,0,0,0.5)`,
        }}
        className={`${baseClasses} bg-[#050508] ${isRed ? 'border-[#ff007f]' : 'border-[#00f2ff]'} p-0.5 md:p-2 
          ${isSelected ? `scale-105 z-50` : ''}`}
      >
        <div className={`flex flex-col items-center leading-none ${colorClass} z-10`}>
          <span className={`text-[10px] md:text-lg font-black font-neon tracking-tighter ${isRed ? 'neon-text-pink' : 'neon-text-cyan'}`}>{getRankLabel(card.rank)}</span>
          <SuitIcon suit={card.suit} className="w-2 h-2 md:w-5 md:h-5" />
        </div>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${colorClass} z-0 flex items-center justify-center`}>
          <SuitIcon suit={card.suit} className="w-6 h-6 md:w-16 md:h-16 opacity-20" />
        </div>
        <div className={`flex flex-col items-center leading-none self-end rotate-180 ${colorClass} z-10`}>
          <span className={`text-[10px] md:text-lg font-black font-neon tracking-tighter ${isRed ? 'neon-text-pink' : 'neon-text-cyan'}`}>{getRankLabel(card.rank)}</span>
          <SuitIcon suit={card.suit} className="w-2 h-2 md:w-5 md:h-5" />
        </div>
      </div>
    );
  } else {
    const colorClass = SUIT_COLORS_CLASSIC[card.suit];
    return (
      <div 
        onClick={onClick}
        onPointerDown={onPointerDown}
        style={{ 
          transitionDuration: isDragging ? '0ms' : `${duration}ms`,
          zIndex: isDragging ? 1000 : 'auto'
        }}
        className={`${baseClasses} bg-white border-zinc-200 p-0.5 md:p-1.5 
          ${isSelected ? 'scale-105 ring-2 ring-blue-500' : ''}`}
      >
        <div className={`flex flex-col items-center leading-none ${colorClass}`}>
          <span className="text-[10px] md:text-lg font-bold">{getRankLabel(card.rank)}</span>
          <SuitIcon suit={card.suit} className="w-2 h-2 md:w-5 md:h-5" />
        </div>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${colorClass} opacity-5`}>
          <SuitIcon suit={card.suit} className="w-6 h-6 md:w-16 md:h-16" />
        </div>
        <div className={`flex flex-col items-center leading-none self-end rotate-180 ${colorClass}`}>
          <span className="text-[10px] md:text-lg font-bold">{getRankLabel(card.rank)}</span>
          <SuitIcon suit={card.suit} className="w-2 h-2 md:w-5 md:h-5" />
        </div>
      </div>
    );
  }
};

export default Card;
