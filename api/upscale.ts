import Replicate from "replicate";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    res.status(200).json({ output: imageUrl });
  } catch (error: any) {
    console.error("Error upscaling image:", error);
    let errorMessage = error.message || "Failed to upscale image";
    if (errorMessage.includes("402") || errorMessage.toLowerCase().includes("insufficient credit")) {
      errorMessage = "رصيدك في Replicate غير كافٍ. يرجى شحن حسابك للمتابعة.";
    }
    res.status(error.status || 500).json({ error: errorMessage });
  }
}
