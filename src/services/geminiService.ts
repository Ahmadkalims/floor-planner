import { GoogleGenerativeAI } from '@google/generative-ai';
import { useStore } from '../store/useStore';
import { v4 as uuidv4 } from 'uuid';

function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string, mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64data,
          mimeType: file.type
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function scanFloorplanImage(file: File) {
  const store = useStore.getState();
  const apiKey = store.userGeminiImageKey || import.meta.env.VITE_GEMINI_VISION_API_KEY;
  
  if (!apiKey) {
    throw new Error("No Gemini API key found. Please set one in the settings.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });

  const prompt = `Analyze this floor plan image and convert it into a JSON structure for a 2D floor planner application. 
CRITICAL: You must return ONLY raw valid JSON. Do not use Markdown code blocks. Do not add any explanatory text.

JSON Schema to follow exactly:
{
  "walls": [
    { "start": { "x": number, "y": number }, "end": { "x": number, "y": number }, "thickness": number, "height": number }
  ],
  "items": [
    { "type": "door"|"window"|"bed"|"sofa"|"bathtub"|"toilet"|"washbasin", "position": { "x": number, "y": number }, "rotation": number, "width": number, "length": number, "height": number }
  ]
}

Instructions:
1. Use a coordinate system where top-left is (0,0), mapping the dimensions of the plan into cm. Assume 1 pixel in the image equals approximately 1 cm, or read dimensions from the image if present.
2. Estimate the scale to fit the entire floorplan within a 1000x1000 coordinate area. 
3. Default wall thickness should be 15, and height should be 250.
4. Doors and windows MUST intersect or lie perfectly on top of walls.
5. Accurately trace all exterior and interior walls as connected segments.
6. Identify common furniture (beds, sofas, toilets, bathtubs) and map them accurately.
`;

  try {
    const imagePart = await fileToGenerativePart(file);
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    // Clean markdown if present
    const cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanText);
    
    // Add IDs to the generated elements
    if (parsedData.walls) {
      parsedData.walls = parsedData.walls.map((w: any) => ({ ...w, id: uuidv4(), thickness: w.thickness || 15, height: w.height || 250 }));
    }
    if (parsedData.items) {
      parsedData.items = parsedData.items.map((i: any) => ({ ...i, id: uuidv4() }));
    }

    return parsedData;
  } catch (error) {
    console.error("Gemini Scan Error:", error);
    throw error;
  }
}
