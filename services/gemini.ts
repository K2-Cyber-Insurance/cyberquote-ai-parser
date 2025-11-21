import { GoogleGenAI, Type, Schema } from "@google/genai";
import { QuoteRequestData } from "../types";
import { summarizeEmail, shouldSummarizeEmail } from "./emailSummarizer";
import { normalizeAggLimit, normalizeRetention } from "./fieldValidation";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    broker_email: { type: Type.STRING, nullable: true, description: "Email of the broker/agent submitting the application" },
    insured_name: { type: Type.STRING, nullable: true },
    insured_location: {
      type: Type.OBJECT,
      properties: {
        address_line1: { type: Type.STRING, nullable: true },
        address_line2: { type: Type.STRING, nullable: true },
        address_city: { type: Type.STRING, nullable: true },
        address_state: { type: Type.STRING, nullable: true },
        address_zip: { type: Type.STRING, nullable: true },
      },
    },
    insured_taxid: { type: Type.STRING, nullable: true },
    claims: {
      type: Type.OBJECT,
      properties: {
        claims_count: { type: Type.NUMBER, nullable: true },
        claims_amount: { type: Type.NUMBER, nullable: true },
      },
    },
    year_founded: { type: Type.NUMBER, nullable: true },
    effective_date: { type: Type.STRING, nullable: true, description: "Format YYYY-MM-DD" },
    revenue: { type: Type.NUMBER, nullable: true },
    naics: { type: Type.NUMBER, nullable: true, description: "NAICS code if available" },
    question_highrisk: { type: Type.BOOLEAN, nullable: true, description: "Does the applicant engage in high risk activities?" },
    agg_limit: { type: Type.NUMBER, nullable: true, description: "Requested aggregate limit" },
    retention: { type: Type.NUMBER, nullable: true, description: "Requested retention/deductible" },
    website: {
      type: Type.OBJECT,
      properties: {
        has_website: { type: Type.BOOLEAN, nullable: true },
        domainName: { type: Type.STRING, nullable: true },
      },
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
    },
    parsing_notes: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }, 
      nullable: true, 
      description: "List of notes regarding data conflicts between sources, or general extraction warnings." 
    },
  },
};

export async function parseInsurancePdf(
  base64DataArray: string[], 
  emailBody: string = '', 
  isEmailSummarized: boolean = false,
  emailMetadata?: { from?: string | null; subject?: string | null } | null
): Promise<QuoteRequestData> {
  try {
    // Validate inputs - Support Either/Or
    if (base64DataArray.length === 0 && (!emailBody || emailBody.trim().length === 0)) {
      throw new Error("No content provided. Please upload PDF applications OR an Email file.");
    }

    // If email body is too long and hasn't been summarized yet, summarize it first
    let emailContent = emailBody;
    let emailSummaryFields: Partial<QuoteRequestData> | null = null;
    
    if (emailBody && emailBody.trim().length > 0 && !isEmailSummarized && shouldSummarizeEmail(emailBody)) {
      try {
        const summary = await summarizeEmail(emailBody);
        emailContent = summary.summary;
        emailSummaryFields = summary.extractedFields;
      } catch (summarizeError) {
        console.warn("Failed to summarize email, using full content:", summarizeError);
        // Continue with full email body if summarization fails
      }
    }

    // Construct parts for files
    const parts = base64DataArray.map(data => ({
      inlineData: {
        mimeType: 'application/pdf',
        data: data,
      },
    }));

    // Add email body context if provided (now clean body, not raw .eml)
    if (emailContent && emailContent.trim().length > 0) {
      const emailLabel = isEmailSummarized || shouldSummarizeEmail(emailBody) 
        ? 'EMAIL SUMMARY (extracted from long email)' 
        : 'EMAIL BODY (clean content)';
      
      let emailContext = `SOURCE - ${emailLabel}:\n"${emailContent}"\n\n`;
      
      // Add email metadata hints for better extraction
      if (emailMetadata) {
        emailContext += `EMAIL METADATA (from email headers):\n`;
        if (emailMetadata.from) {
          emailContext += `- Sender Email (From header): ${emailMetadata.from}\n`;
          emailContext += `  NOTE: This is likely the broker/agent email address submitting the quote.\n`;
        }
        if (emailMetadata.subject) {
          emailContext += `- Subject: ${emailMetadata.subject}\n`;
        }
        emailContext += `\n`;
      }
      
      parts.push({
        text: emailContext
      } as any);
    }

    // Add the text prompt as the last part
    parts.push({
      text: `Analyze the provided content to extract cyber insurance quote data according to the OpenAPI schema.
             
             INPUT CONTEXT:
             - You may be provided with PDF application(s), email content (clean body or summary), or both.
             - If ONLY Email content is provided, extract all available data from the email.
             - If ONLY PDFs are provided, extract from the PDFs.
             - If BOTH are provided, prioritize information found in the EMAIL content if there is a conflict (e.g. different limits requested).

             REQUIRED FIELDS (from OpenAPI schema):
             - broker_email: Email of the broker/agent submitting the application. 
               IMPORTANT: If EMAIL METADATA section is provided above with "Sender Email (From header)", USE THAT VALUE as the broker_email. 
               This is the email address of the person/broker sending the quote submission email, not the insured's contact email.
               If no EMAIL METADATA is provided, look for the agent or producer's email address in the email body or PDF content.
             - insured_name: Name of the insured company
             - insured_location: Full address (address_line1, address_line2, address_city, address_state, address_zip)
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

             DATA EXTRACTION RULES:
             1. If a specific field is not found in any provided source, return null.
             2. Convert all monetary values to simple numbers (e.g., 1000000).
             3. Format dates as YYYY-MM-DD.
             4. For 'insured_location', try to parse the full address into component parts.
             5. For 'broker_email': 
                - FIRST PRIORITY: If EMAIL METADATA section is provided above with "Sender Email (From header)", USE THAT VALUE as the broker_email. This is the email address of the person/broker sending the quote submission email.
                - SECOND PRIORITY: Look for the agent or producer's email address in the email body or PDF content.
                - The broker_email should be the email address of the person submitting the quote request, not the insured's contact email.
             6. For 'naics', extract the code if present, or null.
             7. For 'question_highrisk', look for questions about adult content, gambling, cannabis, or crypto. Return true if yes.
             8. ALWAYS return 'claims', 'insured_location', 'website', and 'insured_contact' objects, even if their properties are null.
             9. Populate 'parsing_notes' with details about where data was found (e.g., "Extracted limits from email body", "Email was summarized due to length").`
    } as any);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: parts,
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0, // Deterministic output preferred for extraction
      },
    });

    if (response.text) {
      const extractedData = JSON.parse(response.text) as QuoteRequestData;
      
      console.log('Email metadata received:', emailMetadata);
      console.log('Broker email from Gemini:', extractedData.broker_email);
      
      // Pre-populate broker_email from email metadata if available (highest priority)
      // Always override whatever Gemini extracted with the actual email sender
      if (emailMetadata?.from) {
        console.log('Setting broker_email from email metadata:', emailMetadata.from);
        extractedData.broker_email = emailMetadata.from;
        if (!extractedData.parsing_notes) {
          extractedData.parsing_notes = [];
        }
        // Add note about using email sender
        extractedData.parsing_notes.push(`Broker email extracted from email sender (From header): ${emailMetadata.from}`);
      } else {
        console.log('No email metadata.from available, using Gemini extracted value');
      }
      
      console.log('Final broker_email:', extractedData.broker_email);
      
      // Merge email summary fields if available (they take precedence as they were extracted from full email)
      if (emailSummaryFields) {
        // Merge non-null values from email summary into extracted data
        Object.keys(emailSummaryFields).forEach(key => {
          const value = emailSummaryFields[key as keyof QuoteRequestData];
          if (value !== null && value !== undefined) {
            const currentValue = extractedData[key as keyof QuoteRequestData];
            // Only merge if current value is null/undefined or if it's a nested object
            // Exception: broker_email from metadata takes precedence over summary
            if (key === 'broker_email' && emailMetadata?.from) {
              // Keep the metadata value, don't override
              return;
            }
            if (currentValue === null || currentValue === undefined || 
                (typeof value === 'object' && typeof currentValue === 'object')) {
              (extractedData as any)[key] = value;
            }
          }
        });
        
        // Add note about summarization
        if (!extractedData.parsing_notes) {
          extractedData.parsing_notes = [];
        }
        extractedData.parsing_notes.push("Email was summarized due to length, key fields were pre-extracted");
      }
      
      // Normalize agg_limit and retention values
      if (extractedData.agg_limit !== null && extractedData.agg_limit !== undefined) {
        if (!extractedData.parsing_notes) {
          extractedData.parsing_notes = [];
        }
        const normalized = normalizeAggLimit(extractedData.agg_limit, extractedData.parsing_notes);
        extractedData.agg_limit = normalized.value;
      }
      
      if (extractedData.retention !== null && extractedData.retention !== undefined) {
        const normalized = normalizeRetention(extractedData.retention);
        if (normalized !== null) {
          extractedData.retention = normalized;
        }
      }
      
      // Default preferred_method to "Email" if not set
      if (!extractedData.insured_contact) {
        extractedData.insured_contact = {
          first_name: null,
          last_name: null,
          email: null,
          phone: null,
          preferred_method: 'Email'
        };
      } else if (!extractedData.insured_contact.preferred_method) {
        extractedData.insured_contact.preferred_method = 'Email';
      }
      
      return extractedData;
    }
    throw new Error("No text response from Gemini");
  } catch (error) {
    console.error("Error parsing documents:", error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('token') || error.message.includes('limit') || error.message.includes('quota')) {
        throw new Error('Content too large (Token Limit Exceeded). Please try removing some PDF files or use a shorter email.');
      }
      if (error.message.includes('API') || error.message.includes('key') || error.message.includes('authentication')) {
        throw new Error('API authentication error. Please check your API key and try again.');
      }
      if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('timeout')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      // Re-throw with original message if it's already descriptive
      throw error;
    }
    
    throw new Error('Failed to process documents: Unknown error occurred');
  }
}