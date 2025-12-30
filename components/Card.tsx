
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

  // --- NEON STYLES ---
  const themeClassesNeon = {
    blue: 'border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.3)] bg-[#000d1a]',
    red: 'border-[#ff007f] shadow-[0_0_15px_rgba(255,0,127,0.3)] bg-[#1a000d]',
    green: 'border-[#39ff14] shadow-[0_0_15px_rgba(57,255,20,0.3)] bg-[#051a00]',
    black: 'border-[#7f00ff] shadow-[0_0_15px_rgba(127,0,255,0.3)] bg-[#0a001a]',
    gold: 'border-[#ffcc00] shadow-[0_0_15px_rgba(255,204,0,0.3)] bg-[#1a1400]',
  };

  // --- CLASSIC STYLES ---
  const themeClassesClassic = {
    blue: 'bg-blue-800',
    red: 'bg-red-800',
    green: 'bg-emerald-900',
    black: 'bg-zinc-900',
    gold: 'bg-amber-700',
  };

  const baseClasses = `relative w-full aspect-[5/7] rounded-lg md:rounded-2xl border-[1px] md:border-2 flex flex-col cursor-grab active:cursor-grabbing transition-all select-none touch-none overflow-hidden ${className}`;

  if (!card.isFaceUp) {
    if (isNeon) {
      return (
        <div 
          onClick={onClick}
          onPointerDown={onPointerDown}
          style={{ transitionDuration: isDragging ? '0ms' : `${duration}ms` }}
          className={`${baseClasses} ${themeClassesNeon[backTheme]} ${!isDragging && 'hover:scale-105 hover:-translate-y-1 hover:brightness-125'}`}
        >
          <div className="absolute inset-2 border border-white/10 rounded-lg md:rounded-xl pointer-events-none flex items-center justify-center">
            <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="relative">
                 <div className={`absolute inset-0 blur-xl opacity-40 animate-pulse ${backTheme === 'blue' ? 'bg-[#00f2ff]' : backTheme === 'red' ? 'bg-[#ff007f]' : 'bg-white'}`}></div>
                 <SuitIcon suit={Suit.SPADES} className="w-12 h-12 md:w-20 md:h-20 text-white/40 relative z-10" />
               </div>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20 pointer-events-none"></div>
        </div>
      );
    } else {
      return (
        <div 
          onClick={onClick}
          onPointerDown={onPointerDown}
          style={{ transitionDuration: isDragging ? '0ms' : `${duration}ms` }}
          className={`${baseClasses} ${themeClassesClassic[backTheme]} border-4 border-white shadow-lg`}
        >
          <div className="w-full h-full border-2 border-white/20 rounded-md flex items-center justify-center">
             <div className="w-12 h-12 rounded-full border-4 border-white/20 flex items-center justify-center">
               <div className="w-6 h-6 rounded-full bg-white/10"></div>
             </div>
          </div>
        </div>
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
          boxShadow: isSelected ? `0 0 30px ${neonColor}88, inset 0 0 10px ${neonColor}44` : `0 4px 10px rgba(0,0,0,0.5)`,
        }}
        className={`${baseClasses} bg-[#050508] ${isRed ? 'border-[#ff007f]' : 'border-[#00f2ff]'} p-1.5 md:p-3 
          ${isSelected ? `scale-110 -translate-y-3 z-50 ring-2 ${isRed ? 'ring-[#ff007f]/50' : 'ring-[#00f2ff]/50'}` : !isDragging ? 'hover:-translate-y-1 hover:brightness-110' : ''}`}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="circuit" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M0 20 L10 20 L15 15 L25 15 L30 20 L40 20" stroke="white" fill="none" strokeWidth="0.5"/><circle cx="15" cy="15" r="1" fill="white"/><circle cx="25" cy="15" r="1" fill="white"/></pattern></defs><rect width="100%" height="100%" fill="url(#circuit)" /></svg>
        </div>
        <div className={`flex flex-col items-center leading-none ${colorClass} z-10`}>
          <span className={`text-sm md:text-xl font-black font-neon tracking-tighter ${isRed ? 'neon-text-pink' : 'neon-text-cyan'}`}>{getRankLabel(card.rank)}</span>
          <SuitIcon suit={card.suit} className="w-3 h-3 md:w-6 md:h-6 mt-1" />
        </div>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${colorClass} z-0 flex items-center justify-center`}>
          <div className={`absolute inset-0 blur-2xl opacity-10 animate-pulse ${isRed ? 'bg-[#ff007f]' : 'bg-[#00f2ff]'}`}></div>
          <SuitIcon suit={card.suit} className="w-12 h-12 md:w-24 md:h-24 opacity-30 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
        </div>
        <div className={`flex flex-col items-center leading-none self-end rotate-180 ${colorClass} z-10`}>
          <span className={`text-sm md:text-xl font-black font-neon tracking-tighter ${isRed ? 'neon-text-pink' : 'neon-text-cyan'}`}>{getRankLabel(card.rank)}</span>
          <SuitIcon suit={card.suit} className="w-3 h-3 md:w-6 md:h-6 mt-1" />
        </div>
        <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/10 to-transparent skew-y-[-15deg] -translate-y-1/2 pointer-events-none"></div>
      </div>
    );
  } else {
    // --- CLASSIC MODE ---
    const colorClass = SUIT_COLORS_CLASSIC[card.suit];
    return (
      <div 
        onClick={onClick}
        onPointerDown={onPointerDown}
        style={{ 
          transitionDuration: isDragging ? '0ms' : `${duration}ms`,
          zIndex: isDragging ? 1000 : 'auto',
          boxShadow: isSelected ? '0 0 15px rgba(0,0,0,0.4)' : '0 2px 5px rgba(0,0,0,0.2)'
        }}
        className={`${baseClasses} bg-white border-zinc-300 p-1 md:p-2 
          ${isSelected ? 'scale-105 -translate-y-1 ring-2 ring-blue-500' : ''}`}
      >
        <div className={`flex flex-col items-center leading-none ${colorClass}`}>
          <span className="text-sm md:text-xl font-bold">{getRankLabel(card.rank)}</span>
          <SuitIcon suit={card.suit} className="w-3 h-3 md:w-6 md:h-6" />
        </div>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${colorClass} opacity-10`}>
          <SuitIcon suit={card.suit} className="w-12 h-12 md:w-24 md:h-24" />
        </div>
        <div className={`flex flex-col items-center leading-none self-end rotate-180 ${colorClass}`}>
          <span className="text-sm md:text-xl font-bold">{getRankLabel(card.rank)}</span>
          <SuitIcon suit={card.suit} className="w-3 h-3 md:w-6 md:h-6" />
        </div>
      </div>
    );
  }
};

export default Card;
