import React, { useState, useEffect } from 'react';
import { QuoteRequestData, PostSubmitPositiveResponse, PostSubmitNegativeResponse } from '../types';
import { submitQuote } from '../services/k2cyberApi';
import { SmartSelect } from './SmartSelect';
import { AGG_LIMIT_OPTIONS, RETENTION_OPTIONS, normalizeAggLimit, normalizeRetention, formatCurrency } from '../services/fieldValidation';

interface QuoteFormProps {
  data: QuoteRequestData;
}

// Helper to identify missing fields (null, undefined, or empty string)
const isMissing = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
};

// Helper to ensure all nested objects exist
const sanitizeData = (data: Partial<QuoteRequestData>): QuoteRequestData => {
  return {
    broker_email: data.broker_email ?? null,
    insured_name: data.insured_name ?? null,
    insured_taxid: data.insured_taxid ?? null,
    year_founded: data.year_founded ?? null,
    effective_date: data.effective_date ?? null,
    revenue: data.revenue ?? null,
    naics: data.naics ?? null,
    question_highrisk: data.question_highrisk ?? null,
    agg_limit: data.agg_limit ?? null,
    retention: data.retention ?? null,
    insured_location: data.insured_location || {
      address_line1: null,
      address_line2: null,
      address_city: null,
      address_state: null,
      address_zip: null
    },
    claims: data.claims || {
      claims_count: null,
      claims_amount: null
    },
    website: data.website || {
      has_website: null,
      domainName: null
    },
    insured_contact: data.insured_contact || {
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      preferred_method: 'Email' // Default to Email
    },
    parsing_notes: data.parsing_notes ?? []
  };
};

// Generic Input Component
const SmartInput: React.FC<{
  label: string;
  value: any;
  onChange: (val: any) => void;
  type: 'text' | 'number' | 'boolean' | 'date' | 'email';
  placeholder?: string;
  required?: boolean;
  isModified?: boolean;
  useCommas?: boolean;
}> = ({ label, value, onChange, type, placeholder, required = true, isModified = false, useCommas = false }) => {
  const missing = required && isMissing(value);
  const [isFocused, setIsFocused] = useState(false);

  const inputType = type === 'number' && useCommas ? 'text' : type;

  const getDisplayValue = () => {
    if (value === null || value === undefined) return '';
    if (type === 'number' && useCommas && !isFocused) {
        const n = Number(value);
        return isNaN(n) ? value : n.toLocaleString();
    }
    return value;
  };

  return (
    <div className={`group relative p-4 rounded-lg border transition-all duration-300 ${
      missing 
        ? 'bg-k2-black border-k2-grey hover:border-k2-grey' 
        : 'bg-k2-black border-k2-blue hover:border-k2-blue'
    }`}>
      <div className="flex justify-between items-start mb-2.5">
        <label className="text-xs font-semibold text-k2-grey uppercase tracking-wider flex items-center gap-2" style={{ fontWeight: 600 }}>
          {label}
          {missing ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-k2-grey/20 text-k2-grey border border-k2-grey tracking-wide" style={{ fontWeight: 600 }}>
              MISSING
            </span>
          ) : isModified ? (
            <span className="inline-flex items-center text-[10px] font-semibold text-k2-blue tracking-wide" style={{ fontWeight: 600 }}>
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              MANUAL
            </span>
          ) : (
             <span className="inline-flex items-center text-[10px] font-semibold text-k2-green tracking-wide" style={{ fontWeight: 600 }}>
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              EXTRACTED
            </span>
          )}
        </label>
      </div>

      {type === 'boolean' ? (
        <select
          value={value === null ? '' : value.toString()}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : v === 'true');
          }}
          className={`w-full bg-k2-black text-sm rounded-md px-3 py-2.5 outline-none focus:ring-1 transition-all font-light ${
            missing 
              ? 'text-white border border-k2-grey focus:ring-k2-grey focus:border-k2-grey' 
              : 'text-white border border-k2-blue focus:ring-k2-blue focus:border-k2-blue'
          }`}
          style={{ fontWeight: 300 }}
        >
          <option value="">Select...</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : (
        <input
          type={inputType}
          value={getDisplayValue()}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => {
            const v = e.target.value;
            if (type === 'number') {
                if (useCommas) {
                    const raw = v.replace(/,/g, '');
                    if (raw === '') onChange(null);
                    else if (!isNaN(Number(raw))) onChange(Number(raw));
                } else {
                    onChange(v === '' ? null : Number(v));
                }
            } else {
                onChange(v);
            }
          }}
          placeholder={placeholder || (missing ? "Required..." : "")}
          className={`w-full bg-k2-black text-sm rounded-md px-3 py-2.5 outline-none focus:ring-1 transition-all font-light ${
            missing 
              ? 'text-white border border-k2-grey focus:ring-k2-grey focus:border-k2-grey placeholder-k2-grey/50' 
              : 'text-white border border-k2-blue focus:ring-k2-blue focus:border-k2-blue placeholder-k2-grey/50'
          }`}
          style={{ fontWeight: 300 }}
        />
      )}
    </div>
  );
};

// Coverage Details Dropdown Component
const CoverageDetailsSection: React.FC<{ coverageDetails: PostSubmitPositiveResponse['data']['coverage_details'] }> = ({ coverageDetails }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatValue = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    return String(value);
  };

  return (
    <div className="bg-k2-black/50 rounded-lg border border-k2-blue overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-k2-blue/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-k2-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-semibold text-white" style={{ fontWeight: 600 }}>Coverage Details</span>
        </div>
        <svg
          className={`w-5 h-5 text-k2-grey transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="px-4 py-4 border-t border-k2-blue/30 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coverageDetails.info_privacy_network_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Info Privacy Network Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.info_privacy_network_limit)}</div>
              </div>
            )}
            {coverageDetails.regulatory_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Regulatory Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.regulatory_limit)}</div>
              </div>
            )}
            {coverageDetails.pci_dss_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">PCI DSS Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.pci_dss_limit)}</div>
              </div>
            )}
            {coverageDetails.business_interruption_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Business Interruption Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.business_interruption_limit)}</div>
              </div>
            )}
            {coverageDetails.vendor_bi_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Vendor BI Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.vendor_bi_limit)}</div>
              </div>
            )}
            {coverageDetails.cyber_extortion_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Cyber Extortion Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.cyber_extortion_limit)}</div>
              </div>
            )}
            {coverageDetails.funds_transfer_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Funds Transfer Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.funds_transfer_limit)}</div>
              </div>
            )}
            {coverageDetails.fraudulent_instruction_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Fraudulent Instruction Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.fraudulent_instruction_limit)}</div>
              </div>
            )}
            {coverageDetails.invoice_manipulation_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Invoice Manipulation Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.invoice_manipulation_limit)}</div>
              </div>
            )}
            {coverageDetails.media_liability_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Media Liability Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.media_liability_limit)}</div>
              </div>
            )}
            {coverageDetails.system_failure_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">System Failure Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.system_failure_limit)}</div>
              </div>
            )}
            {coverageDetails.vendor_system_failure_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Vendor System Failure Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.vendor_system_failure_limit)}</div>
              </div>
            )}
            {coverageDetails.incident_response_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Incident Response Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.incident_response_limit)}</div>
              </div>
            )}
            {coverageDetails.data_recovery_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Data Recovery Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.data_recovery_limit)}</div>
              </div>
            )}
            {coverageDetails.utility_fraud_limit && (
              <div>
                <div className="text-xs text-k2-grey/70 mb-1">Utility Fraud Limit</div>
                <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.utility_fraud_limit)}</div>
              </div>
            )}
          </div>
          
          {/* Period Fields */}
          {(coverageDetails.business_interruption_restoration_period !== undefined ||
            coverageDetails.business_interruption_waiting_period !== undefined ||
            coverageDetails.vendor_bi_restoration_period !== undefined ||
            coverageDetails.vendor_bi_waiting_period !== undefined ||
            coverageDetails.vendor_system_failure_restoration_period !== undefined ||
            coverageDetails.vendor_system_failure_waiting_period !== undefined ||
            coverageDetails.system_failure_restoration_period !== undefined ||
            coverageDetails.system_failure_waiting_period !== undefined) && (
            <div className="mt-4 pt-4 border-t border-k2-blue/30">
              <div className="text-xs font-semibold text-k2-grey uppercase tracking-wider mb-3" style={{ fontWeight: 600 }}>Periods</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {coverageDetails.business_interruption_restoration_period !== undefined && (
                  <div>
                    <div className="text-xs text-k2-grey/70 mb-1">BI Restoration Period</div>
                    <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.business_interruption_restoration_period)}</div>
                  </div>
                )}
                {coverageDetails.business_interruption_waiting_period !== undefined && (
                  <div>
                    <div className="text-xs text-k2-grey/70 mb-1">BI Waiting Period</div>
                    <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.business_interruption_waiting_period)}</div>
                  </div>
                )}
                {coverageDetails.vendor_bi_restoration_period !== undefined && (
                  <div>
                    <div className="text-xs text-k2-grey/70 mb-1">Vendor BI Restoration Period</div>
                    <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.vendor_bi_restoration_period)}</div>
                  </div>
                )}
                {coverageDetails.vendor_bi_waiting_period !== undefined && (
                  <div>
                    <div className="text-xs text-k2-grey/70 mb-1">Vendor BI Waiting Period</div>
                    <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.vendor_bi_waiting_period)}</div>
                  </div>
                )}
                {coverageDetails.vendor_system_failure_restoration_period !== undefined && (
                  <div>
                    <div className="text-xs text-k2-grey/70 mb-1">Vendor SF Restoration Period</div>
                    <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.vendor_system_failure_restoration_period)}</div>
                  </div>
                )}
                {coverageDetails.vendor_system_failure_waiting_period !== undefined && (
                  <div>
                    <div className="text-xs text-k2-grey/70 mb-1">Vendor SF Waiting Period</div>
                    <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.vendor_system_failure_waiting_period)}</div>
                  </div>
                )}
                {coverageDetails.system_failure_restoration_period !== undefined && (
                  <div>
                    <div className="text-xs text-k2-grey/70 mb-1">System Failure Restoration Period</div>
                    <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.system_failure_restoration_period)}</div>
                  </div>
                )}
                {coverageDetails.system_failure_waiting_period !== undefined && (
                  <div>
                    <div className="text-xs text-k2-grey/70 mb-1">System Failure Waiting Period</div>
                    <div className="text-white font-semibold text-sm" style={{ fontWeight: 600 }}>{formatValue(coverageDetails.system_failure_waiting_period)}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode; icon?: React.ReactNode; completeness: number }> = ({ title, children, icon, completeness }) => (
  <div className="bg-k2-black rounded-xl shadow-lg border border-k2-blue overflow-hidden mb-8">
    <div className="px-6 py-5 border-b border-k2-blue bg-k2-black flex items-center justify-between">
      <div className="flex items-center gap-4">
        {icon && <span className="text-k2-green p-2 bg-k2-green/10 rounded-lg">{icon}</span>}
        <h3 className="font-semibold text-lg text-white tracking-tight" style={{ fontWeight: 600 }}>{title}</h3>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-32 h-2 bg-k2-black rounded-full overflow-hidden border border-k2-blue">
          <div 
            className={`h-full rounded-full transition-all duration-700 ease-out ${completeness === 100 ? 'bg-k2-green' : 'bg-k2-green/50'}`} 
            style={{ width: `${completeness}%` }}
          />
        </div>
        <span className={`text-xs font-semibold w-10 text-right ${completeness === 100 ? 'text-k2-green' : 'text-k2-grey'}`}>
          {Math.round(completeness)}%
        </span>
      </div>
    </div>
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {children}
    </div>
  </div>
);

export const QuoteForm: React.FC<QuoteFormProps> = ({ data: initialData }) => {
  const [formData, setFormData] = useState<QuoteRequestData>(() => sanitizeData(initialData));
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ total: 0, filled: 0, percent: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<PostSubmitPositiveResponse | PostSubmitNegativeResponse | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  const updateField = (path: string[], value: any) => {
    setModifiedFields(prev => {
        const next = new Set(prev);
        next.add(path.join('.'));
        return next;
    });

    const newData = JSON.parse(JSON.stringify(formData));
    let current = newData;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {}; 
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setFormData(newData);
  };

  const isFieldModified = (path: string[]) => modifiedFields.has(path.join('.'));

  useEffect(() => {
    let total = 0;
    let filled = 0;
    
    const requiredFields = [
      formData.broker_email,
      formData.insured_name,
      formData.insured_taxid,
      formData.year_founded,
      formData.naics,
      formData.effective_date,
      formData.revenue,
      formData.agg_limit,
      formData.retention,
      formData.question_highrisk,
      formData.insured_location?.address_line1,
      formData.insured_location?.address_city,
      formData.insured_location?.address_state,
      formData.insured_location?.address_zip,
      formData.claims?.claims_count,
      formData.claims?.claims_amount,
      formData.website?.has_website,
      formData.insured_contact?.first_name,
      formData.insured_contact?.last_name,
      formData.insured_contact?.email,
      formData.insured_contact?.preferred_method
    ];

    total = requiredFields.length;
    filled = requiredFields.filter(v => !isMissing(v)).length;

    setStats({
      total,
      filled,
      percent: total > 0 ? (filled / total) * 100 : 0
    });
  }, [formData]);

  const getSectionCompleteness = (sectionData: any, fieldsToCheck?: string[]) => {
    let t = 0;
    let f = 0;
    
    if (!sectionData) return 0;

    if (fieldsToCheck) {
        t = fieldsToCheck.length;
        f = fieldsToCheck.filter(key => !isMissing(sectionData[key])).length;
    } else {
        const check = (obj: any) => {
            if (!obj) return;
            Object.values(obj).forEach(val => {
                if (typeof val === 'object' && val !== null) {
                    check(val);
                } else {
                    t++;
                    if (!isMissing(val)) f++;
                }
            });
        };
        check(sectionData);
    }
    return t > 0 ? (f / t) * 100 : 0;
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      
      {/* Header Summary */}
      <div className="mb-10 bg-k2-black p-8 rounded-2xl border border-k2-blue shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-k2-green/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="z-10">
            <h2 className="text-3xl font-semibold text-white mb-3" style={{ fontWeight: 600 }}>API Readiness Assessment</h2>
            <p className="text-k2-grey font-light text-base" style={{ fontWeight: 300 }}>
              Review extracted data before submission to <code className="bg-k2-black/30 px-2 py-1 rounded text-k2-green font-mono text-sm">POST /quotes/submit</code>.
              <br/>
              <span className={`inline-block mt-2 font-semibold ${stats.percent === 100 ? "text-k2-green" : "text-k2-grey"}`} style={{ fontWeight: 600 }}>
                {stats.total - stats.filled} required fields missing
              </span>
            </p>
          </div>
          <div className="w-full md:w-1/3 space-y-3 z-10">
            <div className="flex justify-between text-sm font-semibold tracking-wide" style={{ fontWeight: 600 }}>
              <span className="text-white">COMPLETION STATUS</span>
              <span className={stats.percent === 100 ? "text-k2-green" : "text-white"}>
                {Math.round(stats.percent)}%
              </span>
            </div>
            <div className="h-4 bg-k2-black/40 rounded-full overflow-hidden backdrop-blur-sm border border-k2-blue">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                  stats.percent === 100 
                    ? 'bg-gradient-to-r from-k2-green to-k2-green-dark' 
                    : 'bg-gradient-to-r from-k2-green/50 to-k2-green'
                }`}
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
          <button 
            className={`px-8 py-4 rounded-xl font-semibold tracking-wide transition-all shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 z-10 ${
                stats.percent === 100 && !isSubmitting
                ? 'bg-k2-green hover:bg-k2-green-light text-k2-black shadow-k2-green/20'
                : 'bg-k2-black text-k2-grey cursor-not-allowed border border-k2-blue/50'
            }`}
            style={{ fontWeight: 600 }}
            disabled={stats.percent !== 100 || isSubmitting}
            onClick={async () => {
                setIsSubmitting(true);
                setErrorModalOpen(false);
                try {
                    const result = await submitQuote(formData);
                    setSubmitResult(result);
                    if (result.status === 'approved') {
                        setShowResult(true);
                    } else {
                        setErrorModalOpen(true);
                    }
                } catch (error: any) {
                    // Network or authentication errors
                    setSubmitResult({
                        status: 'error',
                        error: {
                            message: error.message || 'An unexpected error occurred. Please try again.'
                        }
                    } as PostSubmitNegativeResponse);
                    setErrorModalOpen(true);
                } finally {
                    setIsSubmitting(false);
                }
            }}
          >
            {isSubmitting ? (
                <span className="flex items-center gap-2">
                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                </span>
            ) : (
                'Generate Quote'
            )}
          </button>
        </div>
      </div>

      {/* Success Result Display */}
      {showResult && submitResult && submitResult.status === 'approved' && (
        <div className="mb-8 bg-k2-black border border-k2-green rounded-xl p-6 animate-fade-in">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-k2-green font-semibold text-xl flex items-center gap-2" style={{ fontWeight: 600 }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Quote Generated Successfully!
            </h3>
            <button
              onClick={() => setShowResult(false)}
              className="text-k2-grey hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-k2-black/50 rounded-lg p-4 border border-k2-blue">
                <div className="text-xs font-semibold text-k2-grey uppercase tracking-wider mb-1" style={{ fontWeight: 600 }}>Quote ID</div>
                <div className="text-white font-mono text-sm" style={{ fontWeight: 300 }}>{submitResult.data.quote_id}</div>
              </div>
              <div className="bg-k2-black/50 rounded-lg p-4 border border-k2-blue">
                <div className="text-xs font-semibold text-k2-grey uppercase tracking-wider mb-1" style={{ fontWeight: 600 }}>Status</div>
                <div className="text-k2-green font-semibold capitalize" style={{ fontWeight: 600 }}>{submitResult.data.quote_status}</div>
              </div>
            </div>
            
            {/* Policy Term Fields */}
            {submitResult.data.policy_term && (
              <div className="bg-k2-black/50 rounded-lg p-4 border border-k2-blue">
                <div className="text-xs font-semibold text-k2-grey uppercase tracking-wider mb-3" style={{ fontWeight: 600 }}>Policy Terms</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {submitResult.data.policy_term.premium_only && (
                    <div>
                      <div className="text-xs text-k2-grey/70 mb-1">Premium Only</div>
                      <div className="text-white font-semibold" style={{ fontWeight: 600 }}>{submitResult.data.policy_term.premium_only}</div>
                    </div>
                  )}
                  {submitResult.data.policy_term.agg_limit && (
                    <div>
                      <div className="text-xs text-k2-grey/70 mb-1">Aggregate Limit</div>
                      <div className="text-white font-semibold" style={{ fontWeight: 600 }}>{submitResult.data.policy_term.agg_limit}</div>
                    </div>
                  )}
                  {submitResult.data.policy_term.retention && (
                    <div>
                      <div className="text-xs text-k2-grey/70 mb-1">Retention</div>
                      <div className="text-white font-semibold" style={{ fontWeight: 600 }}>{submitResult.data.policy_term.retention}</div>
                    </div>
                  )}
                  {submitResult.data.policy_term.effective_date && (
                    <div>
                      <div className="text-xs text-k2-grey/70 mb-1">Effective Date</div>
                      <div className="text-white font-semibold" style={{ fontWeight: 600 }}>{submitResult.data.policy_term.effective_date}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Coverage Details Dropdown */}
            {submitResult.data.coverage_details && (
              <CoverageDetailsSection coverageDetails={submitResult.data.coverage_details} />
            )}

            {submitResult.data.checkout_link && (
              <div className="bg-k2-green/10 rounded-lg p-4 border border-k2-green">
                <a
                  href={submitResult.data.checkout_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-k2-green hover:text-k2-green-light font-semibold flex items-center gap-2 transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Checkout Link
                </a>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowResult(false);
                  setSubmitResult(null);
                }}
                className="px-6 py-2 rounded-lg font-semibold bg-k2-blue hover:bg-k2-blue/80 text-white transition-colors"
                style={{ fontWeight: 600 }}
              >
                Edit & Resubmit
              </button>
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="px-6 py-2 rounded-lg font-semibold bg-k2-black border border-k2-blue hover:bg-k2-blue/10 text-white transition-colors"
                style={{ fontWeight: 600 }}
              >
                Submit New Quote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorModalOpen && submitResult && submitResult.status !== 'approved' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-k2-black border border-k2-blue rounded-xl p-6 max-w-md w-full animate-fade-in">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-red-400 font-semibold text-xl flex items-center gap-2" style={{ fontWeight: 600 }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {submitResult.status === 'declined' ? 'Quote Declined' : 'Error'}
              </h3>
              <button
                onClick={() => setErrorModalOpen(false)}
                className="text-k2-grey hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-6">
              <p className="text-k2-grey font-light" style={{ fontWeight: 300 }}>
                {submitResult.error.message}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setErrorModalOpen(false)}
                className="px-6 py-2 rounded-lg font-semibold bg-k2-blue hover:bg-k2-blue/80 text-white transition-colors flex-1"
                style={{ fontWeight: 600 }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setErrorModalOpen(false);
                  setSubmitResult(null);
                }}
                className="px-6 py-2 rounded-lg font-semibold bg-k2-black border border-k2-blue hover:bg-k2-blue/10 text-white transition-colors flex-1"
                style={{ fontWeight: 600 }}
              >
                Edit & Resubmit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes & Conflicts Notification */}
      {formData.parsing_notes && formData.parsing_notes.length > 0 && (
        <div className="mb-8 bg-k2-black border border-k2-blue rounded-xl p-6 animate-fade-in">
            <h3 className="text-k2-green font-semibold mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Extraction Notes & Conflicts
            </h3>
            <ul className="list-disc list-inside text-k2-grey space-y-1.5 text-sm font-light" style={{ fontWeight: 300 }}>
                {formData.parsing_notes.map((note, i) => (
                    <li key={i} className="leading-relaxed">{note}</li>
                ))}
            </ul>
        </div>
      )}

      {/* Broker & Insured Info */}
      <Section 
        title="Insured Information" 
        completeness={getSectionCompleteness({
            broker_email: formData.broker_email,
            insured_name: formData.insured_name,
            insured_taxid: formData.insured_taxid,
            year_founded: formData.year_founded,
            naics: formData.naics
        })}
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
      >
        <SmartInput label="Broker Email" type="email" value={formData.broker_email} onChange={(v) => updateField(['broker_email'], v)} isModified={isFieldModified(['broker_email'])} placeholder="agent@brokerage.com" />
        <SmartInput label="Insured Name" type="text" value={formData.insured_name} onChange={(v) => updateField(['insured_name'], v)} isModified={isFieldModified(['insured_name'])} />
        <SmartInput label="Tax ID / FEIN" type="text" value={formData.insured_taxid} onChange={(v) => updateField(['insured_taxid'], v)} isModified={isFieldModified(['insured_taxid'])} />
        <SmartInput label="Year Founded" type="number" value={formData.year_founded} onChange={(v) => updateField(['year_founded'], v)} isModified={isFieldModified(['year_founded'])} />
        <SmartInput label="NAICS Code" type="number" value={formData.naics} onChange={(v) => updateField(['naics'], v)} isModified={isFieldModified(['naics'])} />
      </Section>

      {/* Location & Website */}
      <Section 
        title="Location & Web" 
        completeness={getSectionCompleteness({...formData.insured_location, ...formData.website})}
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
      >
        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <h4 className="text-xs font-semibold text-k2-green uppercase tracking-widest mb-4 border-b border-k2-blue pb-2" style={{ fontWeight: 600 }}>Primary Address</h4>
                <SmartInput label="Address Line 1" type="text" value={formData.insured_location?.address_line1} onChange={(v) => updateField(['insured_location', 'address_line1'], v)} isModified={isFieldModified(['insured_location', 'address_line1'])} />
                <SmartInput label="Address Line 2" type="text" value={formData.insured_location?.address_line2} onChange={(v) => updateField(['insured_location', 'address_line2'], v)} isModified={isFieldModified(['insured_location', 'address_line2'])} required={false} placeholder="Suite, Unit, etc." />
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1"><SmartInput label="City" type="text" value={formData.insured_location?.address_city} onChange={(v) => updateField(['insured_location', 'address_city'], v)} isModified={isFieldModified(['insured_location', 'address_city'])} /></div>
                    <div className="col-span-1"><SmartInput label="State" type="text" value={formData.insured_location?.address_state} onChange={(v) => updateField(['insured_location', 'address_state'], v)} isModified={isFieldModified(['insured_location', 'address_state'])} /></div>
                    <div className="col-span-1"><SmartInput label="Zip" type="text" value={formData.insured_location?.address_zip} onChange={(v) => updateField(['insured_location', 'address_zip'], v)} isModified={isFieldModified(['insured_location', 'address_zip'])} /></div>
                </div>
             </div>
             <div className="space-y-4">
                <h4 className="text-xs font-semibold text-k2-green uppercase tracking-widest mb-4 border-b border-k2-blue pb-2" style={{ fontWeight: 600 }}>Online Presence</h4>
                <SmartInput label="Has Website?" type="boolean" value={formData.website?.has_website} onChange={(v) => updateField(['website', 'has_website'], v)} isModified={isFieldModified(['website', 'has_website'])} />
                <SmartInput label="Domain Name" type="text" value={formData.website?.domainName} onChange={(v) => updateField(['website', 'domainName'], v)} isModified={isFieldModified(['website', 'domainName'])} required={formData.website?.has_website === true} />
             </div>
        </div>
      </Section>

      {/* Financials & Policy Terms */}
      <Section 
        title="Financials & Terms" 
        completeness={getSectionCompleteness({
            revenue: formData.revenue,
            effective_date: formData.effective_date,
            agg_limit: formData.agg_limit,
            retention: formData.retention
        })}
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      >
        <SmartInput label="Revenue" type="number" value={formData.revenue} onChange={(v) => updateField(['revenue'], v)} isModified={isFieldModified(['revenue'])} useCommas={true} />
        <SmartInput label="Effective Date" type="date" value={formData.effective_date} onChange={(v) => updateField(['effective_date'], v)} isModified={isFieldModified(['effective_date'])} />
        {isMissing(formData.agg_limit) ? (
          <SmartSelect
            label="Agg Limit Requested"
            value={formData.agg_limit}
            onChange={(v) => updateField(['agg_limit'], v)}
            options={AGG_LIMIT_OPTIONS.map(val => ({ value: val, label: formatCurrency(val) }))}
            isModified={isFieldModified(['agg_limit'])}
            placeholder="Select aggregate limit..."
          />
        ) : (
          <SmartInput 
            label="Agg Limit Requested" 
            type="number" 
            value={formData.agg_limit} 
            onChange={(v) => {
              const notes: string[] = [];
              const normalized = normalizeAggLimit(v, notes);
              updateField(['agg_limit'], normalized.value);
              // Add notes to parsing_notes if value was adjusted
              if (notes.length > 0) {
                setFormData(prev => ({
                  ...prev,
                  parsing_notes: [...(prev.parsing_notes || []), ...notes]
                }));
              }
            }} 
            isModified={isFieldModified(['agg_limit'])} 
            placeholder="e.g. 1000000" 
            useCommas={true} 
          />
        )}
        {isMissing(formData.retention) ? (
          <SmartSelect
            label="Retention Requested"
            value={formData.retention}
            onChange={(v) => updateField(['retention'], v)}
            options={RETENTION_OPTIONS.map(val => ({ value: val, label: formatCurrency(val) }))}
            isModified={isFieldModified(['retention'])}
            placeholder="Select retention..."
          />
        ) : (
          <SmartInput 
            label="Retention Requested" 
            type="number" 
            value={formData.retention} 
            onChange={(v) => {
              const normalized = normalizeRetention(v);
              updateField(['retention'], normalized);
            }} 
            isModified={isFieldModified(['retention'])} 
            placeholder="e.g. 5000" 
            useCommas={true} 
          />
        )}
      </Section>

      {/* Risk & Contact */}
      <Section 
        title="Risk Profile & Contact" 
        completeness={getSectionCompleteness({...formData.claims, ...formData.insured_contact, question_highrisk: formData.question_highrisk})}
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
      >
        {/* Risk */}
        <div className="space-y-4">
             <h4 className="text-xs font-semibold text-k2-green uppercase tracking-widest mb-4 border-b border-k2-blue pb-2" style={{ fontWeight: 600 }}>Risk Assessment</h4>
             <SmartInput label="High Risk Activities?" type="boolean" value={formData.question_highrisk} onChange={(v) => updateField(['question_highrisk'], v)} isModified={isFieldModified(['question_highrisk'])} />
             <div className="grid grid-cols-2 gap-4">
                <SmartInput label="Claims Count" type="number" value={formData.claims?.claims_count} onChange={(v) => updateField(['claims', 'claims_count'], v)} isModified={isFieldModified(['claims', 'claims_count'])} />
                <SmartInput label="Claims Amount" type="number" value={formData.claims?.claims_amount} onChange={(v) => updateField(['claims', 'claims_amount'], v)} isModified={isFieldModified(['claims', 'claims_amount'])} useCommas={true} />
             </div>
        </div>

        {/* Contact */}
        <div className="col-span-2 space-y-4">
             <h4 className="text-xs font-semibold text-k2-green uppercase tracking-widest mb-4 border-b border-k2-blue pb-2" style={{ fontWeight: 600 }}>Primary Contact</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SmartInput label="First Name" type="text" value={formData.insured_contact?.first_name} onChange={(v) => updateField(['insured_contact', 'first_name'], v)} isModified={isFieldModified(['insured_contact', 'first_name'])} />
                <SmartInput label="Last Name" type="text" value={formData.insured_contact?.last_name} onChange={(v) => updateField(['insured_contact', 'last_name'], v)} isModified={isFieldModified(['insured_contact', 'last_name'])} />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SmartInput label="Email" type="email" value={formData.insured_contact?.email} onChange={(v) => updateField(['insured_contact', 'email'], v)} isModified={isFieldModified(['insured_contact', 'email'])} />
                <div className="grid grid-cols-2 gap-4">
                    <SmartInput label="Phone" type="text" value={formData.insured_contact?.phone} onChange={(v) => updateField(['insured_contact', 'phone'], v)} isModified={isFieldModified(['insured_contact', 'phone'])} required={false} />
                    
                    <div className={`group relative p-4 rounded-lg border transition-all duration-300 ${isMissing(formData.insured_contact?.preferred_method) ? 'bg-k2-black border-k2-grey' : 'bg-k2-black border-k2-blue hover:border-k2-blue'}`}>
                         <label className="text-xs font-semibold text-k2-grey uppercase tracking-wider flex items-center gap-2 mb-2.5" style={{ fontWeight: 600 }}>
                            Method
                            {isMissing(formData.insured_contact?.preferred_method) ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-k2-grey/20 text-k2-grey border border-k2-grey tracking-wide" style={{ fontWeight: 600 }}>
                                MISSING
                                </span>
                            ) : isFieldModified(['insured_contact', 'preferred_method']) ? (
                                <span className="inline-flex items-center text-[10px] font-semibold text-k2-blue tracking-wide" style={{ fontWeight: 600 }}>
                                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                MANUAL
                                </span>
                            ) : (
                                <span className="inline-flex items-center text-[10px] font-semibold text-k2-green tracking-wide" style={{ fontWeight: 600 }}>
                                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                EXTRACTED
                                </span>
                            )}
                         </label>
                         <select 
                            value={formData.insured_contact?.preferred_method || 'Email'} 
                            onChange={(e) => updateField(['insured_contact', 'preferred_method'], e.target.value || 'Email')}
                            className="w-full bg-k2-black text-sm rounded-md px-3 py-2.5 border border-k2-blue text-white font-light outline-none focus:ring-1 focus:ring-k2-blue focus:border-k2-blue"
                            style={{ fontWeight: 300 }}
                         >
                            <option value="Email">Email</option>
                            <option value="Phone">Phone</option>
                         </select>
                    </div>
                </div>
             </div>
        </div>
      </Section>
    </div>
  );
};