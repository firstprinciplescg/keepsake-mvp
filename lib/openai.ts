import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if(!apiKey){
  console.warn('OPENAI_API_KEY not set. Generation/transcription will fail.');
}

export const openai = new OpenAI({ apiKey });
export const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1';
export const OUTLINE_MODEL = process.env.OPENAI_MODEL_OUTLINE || 'gpt-4o-mini';
export const DRAFT_MODEL = process.env.OPENAI_MODEL_DRAFT || 'gpt-4o';
