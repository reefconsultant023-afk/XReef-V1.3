import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Replicate from "replicate";
import ascii85 from "ascii85";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, image, images, aspectRatio, resolution, negativePrompt } = req.body;
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

      let finalPrompt = prompt;
      if (negativePrompt && negativePrompt.trim() !== "") {
        finalPrompt += `\nNegative prompt: ${negativePrompt}`;
      }

      const input: any = { 
        prompt: finalPrompt,
        safety_filter_level: "block_only_high",
        allow_fallback_model: true
      };

      const inputImages = images && Array.isArray(images) && images.length > 0 ? images : (image ? [image] : null);

      if (aspectRatio) {
        input.aspect_ratio = aspectRatio;
      }
      if (resolution) {
        input.resolution = resolution === "8K" ? "4K" : resolution;
      }
      if (inputImages && inputImages.length > 0) {
        input.image = inputImages[0];
        input.image_input = inputImages;
      }

      // Run in parallel to maximize speed
      const promises = Array.from({ length: 1 }).map(() => 
        replicate.run("google/nano-banana-pro", { input })
      );

      const settledResults = await Promise.allSettled(promises);
      
      const results = settledResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      if (results.length === 0 && settledResults.length > 0) {
        // If all failed, throw the first error
        throw (settledResults[0] as PromiseRejectedResult).reason;
      }

      const outputs = results.map((output: any) => {
        let imageUrl = output;
        if (output && typeof output.url === 'function') {
          imageUrl = output.url().toString();
        } else if (Array.isArray(output) && output.length > 0) {
          if (typeof output[0].url === 'function') {
            imageUrl = output[0].url().toString();
          } else {
            imageUrl = output[0];
          }
        }
        return imageUrl;
      });

      res.json({ outputs });
    } catch (error: any) {
      console.error("Error generating image:", error);
      
      let errorMessage = error.message || "Failed to generate image";
      
      // Handle Replicate 402 Payment Required
      if (errorMessage.includes("402") || errorMessage.toLowerCase().includes("insufficient credit")) {
        errorMessage = "رصيدك في Replicate غير كافٍ. يرجى شحن حسابك للمتابعة.";
      }
      
      res.status(error.status || 500).json({ error: errorMessage });
    }
  });

  app.post("/api/upscale", async (req, res) => {
    try {
      const { image, scale = 4, faceEnhance = false } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Image is required for upscaling" });
      }

      const replicateApiToken = process.env.VITE_REPLICATE_API_TOKEN;
      if (!replicateApiToken) {
        return res.status(500).json({ error: "VITE_REPLICATE_API_TOKEN is not set" });
      }

      const replicate = new Replicate({
        auth: replicateApiToken,
      });

      const input = {
        image,
        scale: Number(scale),
        face_enhance: Boolean(faceEnhance)
      };

      const output: any = await replicate.run("nightmareai/real-esrgan", { input });
      
      let imageUrl = output;
      if (output && typeof output.url === 'function') {
        imageUrl = output.url().toString();
      } else if (Array.isArray(output) && output.length > 0) {
        if (typeof output[0].url === 'function') {
          imageUrl = output[0].url().toString();
        } else {
          imageUrl = output[0];
        }
      }

      res.json({ output: imageUrl });
    } catch (error: any) {
      console.error("Error upscaling image:", error);
      let errorMessage = error.message || "Failed to upscale image";
      if (errorMessage.includes("402") || errorMessage.toLowerCase().includes("insufficient credit")) {
        errorMessage = "رصيدك في Replicate غير كافٍ. يرجى شحن حسابك للمتابعة.";
      }
      res.status(error.status || 500).json({ error: errorMessage });
    }
  });

  app.post("/api/translate-prompt", async (req, res) => {
    console.log("Received translate-prompt request");
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
          console.log("Encoding image to Base85...");
          const base64Data = image.split(',')[1] || image;
          const buf = Buffer.from(base64Data, 'base64');
          // Use ascii85 if available, otherwise fallback to a simple string or log error
          if (ascii85 && typeof ascii85.encode === 'function') {
            const b85 = ascii85.encode(buf).toString();
            finalPrompt += `\n\n[Attached Image Data in Base85 encoding: ${b85}]`;
            console.log("Image encoded successfully");
          } else {
            console.warn("ascii85.encode is not a function, skipping image encoding");
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

      console.log("Calling Replicate with Gemini 3.1 Pro (thinking_level: high)...");
      const output: any = await replicate.run("google/gemini-3.1-pro", { input });
      console.log("Replicate response received");
      
      let enhancedPrompt = "";
      if (Array.isArray(output)) {
        enhancedPrompt = output.join("").trim();
      } else if (typeof output === 'string') {
        enhancedPrompt = output.trim();
      }

      res.json({ enhancedPrompt });
    } catch (error: any) {
      console.error("Error enhancing prompt:", error);
      let errorMessage = error.message || "Failed to enhance prompt";
      if (errorMessage.includes("402") || errorMessage.toLowerCase().includes("insufficient credit")) {
        errorMessage = "رصيدك في Replicate غير كافٍ. يرجى شحن حسابك للمتابعة.";
      }
      res.status(error.status || 500).json({ error: errorMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
