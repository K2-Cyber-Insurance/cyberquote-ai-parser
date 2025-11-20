import { QuoteRequestData, PostSubmitPositiveResponse, PostSubmitNegativeResponse } from '../types';

/**
 * Gets the API configuration based on the environment
 */
function getApiConfig() {
  const env = (process.env.K2_CYBER_ENV || 'prod').toLowerCase();
  const isTest = env === 'test';
  
  // Use proxy in development to avoid CORS issues
  const isDevelopment = import.meta.env.DEV;
  const baseUrl = isDevelopment
    ? '/api/k2cyber'  // Use Vite proxy in development
    : (isTest 
        ? 'https://api-test.k2cyber.co'
        : 'https://api.k2cyber.co');
  
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
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    
    // Only include scope if explicitly configured
    // If your client credentials don't have the 'quote' scope, leave K2_CYBER_SCOPE empty
    const scope = process.env.K2_CYBER_SCOPE;
    if (scope && scope.trim() !== '') {
      params.append('scope', scope.trim());
    }
    
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to obtain access token: ${response.status} ${errorText}`;
      
      // Provide helpful guidance for scope errors
      if (errorText.includes('invalid_scope') || errorText.includes('scopes not found')) {
        errorMessage += '\n\n' +
          'This error indicates your client credentials do not have the requested scope configured on the API server. ' +
          'Options:\n' +
          '1. Contact your API administrator to enable the scope for your client credentials\n' +
          '2. If no scope is required, leave K2_CYBER_SCOPE empty in your .env.local file\n' +
          '3. If a different scope is needed, set K2_CYBER_SCOPE to that value in .env.local';
      }
      
      throw new Error(errorMessage);
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
 * Ensures a string value is not null (converts to empty string)
 */
function ensureString(value: string | null | undefined): string {
  return value ?? '';
}

/**
 * Ensures a URL has a protocol (adds https:// if missing)
 */
function ensureValidUrl(url: string | null | undefined): string {
  if (!url || url.trim() === '') {
    return '';
  }
  const trimmed = url.trim();
  // If it already has a protocol, return as is
  if (trimmed.match(/^https?:\/\//i)) {
    return trimmed;
  }
  // Otherwise add https://
  return `https://${trimmed}`;
}

/**
 * Transforms QuoteRequestData to match the API schema
 * - Removes parsing_notes
 * - Converts null string values to empty strings
 * - Ensures website.domainName is a valid URL format (omits if empty or has_website is false)
 */
function transformPayload(data: QuoteRequestData): Omit<QuoteRequestData, 'parsing_notes'> {
  const { parsing_notes, ...rest } = data;
  
  const hasWebsite = rest.website?.has_website ?? false;
  const domainName = rest.website?.domainName;
  const validDomainName = domainName && domainName.trim() !== '' 
    ? ensureValidUrl(domainName) 
    : '';
  
  // Build website object - only include domainName if has_website is true and domainName is not empty
  const website: { has_website: boolean; domainName?: string } = {
    has_website: hasWebsite,
  };
  if (hasWebsite && validDomainName) {
    website.domainName = validDomainName;
  }
  
  return {
    ...rest,
    broker_email: ensureString(rest.broker_email),
    insured_name: ensureString(rest.insured_name),
    insured_taxid: ensureString(rest.insured_taxid),
    insured_location: {
      address_line1: ensureString(rest.insured_location?.address_line1),
      address_line2: ensureString(rest.insured_location?.address_line2),
      address_city: ensureString(rest.insured_location?.address_city),
      address_state: ensureString(rest.insured_location?.address_state),
      address_zip: ensureString(rest.insured_location?.address_zip),
    },
    website,
    insured_contact: {
      first_name: ensureString(rest.insured_contact?.first_name),
      last_name: ensureString(rest.insured_contact?.last_name),
      email: ensureString(rest.insured_contact?.email),
      phone: ensureString(rest.insured_contact?.phone),
      preferred_method: ensureString(rest.insured_contact?.preferred_method),
    },
  };
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

