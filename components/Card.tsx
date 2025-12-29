
import React from 'react';
import { Card as CardType } from '../types';
import { SuitIcon, SUIT_COLORS, getRankLabel } from '../constants';

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

const Card: React.FC<CardProps> = ({ card, isSelected, onClick, className = "" }) => {
  if (!card.isFaceUp) {
    return (
      <div 
        onClick={onClick}
        className={`w-16 h-24 md:w-20 md:h-28 bg-blue-800 border-2 border-white/20 rounded-lg shadow-lg flex items-center justify-center cursor-pointer transform transition-transform hover:-translate-y-1 ${className}`}
      >
        <div className="w-full h-full border-4 border-blue-900 rounded-lg bg-[radial-gradient(circle,_rgba(255,255,255,0.1)_1px,_transparent_1px)] bg-[length:4px_4px]"></div>
      </div>
    );
  }

  const colorClass = SUIT_COLORS[card.suit];

  return (
    <div 
      onClick={onClick}
      className={`relative w-16 h-24 md:w-20 md:h-28 bg-white rounded-lg shadow-xl flex flex-col justify-between p-1.5 cursor-pointer transform transition-all duration-200 
        ${isSelected ? 'ring-4 ring-yellow-400 scale-105 -translate-y-2 z-50' : 'hover:-translate-y-1'} ${className}`}
    >
      <div className={`flex flex-col items-center leading-none ${colorClass}`}>
        <span className="text-xs md:text-sm font-bold">{getRankLabel(card.rank)}</span>
        <SuitIcon suit={card.suit} className="w-3 h-3 md:w-4 md:h-4" />
      </div>

      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${colorClass}`}>
        <SuitIcon suit={card.suit} className="w-6 h-6 md:w-8 md:h-8" />
      </div>

      <div className={`flex flex-col items-center leading-none self-end rotate-180 ${colorClass}`}>
        <span className="text-xs md:text-sm font-bold">{getRankLabel(card.rank)}</span>
        <SuitIcon suit={card.suit} className="w-3 h-3 md:w-4 md:h-4" />
      </div>
    </div>
  );
};

export default Card;
