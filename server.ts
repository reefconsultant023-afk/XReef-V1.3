import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Replicate from "replicate";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API routes FIRST
  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, image, images, aspectRatio, resolution, negativePrompt, numImages = 1, model = "google/nano-banana-pro" } = req.body;
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
        prompt: finalPrompt
      };

      const inputImages = images && Array.isArray(images) && images.length > 0 ? images : (image ? [image] : null);

      if (model === "black-forest-labs/flux-2-pro") {
        input.safety_tolerance = 2;
        if (aspectRatio) {
          input.aspect_ratio = aspectRatio;
        }
        if (resolution) {
          if (resolution === "1K") input.resolution = "1 MP";
          else if (resolution === "2K") input.resolution = "2 MP";
          else if (resolution === "4K" || resolution === "8K") input.resolution = "4 MP";
          else input.resolution = resolution;
        }
        if (inputImages) {
          input.input_images = inputImages;
          if (!aspectRatio) {
            input.aspect_ratio = "match_input_image";
          }
        }
      } else if (model === "sdxl-based/realvisxl-v3-multi-controlnet-lora") {
        input.prompt = prompt;
        if (negativePrompt) input.negative_prompt = negativePrompt;
        if (inputImages && inputImages.length > 0) input.image = inputImages[0];
        
        let width = 1024;
        let height = 1024;
        if (aspectRatio === "16:9") { width = 1344; height = 768; }
        else if (aspectRatio === "9:16") { width = 768; height = 1344; }
        else if (aspectRatio === "4:3") { width = 1152; height = 896; }
        else if (aspectRatio === "3:4") { width = 896; height = 1152; }
        
        input.width = width;
        input.height = height;
        input.num_outputs = 1;
      } else {
        // Default to nano-banana-pro
        input.safety_filter_level = "block_only_high";
        input.allow_fallback_model = true;
        if (aspectRatio) {
          input.aspect_ratio = aspectRatio;
        }
        if (resolution) {
          input.resolution = resolution === "8K" ? "4K" : resolution;
        }
        if (inputImages) {
          input.image_input = inputImages;
        }
      }

      const count = Math.min(Math.max(Number(numImages) || 1, 1), 14);
      
      let replicateModel = model;
      if (model === "sdxl-based/realvisxl-v3-multi-controlnet-lora") {
        replicateModel = "sdxl-based/realvisxl-v3-multi-controlnet-lora:90a4a3604cd637cb9f1a2bdae1cfa9ed869362ca028814cdce310a78e27daade";
      }
      
      // Run in parallel to maximize speed
      const promises = Array.from({ length: count }).map(() => 
        replicate.run(replicateModel as `${string}/${string}`, { input })
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

  app.post("/api/enhance-prompt", async (req, res) => {
    try {
      const { prompt } = req.body;
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

      const input = {
        prompt: `Translate the following prompt to English if it is in another language, then EXPAND and ENHANCE it significantly. Add rich, vivid details, lighting, atmosphere, camera settings, and style keywords optimized for a high-end AI image generator. \n\nCRITICAL: DO NOT summarize or shorten the original prompt. If the original prompt is long, make the enhanced prompt even longer and more detailed. \n\nReturn ONLY the final enhanced prompt in English, without any conversational text, quotes, or explanations:\n\nOriginal prompt: ${prompt}`,
        system_prompt: "You are an expert AI image generation prompt engineer and translator. Your task is to translate any non-English prompts to English and then significantly expand them. You must add vivid details, lighting, style, and composition keywords to generate the best possible image. NEVER summarize or shorten the user's input; always build upon it to make it richer and more descriptive. Always output the result in English.",
        max_tokens: 1000
      };

      const output: any = await replicate.run("anthropic/claude-opus-4.6", { input });
      
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
