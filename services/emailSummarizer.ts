import { GoogleGenAI, Type, Schema } from "@google/genai";
import { QuoteRequestData, EmailSummary } from "../types";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Threshold for when to summarize (10K characters)
const EMAIL_SUMMARY_THRESHOLD = 10000;

// Schema for email summarization - extracting key insurance quote fields
const emailSummarySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "A concise summary of the email content focusing on insurance quote information"
    },
    broker_email: { type: Type.STRING, nullable: true, description: "Email of the broker/agent submitting the application" },
    insured_name: { type: Type.STRING, nullable: true, description: "Name of the insured company" },
    insured_location: {
      type: Type.OBJECT,
      properties: {
        address_line1: { type: Type.STRING, nullable: true },
        address_line2: { type: Type.STRING, nullable: true },
        address_city: { type: Type.STRING, nullable: true },
        address_state: { type: Type.STRING, nullable: true },
        address_zip: { type: Type.STRING, nullable: true },
      },
      nullable: true,
    },
    insured_taxid: { type: Type.STRING, nullable: true, description: "Tax ID or FEIN" },
    claims: {
      type: Type.OBJECT,
      properties: {
        claims_count: { type: Type.NUMBER, nullable: true },
        claims_amount: { type: Type.NUMBER, nullable: true },
      },
      nullable: true,
    },
    year_founded: { type: Type.NUMBER, nullable: true },
    effective_date: { type: Type.STRING, nullable: true, description: "Format YYYY-MM-DD" },
    revenue: { type: Type.NUMBER, nullable: true },
    naics: { type: Type.NUMBER, nullable: true, description: "NAICS code if available" },
    question_highrisk: { type: Type.BOOLEAN, nullable: true, description: "Does the applicant engage in high risk activities (adult content, gambling, cannabis, crypto)?" },
    agg_limit: { type: Type.NUMBER, nullable: true, description: "Requested aggregate limit" },
    retention: { type: Type.NUMBER, nullable: true, description: "Requested retention/deductible" },
    website: {
      type: Type.OBJECT,
      properties: {
        has_website: { type: Type.BOOLEAN, nullable: true },
        domainName: { type: Type.STRING, nullable: true },
      },
      nullable: true,
    },
    insured_contact: {
      type: Type.OBJECT,
      properties: {
        first_name: { type: Type.STRING, nullable: true },
        last_name: { type: Type.STRING, nullable: true },
        email: { type: Type.STRING, nullable: true },
        phone: { type: Type.STRING, nullable: true },
        preferred_method: { type: Type.STRING, nullable: true, enum: ["Email", "Phone"] },
      },
      nullable: true,
    },
  },
};

/**
 * Checks if email body is too long and needs summarization
 */
export function shouldSummarizeEmail(emailBody: string): boolean {
  return emailBody.length > EMAIL_SUMMARY_THRESHOLD;
}

/**
 * Summarizes a long email and extracts key insurance quote fields
 * Uses the OpenAPI schema fields as reference for extraction
 */
export async function summarizeEmail(emailBody: string): Promise<EmailSummary> {
  try {
    if (!emailBody || emailBody.trim().length === 0) {
      throw new Error("Email body is empty");
    }

    const prompt = `Analyze the following email content and extract key cyber insurance quote information.

Focus on extracting these specific fields (based on the OpenAPI schema):
- broker_email: Email of the broker/agent submitting the application
- insured_name: Name of the insured company
- insured_location: Full address broken into components (address_line1, address_line2, address_city, address_state, address_zip)
- insured_taxid: Tax ID or FEIN
- claims: Claims count and total claims amount
- year_founded: Year the company was founded
- effective_date: Requested policy effective date (format: YYYY-MM-DD)
- revenue: Annual revenue
- naics: NAICS code
- question_highrisk: Whether applicant engages in high risk activities (adult content, gambling, cannabis, crypto)
- agg_limit: Requested aggregate limit
- retention: Requested retention/deductible
- website: Whether they have a website and the domain name
- insured_contact: Primary contact information (first_name, last_name, email, phone, preferred_method)

EMAIL CONTENT:
${emailBody}

INSTRUCTIONS:
1. Extract all available fields from the email content
2. Return null for fields that are not found
3. Convert monetary values to numbers (e.g., "$1,000,000" becomes 1000000)
4. Format dates as YYYY-MM-DD
5. Provide a concise summary of the email content focusing on insurance quote information
6. If a field is not mentioned in the email, set it to null`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: emailSummarySchema,
        temperature: 0, // Deterministic output preferred for extraction
      },
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      return {
        summary: result.summary || '',
        extractedFields: {
          broker_email: result.broker_email || null,
          insured_name: result.insured_name || null,
          insured_location: result.insured_location || {
            address_line1: null,
            address_line2: null,
            address_city: null,
            address_state: null,
            address_zip: null,
          },
          insured_taxid: result.insured_taxid || null,
          claims: result.claims || {
            claims_count: null,
            claims_amount: null,
          },
          year_founded: result.year_founded || null,
          effective_date: result.effective_date || null,
          revenue: result.revenue || null,
          naics: result.naics || null,
          question_highrisk: result.question_highrisk ?? null,
          agg_limit: result.agg_limit || null,
          retention: result.retention || null,
          website: result.website || {
            has_website: null,
            domainName: null,
          },
          insured_contact: result.insured_contact || {
            first_name: null,
            last_name: null,
            email: null,
            phone: null,
            preferred_method: null,
          },
        },
      };
    }
    
    throw new Error("No text response from Gemini");
  } catch (error) {
    console.error("Error summarizing email:", error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('token') || error.message.includes('limit') || error.message.includes('quota')) {
        throw new Error('Email is too large to summarize. Please try with a shorter email or remove some content.');
      }
      if (error.message.includes('API') || error.message.includes('key')) {
        throw new Error('API error during summarization. Please check your API key and try again.');
      }
      throw new Error(`Failed to summarize email: ${error.message}`);
    }
    
    throw new Error('Failed to summarize email: Unknown error occurred');
  }
}

