import OpenAI from 'openai';

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const TRANSCRIPTION_MODEL =
  process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1';
export const OUTLINE_MODEL =
  process.env.OPENAI_MODEL_OUTLINE || 'gpt-4.1-mini';
export const DRAFT_MODEL =
  process.env.OPENAI_MODEL_DRAFT || 'gpt-4.1';
