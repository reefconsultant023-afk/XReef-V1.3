import Replicate from "replicate";
const replicate = new Replicate({ auth: process.env.VITE_REPLICATE_API_TOKEN });
async function run() {
  try {
    const output = await replicate.run("nightmareai/real-esrgan", {
      input: {
        image: "https://replicate.delivery/pbxt/xxxx/out-0.webp",
        scale: 4,
        face_enhance: false
      }
    });
    console.log("Success:", output);
  } catch (e: any) {
    console.log("Error:", e.message, "Status:", e.status);
  }
}
run();
