import { QuoteRequestData, PostSubmitPositiveResponse, PostSubmitNegativeResponse } from '../types';

/**
 * Gets the API configuration based on the environment
 */
function getApiConfig() {
  const env = (process.env.K2_CYBER_ENV || 'prod').toLowerCase();
  const isTest = env === 'test';
  
  const baseUrl = isTest 
    ? 'https://api-test.k2cyber.co'
    : 'https://api.k2cyber.co';
  
  const tokenUrl = `${baseUrl}/auth/token`;
  const apiBaseUrl = `${baseUrl}/quote/firstcyber`;
  const submitEndpoint = `${apiBaseUrl}/submit`;
  
  const clientId = isTest
    ? process.env.K2_CYBER_CLIENT_ID_TEST
    : process.env.K2_CYBER_CLIENT_ID_PROD;
  
  const clientSecret = isTest
    ? process.env.K2_CYBER_CLIENT_SECRET_TEST
    : process.env.K2_CYBER_CLIENT_SECRET_PROD;
  
  return {
    tokenUrl,
    submitEndpoint,
    clientId,
    clientSecret,
    env: isTest ? 'test' : 'prod'
  };
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Token cache (includes environment to prevent cross-environment token usage)
let cachedToken: string | null = null;
let tokenExpiry: number = 0;
let cachedEnv: string | null = null;

/**
 * Fetches an OAuth2.1 access token using client credentials flow
 */
async function getAccessToken(): Promise<string> {
  const config = getApiConfig();

  if (!config.clientId || !config.clientSecret) {
    const envType = config.env === 'test' ? 'test' : 'production';
    throw new Error(
      `K2 Cyber API ${envType} credentials not configured. ` +
      `Please set K2_CYBER_CLIENT_ID_${envType.toUpperCase()} and ` +
      `K2_CYBER_CLIENT_SECRET_${envType.toUpperCase()} in .env.local`
    );
  }

  // Clear cache if environment changed
  if (cachedEnv !== config.env) {
    cachedToken = null;
    tokenExpiry = 0;
    cachedEnv = config.env;
  }

  // Check if we have a valid cached token
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: 'quote',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to obtain access token: ${response.status} ${errorText}`);
    }

    const tokenData: TokenResponse = await response.json();
    
    // Cache the token with a 5-minute buffer before expiry
    cachedToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000;

    return cachedToken;
  } catch (error: any) {
    if (error.message.includes('credentials')) {
      throw error;
    }
    throw new Error(`Authentication error: ${error.message}`);
  }
}

/**
 * Transforms QuoteRequestData to match the API schema (removes parsing_notes)
 */
function transformPayload(data: QuoteRequestData): Omit<QuoteRequestData, 'parsing_notes'> {
  const { parsing_notes, ...payload } = data;
  return payload;
}

/**
 * Submits a quote request to the K2 Cyber API
 */
export async function submitQuote(
  data: QuoteRequestData
): Promise<PostSubmitPositiveResponse | PostSubmitNegativeResponse> {
  try {
    const config = getApiConfig();
    
    // Get access token
    const accessToken = await getAccessToken();

    // Transform payload (remove parsing_notes)
    const payload = transformPayload(data);

    // Make API request
    const response = await fetch(config.submitEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (response.ok) {
      // Success response (200)
      return responseData as PostSubmitPositiveResponse;
    } else {
      // Error response (400)
      return responseData as PostSubmitNegativeResponse;
    }
  } catch (error: any) {
    // Network or other errors
    if (error.message.includes('credentials') || error.message.includes('Authentication')) {
      throw error;
    }
    throw new Error(`Failed to submit quote: ${error.message}`);
  }
}

