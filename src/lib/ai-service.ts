import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini client using the key from your .env file
const ai = new GoogleGenAI({ 
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || "dummy_key"
});

export async function generateAnalyticsSummary(data: any) {
  try {
    const prompt = `You are a professional data analyst for a Smart Donation Management System. Provide a concise, 2-3 sentence executive summary of the current platform metrics. Here is the current data summary: ${JSON.stringify(data)}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text ?? "Summary generation returned an empty result.";
  } catch (error) {
    console.error("Gemini Summarization failed:", error);
    return "Unable to generate AI summary at this time. Please check your Gemini API key configuration.";
  }
}

export async function generateDemandPredictions(inventoryData: any, campaignData: any) {
  try {
    const prompt = `You are an AI logistics predictor for a Donation System. Based on current inventory levels and active campaigns, predict 2-3 items or categories that will see a spike in demand or are critically low. Format your response STRICTLY as a JSON array of strings, for example: ["Based on the incoming weather patterns, Category 4 Relief Goods will see a 40% spike in demand next week.", "Medical supplies are running critically low for the active Typhoon relief campaign."] Do not output markdown code blocks, just the raw JSON array.
    
    Inventory Data: ${JSON.stringify(inventoryData)}
    Campaign Data: ${JSON.stringify(campaignData)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const content = response.text || "[]";
    // Strip markdown formatting if the AI still included it
    const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanContent) as string[];
  } catch (error) {
    console.error("Gemini Prediction failed:", error);
    return ["Demand prediction services are currently offline. Please verify API configuration."];
  }
}

export async function generateDonorInsights(params: {
  donorName: string;
  totalCash: number;
  totalInKind: number;
  donations: any[];
  inkindDonations: any[];
  activeCampaigns: any[];
}) {
  try {
    const prompt = `You are a warm, encouraging AI assistant for the Save 25 Smart Donation Management System.
    Analyze the following donor's contribution history and active campaigns to provide personalized, motivating insights, a brief summary of their impact, and suggestions for active campaigns they might want to support.
    
    Donor Name: ${params.donorName}
    Total Cash Donated: PHP ${params.totalCash}
    Total In-Kind Items Donated: ${params.totalInKind}
    
    Donation History (Cash): ${JSON.stringify(params.donations)}
    Donation History (In-Kind): ${JSON.stringify(params.inkindDonations)}
    
    Active Campaigns available for donation: ${JSON.stringify(params.activeCampaigns)}
    
    Guidelines:
    1. Address the donor by name in a warm and polite tone (English or light Taglish is fine).
    2. If they have no donations yet, encourage them to start and suggest a couple of exciting active campaigns.
    3. If they have donated, summarize their total impact, thank them sincerely, and recommend 1-2 active campaigns that align with their past donations or are currently in high need.
    4. Keep it concise (3-4 sentences max). Avoid markdown formatting like headers or bold symbols, just plain text paragraphs.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text ?? "Unable to analyze metrics at this time.";
  } catch (error) {
    console.error("Gemini Donor Summarization failed:", error);
    return "Unable to generate personalized AI insights at this time. Please verify API configuration.";
  }
}
