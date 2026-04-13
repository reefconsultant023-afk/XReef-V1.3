import Replicate from "replicate";
import ascii85 from "ascii85";

async function run() {
  const replicate = new Replicate({
    auth: process.env.VITE_REPLICATE_API_TOKEN,
  });

  const buf = Buffer.from("hello world");
  const b85 = ascii85.encode(buf).toString();

  try {
    const output = await replicate.run("google/gemini-3.1-pro", {
      input: {
        prompt: "What is this?",
        images: [b85]
      }
    });
    console.log(output);
  } catch (e) {
    console.error(e);
  }
}
run();
