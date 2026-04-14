import Replicate from "replicate";

export default async function handler(req: any, res: any) {
  // Allow CORS if needed, though Vercel handles same-origin automatically
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, image, images, styleImage, aspectRatio, resolution, negativePrompt, numImages = 1, model = "google/nano-banana-pro" } = req.body;
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

    const inputImages = images && Array.isArray(images) && images.length > 0 ? images : (image ? [image] : []);
    if (styleImage) inputImages.push(styleImage);
    const hasImage = inputImages.length > 0;

    const input: any = { 
      prompt: finalPrompt,
      safety_filter_level: "block_low_and_above",
      allow_fallback_model: true
    };

    if (aspectRatio) {
      input.aspect_ratio = aspectRatio;
    }
    if (resolution) {
      input.resolution = resolution;
    }
    if (hasImage) {
      input.image = inputImages[0];
      input.image_input = inputImages;
    }

    const count = Math.min(Math.max(Number(numImages) || 1, 1), 4);
    const results = [];
    
    // Run sequentially to avoid rate limit bursts
    for (let i = 0; i < count; i++) {
      try {
        console.log(`Running model google/nano-banana-pro for image ${i+1}...`);
        const output = await replicate.run("google/nano-banana-pro", { input });
        results.push(output);
      } catch (err: any) {
        console.error(`Error with model google/nano-banana-pro:`, err);
        
        if (err.status === 429 && i > 0) {
          console.warn("Rate limit hit, returning partial results");
          break;
        }
        throw err;
      }
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

    console.log("Replicate outputs:", outputs);

    res.status(200).json({ outputs });
  } catch (error: any) {
    console.error("Error generating image:", error);
    if (error.logs) {
      console.log("Replicate logs:", error.logs);
    }
    res.status(500).json({ 
      error: error.message || "Failed to generate image",
      details: error.logs || null
    });
  }
}
