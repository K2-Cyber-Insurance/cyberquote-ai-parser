export interface QuoteRequestData {
  broker_email: string | null;
  insured_name: string | null;
  insured_location: {
    address_line1: string | null;
    address_line2: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
  };
  insured_taxid: string | null;
  claims: {
    claims_count: number | null;
    claims_amount: number | string | null;
  };
  year_founded: number | null;
  effective_date: string | null; // Format: YYYY-MM-DD
  revenue: number | string | null;
  naics: number | null;
  question_highrisk: boolean | null;
  agg_limit: number | string | null;
  retention: number | string | null;
  website: {
    has_website: boolean | null;
    domainName: string | null;
  };
  insured_contact: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    preferred_method: string | null;
  };
  parsing_notes?: string[] | null;
}

export interface EmailMetadata {
  subject: string | null;
  from: string | null;
  fromName: string | null;
  to: string | null;
  date: string | null;
}

export interface ParsedEmail {
  body: string;
  attachments: File[];
  metadata: EmailMetadata;
  originalFile: File;
}

export interface EmailSummary {
  summary: string;
  extractedFields: Partial<QuoteRequestData>;
}

// K2 Cyber API Response Types
export interface PostSubmitPositiveResponse {
  status: 'approved';
  data: {
    created_at: string;
    quote_id: string;
    quote_status: 'pending' | 'published' | 'failed' | 'pendingBindAndIssue' | 'issued';
    checkout_link: string;
    product_details: {
      product_name: string;
    };
    policy_term: {
      premium_only: string;
      agg_limit: string;
      retention: string;
      effective_date: string;
      expiration_date: string;
      include_tria: boolean;
      prior_acts: string;
    };
    personal_cyber: {
      premium: string;
      count: number;
      limit: string;
      retention: string;
    };
    coverage_details: {
      info_privacy_network_limit: string;
      regulatory_limit: string;
      pci_dss_limit: string;
      business_interruption_limit: string;
      vendor_bi_limit: string;
      cyber_extortion_limit: string;
      funds_transfer_limit: string;
      fraudulent_instruction_limit: string;
      invoice_manipulation_limit: string;
      media_liability_limit: string;
      system_failure_limit: string;
      vendor_system_failure_limit: string;
      incident_response_limit: string;
      data_recovery_limit: string;
      utility_fraud_limit: string;
      business_interruption_restoration_period: number;
      business_interruption_waiting_period: number;
      vendor_bi_restoration_period: number;
      vendor_bi_waiting_period: number;
      vendor_system_failure_restoration_period: number;
      vendor_system_failure_waiting_period: number;
      system_failure_restoration_period: number;
      system_failure_waiting_period: number;
    };
  };
}

export interface PostSubmitNegativeResponse {
  status: 'error' | 'declined';
  error: {
    message: string;
  };
}