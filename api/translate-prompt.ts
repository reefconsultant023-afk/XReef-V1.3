import Replicate from "replicate";
import ascii85 from "ascii85";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, image } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const replicateApiToken = process.env.VITE_REPLICATE_API_TOKEN;
    if (!replicateApiToken) {
      return res.status(500).json({ error: "VITE_REPLICATE_API_TOKEN is not set" });
    }

    const replicate = new Replicate({
      auth: replicateApiToken,
    });

    let finalPrompt = `Translate the following prompt to English. If it is already in English, return it as is. \n\nReturn ONLY the translated prompt in English, without any conversational text, quotes, or explanations:\n\nOriginal prompt: ${prompt}`;

    if (image) {
      try {
        const base64Data = image.split(',')[1] || image;
        const buf = Buffer.from(base64Data, 'base64');
        if (ascii85 && typeof ascii85.encode === 'function') {
          const b85 = ascii85.encode(buf).toString();
          finalPrompt += `\n\n[Attached Image Data in Base85 encoding: ${b85}]`;
        }
      } catch (e) {
        console.error("Failed to encode image to Base85:", e);
      }
    }

    const input = {
      prompt: finalPrompt,
      system_instruction: "You are an expert translator. Your task is to translate any non-English prompts to English accurately. Do not add any extra details or enhance the prompt. Simply provide the English translation. Always output the result in English.",
      thinking_level: "medium",
      temperature: 1,
      max_output_tokens: 1000
    };

    const output: any = await replicate.run("google/gemini-3.1-pro", { input });
    
    let enhancedPrompt = "";
    if (Array.isArray(output)) {
      enhancedPrompt = output.join("").trim();
    } else if (typeof output === 'string') {
      enhancedPrompt = output.trim();
    }

    res.status(200).json({ enhancedPrompt });
  } catch (error: any) {
    console.error("Error translating prompt:", error);
    let errorMessage = error.message || "Failed to translate prompt";
    if (errorMessage.includes("402") || errorMessage.toLowerCase().includes("insufficient credit")) {
      errorMessage = "رصيدك في Replicate غير كافٍ. يرجى شحن حسابك للمتابعة.";
    }
    res.status(error.status || 500).json({ error: errorMessage });
  }
}
