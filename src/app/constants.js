// To use this in .env.local requires it to be prefixed with NEXT_PUBLIC_
const BASE_URL = process.env.base_url || "https://api.smartloop.ai";

export const API_ENDPOINT = `${BASE_URL}/v1`;
export const WS_ENDPOINT = `${BASE_URL}/ws`;
// gpushed (GPU boxes) has its own host: api.smartloop.ai is a Supabase custom
// domain, so a Worker route on it never runs. Same smartloop session token.
export const GPUSHED_ENDPOINT = process.env.gpushed_url || "https://gpushed-api.smartloop.ai";

// Plan names, prices and feature copy live on the marketing site, not in this
// app. Keeping a second copy here meant hand-syncing every price change (and
// getting it wrong: the app once advertised $19 while marketing said $5), so
// anything that wants to describe a plan links out to this instead.
export const PRICING_URL = "https://www.smartloop.ai/pricing";

export const APP_DESCRIPTION = (
  <>
    <strong style={{ color: '#ec4899' }}> <a href="https://smartloop.ai" target="_blank" rel="noopener noreferrer" className="no-underline" style={{ color: '#ec4899', textDecoration: 'none' }}>Smartloop</a></strong> is an SLM platform designed to fine-tune and inference models on edge. Get started for free to extract information from your documents using AI tailored for developers and businesses with privacy and security at its core.
  </>
);
