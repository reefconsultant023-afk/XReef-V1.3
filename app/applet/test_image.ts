import Replicate from "replicate";
import * as fs from "fs";

async function run() {
  const replicate = new Replicate({
    auth: process.env.VITE_REPLICATE_API_TOKEN,
  });

  const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  try {
    const output = await replicate.run("google/nano-banana-pro", {
      input: {
        prompt: "A red pixel",
        image_input: [base64Image]
      }
    });
    console.log("Success:", output);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
