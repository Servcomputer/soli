
import { Suit, Rank, Card, GameState } from '../types';

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  const suits = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
  const ranks = Array.from({ length: 13 }, (_, i) => i + 1);

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank: rank as Rank,
        isFaceUp: false
      });
    }
  }
  return deck;
};

export const shuffle = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const initGame = (): GameState => {
  let deck = shuffle(createDeck());
  const tableau: Card[][] = [[], [], [], [], [], [], []];

  for (let i = 0; i < 7; i++) {
    for (let j = i; j < 7; j++) {
      const card = deck.pop()!;
      if (i === j) card.isFaceUp = true;
      tableau[j].push(card);
    }
  }

  return {
    stock: deck,
    waste: [],
    foundation: {
      [Suit.HEARTS]: [],
      [Suit.DIAMONDS]: [],
      [Suit.CLUBS]: [],
      [Suit.SPADES]: []
    },
    tableau,
    movesCount: 0,
    startTime: Date.now(),
    isGameOver: false
  };
};

export const isOppositeColor = (suit1: Suit, suit2: Suit): boolean => {
  const redSuits = [Suit.HEARTS, Suit.DIAMONDS];
  const isRed1 = redSuits.includes(suit1);
  const isRed2 = redSuits.includes(suit2);
  return isRed1 !== isRed2;
};

export const canMoveToTableau = (card: Card, targetPile: Card[]): boolean => {
  if (targetPile.length === 0) {
    return card.rank === Rank.KING;
  }
  const topCard = targetPile[targetPile.length - 1];
  return (
    topCard.isFaceUp &&
    isOppositeColor(card.suit, topCard.suit) &&
    card.rank === topCard.rank - 1
  );
};

export const canMoveToFoundation = (card: Card, foundationPile: Card[]): boolean => {
  if (foundationPile.length === 0) {
    return card.rank === Rank.ACE;
  }
  const topCard = foundationPile[foundationPile.length - 1];
  return (
    card.suit === topCard.suit &&
    card.rank === topCard.rank + 1
  );
};
