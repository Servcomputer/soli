
import { GoogleGenAI } from "@google/genai";
import { GameState } from "../types";

export const getAIHint = async (state: GameState): Promise<string> => {
  // Acesso seguro à chave de API para evitar "process is not defined"
  const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : (window as any).API_KEY;
  
  if (!apiKey) {
    throw new Error("MODEL_NOT_FOUND"); // Força o usuário a selecionar uma chave via UI
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const tableauDesc = state.tableau.map((pile, i) => {
    const faceUp = pile.filter(c => c.isFaceUp).map(c => `${c.rank} of ${c.suit}`).join(', ');
    return `Pile ${i + 1}: [${faceUp || 'empty'}]`;
  }).join('; ');

  const foundationDesc = Object.entries(state.foundation)
    .map(([suit, pile]) => `${suit}: ${pile.length > 0 ? pile[pile.length - 1].rank : 'None'}`)
    .join(', ');

  const wasteDesc = state.waste.length > 0 ? `Waste: ${state.waste[state.waste.length - 1].rank} of ${state.waste[state.waste.length - 1].suit}` : 'Waste: Empty';

  const prompt = `
    You are a professional Solitaire (Klondike) assistant. 
    Analyze this current game state and suggest the single best next move.
    Current Foundations: ${foundationDesc}
    Current Waste: ${wasteDesc}
    Tableau: ${tableauDesc}
    
    Rules reminder: Tableau builds down by alternating color. Foundations build up by suit starting with Ace. Kings go to empty tableau spots.
    Keep the advice very brief (max 15 words).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.5,
      }
    });

    return response.text || "Draw a card from the stock.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    // Erros 404 ou 403 geralmente indicam problema com a chave/modelo
    if (error?.message?.includes("NOT_FOUND") || error?.status === 404 || error?.status === 403) {
      throw new Error("MODEL_NOT_FOUND");
    }
    return "The AI is currently unavailable. Try again later.";
  }
};
