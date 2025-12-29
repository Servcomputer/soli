
export enum Suit {
  HEARTS = 'HEARTS',
  DIAMONDS = 'DIAMONDS',
  CLUBS = 'CLUBS',
  SPADES = 'SPADES'
}

export enum Rank {
  ACE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13
}

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  isFaceUp: boolean;
}

export interface GameState {
  stock: Card[];
  waste: Card[];
  foundation: {
    [Suit.HEARTS]: Card[];
    [Suit.DIAMONDS]: Card[];
    [Suit.CLUBS]: Card[];
    [Suit.SPADES]: Card[];
  };
  tableau: Card[][];
  movesCount: number;
  startTime: number | null;
  isGameOver: boolean;
}

export type Selection = {
  source: 'tableau' | 'waste' | 'foundation' | 'stock';
  pileIndex?: number;
  cardIndex?: number;
  suit?: Suit;
} | null;
