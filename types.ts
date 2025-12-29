
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

export type CardBackTheme = 'blue' | 'red' | 'green' | 'black' | 'gold';
export type GameSpeed = 0.5 | 1 | 2 | 4;

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

export interface GameStats {
  totalGames: number;
  totalWins: number;
  bestMoves: number | null;
  fastestTime: number | null;
  longestTime: number | null;
}

export type Selection = {
  source: 'tableau' | 'waste' | 'foundation' | 'stock';
  pileIndex?: number;
  cardIndex?: number;
  suit?: Suit;
} | null;

export interface DragState {
  source: Selection;
  cards: Card[];
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  offset: { x: number; y: number };
}
