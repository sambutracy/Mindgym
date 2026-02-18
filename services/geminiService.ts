
import { GoogleGenAI, Modality, Type, Blob, GenerateContentResponse } from "@google/genai";

// --- UTILITIES ---

export const getDailyISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
};

export const createSeededRNG = (seedStr: string) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
    }
    let seed = h;
    return () => {
      var t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
};

// Audio Helpers
export function encodeAudio(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeAudio(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encodeAudio(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- RETRY HELPER WITH MODEL FALLBACK ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGemini(
  config: any,
  retries = 2,
  delay = 1000
): Promise<GenerateContentResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent(config);
    return response as GenerateContentResponse;
  } catch (error: any) {
    const status = error.status || error.code || (error.message?.match(/\d{3}/)?.[0]);
    const isQuotaError = status == 429 || error.message?.includes('429') || error.message?.includes('quota');
    const isRetryable = status == 503 || error.message?.includes('503') || error.message?.includes('UNAVAILABLE');

    if (isQuotaError || (isRetryable && config.model.includes('pro'))) {
      if (config.model !== 'gemini-3-flash-preview') {
        console.warn(`Primary model quota/service issue. Falling back to Flash model...`);
        return callGemini({ ...config, model: 'gemini-3-flash-preview' }, retries, delay);
      }
    }

    if (retries > 0 && (isRetryable || isQuotaError)) {
      console.warn(`Gemini API Error (${status}). Retrying with backoff... (${retries} attempts left)`);
      await wait(delay);
      return callGemini(config, retries - 1, delay * 2);
    }
    throw error;
  }
}

// --- LOCAL GRID LAYOUT ALGORITHM ---

function canPlaceWord(grid: string[][], word: string, row: number, col: number, direction: 'across' | 'down'): boolean {
    const height = grid.length;
    const width = grid[0].length;
    const len = word.length;

    if (direction === 'across') {
        if (col + len > width) return false;
        if (col > 0 && grid[row][col - 1] !== null) return false; // Left neighbor
        if (col + len < width && grid[row][col + len] !== null) return false; // Right neighbor

        for (let i = 0; i < len; i++) {
            const char = word[i];
            const cell = grid[row][col + i];
            if (cell !== null && cell !== char) return false; // Conflict
            
            // Check vertical neighbors if placing a new letter (empty cell)
            if (cell === null) {
                if (row > 0 && grid[row - 1][col + i] !== null) return false;
                if (row < height - 1 && grid[row + 1][col + i] !== null) return false;
            }
        }
    } else { // down
        if (row + len > height) return false;
        if (row > 0 && grid[row - 1][col] !== null) return false; // Top neighbor
        if (row + len < height && grid[row + len][col] !== null) return false; // Bottom neighbor

        for (let i = 0; i < len; i++) {
            const char = word[i];
            const cell = grid[row + i][col];
            if (cell !== null && cell !== char) return false;

            if (cell === null) {
                if (col > 0 && grid[row + i][col - 1] !== null) return false;
                if (col < width - 1 && grid[row + i][col + 1] !== null) return false;
            }
        }
    }
    return true;
}

function placeWord(grid: string[][], word: string, row: number, col: number, direction: 'across' | 'down') {
    for (let i = 0; i < word.length; i++) {
        if (direction === 'across') grid[row][col + i] = word[i];
        else grid[row + i][col] = word[i];
    }
}

function generateGridLayout(wordsData: any[], size: number = 12) {
    const grid: string[][] = Array(size).fill(null).map(() => Array(size).fill(null));
    const placedWords: any[] = [];
    
    // Sort words by length descending to place larger ones first
    const sortedWords = [...wordsData].sort((a, b) => b.answer.length - a.answer.length);
    
    if (sortedWords.length === 0) return [];
    
    // Place first word in center
    const first = sortedWords[0];
    const startRow = Math.floor(size / 2);
    const startCol = Math.floor((size - first.answer.length) / 2);
    placeWord(grid, first.answer, startRow, startCol, 'across');
    placedWords.push({ ...first, row: startRow, col: startCol, direction: 'across' });
    
    const remaining = sortedWords.slice(1);
    
    // Try to place remaining words
    for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < remaining.length; i++) {
            const wordObj = remaining[i];
            if (placedWords.find(w => w.answer === wordObj.answer)) continue; // Already placed
            
            let placed = false;
            // Try to find an intersection with existing words
            for (const placedWord of placedWords) {
                if (placed) break;
                
                // Find common letters
                for (let j = 0; j < wordObj.answer.length; j++) {
                    if (placed) break;
                    const char = wordObj.answer[j];
                    
                    for (let k = 0; k < placedWord.answer.length; k++) {
                        if (placedWord.answer[k] === char) {
                            // Try perpendicular placement
                            if (placedWord.direction === 'across') {
                                const intersectRow = placedWord.row;
                                const intersectCol = placedWord.col + k;
                                const startRow = intersectRow - j;
                                const startCol = intersectCol;
                                
                                if (startRow >= 0 && startRow + wordObj.answer.length <= size) {
                                     if (canPlaceWord(grid, wordObj.answer, startRow, startCol, 'down')) {
                                         placeWord(grid, wordObj.answer, startRow, startCol, 'down');
                                         placedWords.push({ ...wordObj, row: startRow, col: startCol, direction: 'down' });
                                         placed = true;
                                     }
                                }
                            } else { // placedWord is 'down'
                                const intersectRow = placedWord.row + k;
                                const intersectCol = placedWord.col;
                                const startRow = intersectRow;
                                const startCol = intersectCol - j;
                                
                                if (startCol >= 0 && startCol + wordObj.answer.length <= size) {
                                    if (canPlaceWord(grid, wordObj.answer, startRow, startCol, 'across')) {
                                        placeWord(grid, wordObj.answer, startRow, startCol, 'across');
                                        placedWords.push({ ...wordObj, row: startRow, col: startCol, direction: 'across' });
                                        placed = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    return placedWords;
}

// --- CONTENT GENERATORS ---

export const fetchIntelligenceBriefing = async () => {
  const prompt = `ACCESS GLOBAL NEWS ARCHIVES FOR TODAY: ${new Date().toDateString()}. 
  Generate a Correlation Briefing based on top 4 significant global events. 
  BE CONCISE.`;

  try {
    const response = await callGemini({
      model: 'gemini-3-flash-preview', 
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headlines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  source: { type: Type.STRING }
                }
              }
            },
            puzzle: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                reasoning: { type: Type.STRING }
              }
            },
            tacticalNote: { type: Type.STRING }
          },
          required: ["headlines", "puzzle", "tacticalNote"]
        }
      }
    });

    let cleanText = response.text || "";
    cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    return {
      data: JSON.parse(cleanText),
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Gemini API Error (Intel Briefing):", error);
    return null;
  }
};

export const generateDeductionPuzzle = async (difficulty: string = 'Medium', seed: string = getDailyISO()) => {
  const complexityConfig = {
    'Easy': { matrixSize: '3 items', complexity: 'beginner, clear clues' },
    'Medium': { matrixSize: '4 items', complexity: 'intermediate, standard clues' },
    'Hard': { matrixSize: '5 items', complexity: 'expert, subtle/multi-step clues' }
  }[difficulty] || { matrixSize: '4 items', complexity: 'intermediate' };

  const prompt = `Generate a UNIQUE logic deduction puzzle. 
  Seed: ${seed}.
  Difficulty: ${difficulty} (${complexityConfig.complexity}).
  Theme: Intelligence Analysts.`;

  try {
    const response = await callGemini({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caseId: { type: Type.STRING },
            analysts: { type: Type.ARRAY, items: { type: Type.STRING } },
            projects: { type: Type.ARRAY, items: { type: Type.STRING } },
            levels: { type: Type.ARRAY, items: { type: Type.STRING } },
            clues: { type: Type.ARRAY, items: { type: Type.STRING } },
            solutionList: {
               type: Type.ARRAY,
               items: {
                 type: Type.OBJECT,
                 properties: {
                    analyst: { type: Type.STRING },
                    project: { type: Type.STRING },
                    level: { type: Type.STRING }
                 }
               }
            }
          },
          required: ["caseId", "analysts", "projects", "levels", "clues", "solutionList"]
        }
      }
    });
    
    const rawData = JSON.parse(response.text || "{}");
    const solutions: Record<string, { Project: string; Level: string }> = {};
    if (rawData.solutionList) {
        rawData.solutionList.forEach((sol: any) => {
            solutions[sol.analyst] = { Project: sol.project, Level: sol.level };
        });
    }

    return { ...rawData, solutions };
  } catch (e) {
    console.error("Gemini API Error (Deduction):", e);
    return null;
  }
};

export const generateCipherMessage = async (seed: string = getDailyISO()) => {
  const prompt = `Generate a unique cryptic sentence (10 words) for a cipher. Seed: ${seed}.`;

  try {
    const response = await callGemini({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { message: { type: Type.STRING } }
        }
      }
    });
    return JSON.parse(response.text || "{}").message;
  } catch (e) {
    console.error("Gemini API Error (Cipher):", e);
    return "KNOWLEDGE IS THE ONLY PERMANENT CURRENCY IN THE NEURAL AGE";
  }
};

export const generateSecretWord = async (seed: string = getDailyISO()) => {
  const prompt = `Generate one 5-letter word for logic games. Seed: ${seed}.`;

  try {
    const response = await callGemini({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { word: { type: Type.STRING } }
        }
      }
    });
    return JSON.parse(response.text || "{}").word.toUpperCase();
  } catch (e) {
    console.error("Gemini API Error (Word):", e);
    return "MINDY";
  }
};

export const generateCrosswordPuzzle = async (difficulty: string, seed: string = getDailyISO()) => {
  const gridSize = 12;
  const prompt = `Generate 25 unique general knowledge crossword clues and answers.
  Seed: ${seed}. Difficulty: ${difficulty}.
  Answers must be single words, no spaces, uppercase.
  Return JSON: Array of objects { answer, clue }.`;

  try {
    const response = await callGemini({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                    answer: { type: Type.STRING },
                    clue: { type: Type.STRING }
                    },
                    required: ["answer", "clue"]
                }
            }
          }
        }
      }
    });
    
    const data = JSON.parse(response.text || "{}");
    const words = data.items || [];
    
    // Client-side layout generation (Much faster than asking AI for coordinates)
    const validWords = generateGridLayout(words, gridSize);

    // 2. Assign Numbers (Standard Crossword Numbering)
    const startsAt = new Map<string, { across?: any, down?: any }>();
    validWords.forEach((w: any) => {
        const key = `${w.row}-${w.col}`;
        if (!startsAt.has(key)) startsAt.set(key, {});
        const cell = startsAt.get(key)!;
        if (w.direction === 'across') cell.across = w;
        else cell.down = w;
    });

    let currentNumber = 1;
    const finalClues = [];

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const key = `${r}-${c}`;
            if (startsAt.has(key)) {
                const cell = startsAt.get(key)!;
                const num = currentNumber++;
                
                if (cell.across) {
                    finalClues.push({
                        ...cell.across,
                        answer: cell.across.answer.toUpperCase(),
                        number: num,
                        text: cell.across.clue,
                        direction: 'across'
                    });
                }
                if (cell.down) {
                    finalClues.push({
                        ...cell.down,
                        answer: cell.down.answer.toUpperCase(),
                        number: num,
                        text: cell.down.clue,
                        direction: 'down'
                    });
                }
            }
        }
    }
    
    return finalClues;
  } catch (e) {
    console.error("Gemini API Error (Crossword):", e);
    return null;
  }
};

export const refineNeuralSculpture = async (baseImage: string, refinePrompt: string) => {
  try {
    const response = await callGemini({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { inlineData: { data: baseImage.split(',')[1], mimeType: 'image/png' } },
          { text: `Refine sculpture based on: ${refinePrompt}.` }
        ]
      },
      config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part?.inlineData?.data || null;
  } catch (error) { 
    console.error("Gemini API Error (Image Refine):", error);
    return null; 
  }
};

export const generateGeographicPuzzle = async (aptitude: number, prohibitedLocations: string[] = [], difficulty: string = 'Medium', seed: string = getDailyISO()) => {
  const prompt = `GENERATE A UNIQUE GEOGRAPHIC PUZZLE. Seed: ${seed}. Difficulty: ${difficulty}.`;
  
  try {
    const response = await callGemini({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            location: { type: Type.STRING },
            clues: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualMarkers: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: { label: { type: Type.STRING }, x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }
              } 
            },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            archiveFact: { type: Type.STRING },
            imageSearchTerm: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            sector: { type: Type.STRING }
          },
          required: ["location", "clues", "visualMarkers", "options", "archiveFact", "imageSearchTerm", "difficulty", "sector"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { 
    console.error("Gemini API Error (Geo):", error);
    return null; 
  }
};

export const getDeepReasoningHint = async (board: any, row: number, col: number, type: any) => {
  try {
    const response = await callGemini({
      model: 'gemini-3-flash-preview',
      contents: `Reason about this ${type} task: ${JSON.stringify(board)}. Return Thinking and FINAL_HINT:`,
      config: { thinkingConfig: { thinkingBudget: 8000 } }
    });
    return { text: response.text, grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
  } catch (e) {
    console.error("Gemini API Error (Reasoning):", e);
    return { text: "Thinking... Signal Interrupted. Please wait a moment.", grounding: [] };
  }
};

export const generateNeuralSculpture = async (aptitude: number, type: string) => {
  const prompt = `Abstract 3D sculpture, obsidian and neon, focus on ${type}, level ${aptitude}.`;
  try {
    const response = await callGemini({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part?.inlineData?.data || null;
  } catch (e) {
    console.error("Gemini API Error (Image Gen):", e);
    return null;
  }
};

export const speakHint = async (text: string) => {
  try {
    const response = await callGemini({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      const buffer = await decodeAudioData(decodeAudio(base64Audio), audioContext, 24000, 1);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
    }
  } catch (e) {
    console.error("Gemini API Error (TTS):", e);
  }
};

export const getDailyWordHint = async (target: string, lastGuess: string) => {
  try {
    const response = await callGemini({
      model: 'gemini-3-flash-preview',
      contents: `Wordle hint for ${target} given guess ${lastGuess}.`,
    });
    return response.text;
  } catch (e) {
    console.error("Gemini API Error (Word Hint):", e);
    return "Hint currently unavailable due to traffic.";
  }
};

export const analyzeImageFieldOps = async (base64Image: string, missionObjective: string) => {
  const prompt = `Mission: ${missionObjective}. Analyze image. 
  JSON: { "status": "VERIFIED" | "REJECTED", "title": string, "analysis": string, "reasoning": string }`;

  try {
    const response = await callGemini({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      },
      config: {
         responseMimeType: "application/json",
         responseSchema: {
            type: Type.OBJECT,
            properties: {
               status: { type: Type.STRING },
               title: { type: Type.STRING },
               analysis: { type: Type.STRING },
               reasoning: { type: Type.STRING }
            }
         }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini API Error (Vision):", error);
    return { status: "ERROR", title: "Transmission Failed", analysis: "Signal intercept failed.", reasoning: "" };
  }
};
