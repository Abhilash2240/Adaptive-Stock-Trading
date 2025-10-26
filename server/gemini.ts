// Reference: javascript_gemini blueprint
import { GoogleGenAI } from "@google/genai";

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface SentimentResult {
  score: number;  // -1 to 1, where -1 is very negative, 1 is very positive
  confidence: number;  // 0 to 1
  summary: string;
}

export async function analyzeSentiment(text: string, ticker: string): Promise<SentimentResult> {
  try {
    const systemPrompt = `You are a financial sentiment analysis expert. 
Analyze the sentiment of the given text related to stock ticker ${ticker}.
Provide a sentiment score from -1 (very negative) to 1 (very positive),
a confidence score between 0 and 1, and a brief summary.
Respond with JSON in this format: 
{'score': number, 'confidence': number, 'summary': string}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            score: { type: "number" },
            confidence: { type: "number" },
            summary: { type: "string" },
          },
          required: ["score", "confidence", "summary"],
        },
      },
      contents: text,
    });

    const rawJson = response.text;

    if (rawJson) {
      const data: SentimentResult = JSON.parse(rawJson);
      return data;
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error(`Failed to analyze sentiment for ${ticker}:`, error);
    // Return neutral sentiment on error
    return {
      score: 0,
      confidence: 0,
      summary: "Sentiment analysis failed",
    };
  }
}

export async function batchAnalyzeSentiment(
  texts: Array<{ ticker: string; text: string }>
): Promise<Map<string, SentimentResult>> {
  const results = new Map<string, SentimentResult>();
  
  // Process in batches to respect rate limits
  for (const { ticker, text } of texts) {
    const result = await analyzeSentiment(text, ticker);
    results.set(ticker, result);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}
