import React, { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { QuoteForm } from './components/QuoteForm';
import { parseInsurancePdf } from './services/gemini';
import { parseEmailFile } from './services/emailParser';
import { summarizeEmail, shouldSummarizeEmail } from './services/emailSummarizer';
import { QuoteRequestData, ParsedEmail, EmailMetadata } from './types';

const App: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<QuoteRequestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Inputs
  const [emailBody, setEmailBody] = useState<string>('');
  const [emailFileName, setEmailFileName] = useState<string | null>(null);
  const [parsedEmail, setParsedEmail] = useState<ParsedEmail | null>(null);
  const [emailMetadata, setEmailMetadata] = useState<EmailMetadata | null>(null);
  const [isEmailSummarized, setIsEmailSummarized] = useState(false);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);

  // Debug: Log button state changes
  useEffect(() => {
    console.log('Button state check:', {
      emailBodyLength: emailBody.length,
      pdfFilesCount: pdfFiles.length,
      isProcessing,
      buttonShouldBeEnabled: (pdfFiles.length > 0 || emailBody) && !isProcessing,
      buttonDisabled: isProcessing || (pdfFiles.length === 0 && !emailBody)
    });
  }, [emailBody, pdfFiles.length, isProcessing]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the Data-URL declaration (e.g. "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleEmailSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Simple check for .eml extension or mime type (mime type can vary across browsers/OS)
      if (file.name.toLowerCase().endsWith('.eml') || file.type === 'message/rfc822') {
        setIsProcessing(true);
        setError(null);
        try {
          // Parse the email file
          const parsed = await parseEmailFile(file);
          
          setEmailFileName(file.name);
          setParsedEmail(parsed);
          setEmailMetadata(parsed.metadata);
          console.log('Email metadata set:', parsed.metadata);
          console.log('Broker email from metadata:', parsed.metadata.from);
          
          // Extract PDF attachments from email
          const pdfAttachments = parsed.attachments.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
          setEmailAttachments(pdfAttachments);
          
          // Add email attachments to pdfFiles (but mark them as from email)
          setPdfFiles(prev => {
            const newFiles = pdfAttachments.filter(f => !prev.some(p => p.name === f.name));
            return [...prev, ...newFiles];
          });
          
          // Set clean email body (not raw .eml content)
          console.log('Setting email body, length:', parsed.body.length);
          setEmailBody(parsed.body);
          console.log('✅ Email parsed successfully - emailBody set, button should be enabled');
          
          // Check if email needs summarization
          setIsEmailSummarized(shouldSummarizeEmail(parsed.body));
          
        } catch (err: any) {
          console.error('Error parsing email:', err);
          console.error('Error details:', {
            message: err.message,
            stack: err.stack,
            name: err.name
          });
          
          const errorMessage = err.message || 'Unknown error occurred while parsing email file';
          setError(errorMessage);
          
          // Even if parsing fails, try to read the file as text so user can still analyze
          // This allows the button to be enabled
          try {
            console.log('Attempting fallback email extraction...');
            const fileContent = await file.text();
            console.log('File content length:', fileContent.length);
            
            // Try multiple patterns to extract email body
            let extractedBody = '';
            
            // Pattern 1: Look for Content-Type: text/plain followed by body
            const textMatch = fileContent.match(/Content-Type:\s*text\/plain[^]*?\n\n([^]*?)(?=\n(?:------|Content-Type:|$))/s);
            if (textMatch && textMatch[1]) {
              extractedBody = textMatch[1].trim();
              console.log('Extracted body using text/plain pattern, length:', extractedBody.length);
            }
            
            // Pattern 2: Look for Content-Type: text/html followed by body
            if (!extractedBody) {
              const htmlMatch = fileContent.match(/Content-Type:\s*text\/html[^]*?\n\n([^]*?)(?=\n(?:------|Content-Type:|$))/s);
              if (htmlMatch && htmlMatch[1]) {
                // Strip HTML tags
                extractedBody = htmlMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                console.log('Extracted body using text/html pattern, length:', extractedBody.length);
              }
            }
            
            // Pattern 3: Look for body after first blank line (simple email)
            if (!extractedBody) {
              const simpleMatch = fileContent.match(/\n\n([\s\S]*?)(?=\n------|$)/);
              if (simpleMatch && simpleMatch[1]) {
                extractedBody = simpleMatch[1].trim();
                console.log('Extracted body using simple pattern, length:', extractedBody.length);
              }
            }
            
            // Fallback: Use raw content (limited to avoid context issues)
            if (!extractedBody) {
              // Remove headers and use body
              const headerEnd = fileContent.indexOf('\n\n');
              if (headerEnd > 0) {
                extractedBody = fileContent.substring(headerEnd + 2).substring(0, 50000);
              } else {
                extractedBody = fileContent.substring(0, 50000);
              }
              console.log('Using raw content fallback, length:', extractedBody.length);
            }
            
            if (extractedBody) {
              setEmailBody(extractedBody);
              setEmailFileName(file.name);
              console.log('✅ Fallback successful - emailBody set, button should be enabled');
            } else {
              console.error('❌ Could not extract email body from file');
              setEmailBody('');
            }
          } catch (fallbackErr: any) {
            console.error('Fallback email reading also failed:', fallbackErr);
            setEmailFileName(null);
            setParsedEmail(null);
            setEmailMetadata(null);
            setEmailAttachments([]);
            setEmailBody('');
          }
          setIsEmailSummarized(false);
        } finally {
          setIsProcessing(false);
        }
      } else {
        alert("Please upload a valid .eml file");
      }
    }
  };

  const removeEmail = () => {
    setEmailBody('');
    setEmailFileName(null);
    setParsedEmail(null);
    setEmailMetadata(null);
    setIsEmailSummarized(false);
    // Remove email attachments from pdfFiles
    setPdfFiles(prev => prev.filter(f => !emailAttachments.some(ea => ea.name === f.name)));
    setEmailAttachments([]);
  };

  const handlePdfSelect = (files: File[]) => {
    // Avoid duplicates based on name
    setPdfFiles(prev => {
      const newFiles = files.filter(f => !prev.some(p => p.name === f.name));
      return [...prev, ...newFiles];
    });
    setError(null);
  };

  const removePdf = (fileName: string) => {
    setPdfFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const handleAnalyze = async () => {
    if (pdfFiles.length === 0 && !emailBody) {
      setError("Please upload at least one PDF OR an Email file to analyze.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      // Convert PDFs to base64 in parallel
      const base64Promises = pdfFiles.map(file => convertFileToBase64(file));
      const base64DataArray = await Promise.all(base64Promises);
      
      // Use clean email body (not raw .eml content)
      // If email is too long, it will be summarized in the gemini service
      // Pass email metadata so Gemini can use sender email as broker_email
      const data = await parseInsurancePdf(
        base64DataArray, 
        emailBody, 
        isEmailSummarized,
        emailMetadata ? { from: emailMetadata.from, subject: emailMetadata.subject } : null
      );
      setParsedData(data);
    } catch (err: any) {
      console.error('Error analyzing documents:', err);
      // Error messages are already user-friendly from the services
      const errorMessage = err.message || "Failed to process the documents. Please try again.";
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setParsedData(null);
    setPdfFiles([]);
    setEmailAttachments([]);
    removeEmail();
    setError(null);
  };

  return (
    <div className="min-h-screen bg-k2-black flex flex-col text-white font-light selection:bg-k2-green selection:text-k2-black">
      {/* Header */}
      <header className="bg-k2-black/95 backdrop-blur-md border-b border-k2-blue sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center">
            {/* K2 Cyber Logo */}
            <img src="/K2_Cyber_color.svg" alt="K2 Cyber Logo" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 rounded-full bg-k2-black border border-k2-blue text-xs font-semibold text-k2-green tracking-wide">
              INTELLIGENT INTAKE
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-6 md:p-12 relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-k2-black to-transparent -z-10 opacity-50 pointer-events-none" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-k2-green/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-k2-blue/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        {!parsedData ? (
          <div className="max-w-4xl mx-auto text-center space-y-10 mt-16 animate-fade-in">
            <div className="space-y-6">
               <h2 className="text-5xl md:text-6xl font-semibold tracking-tight text-white" style={{ fontWeight: 600 }}>
                Quote submission <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-k2-green to-k2-teal">accelerated.</span>
              </h2>
              <p className="text-xl font-light text-k2-grey max-w-2xl mx-auto leading-relaxed" style={{ fontWeight: 300 }}>
                Upload PDF applications OR an Email file (.eml).<br/>
                <span className="text-sm text-k2-green/80 font-normal" style={{ fontWeight: 400 }}>You do not need both. Use the one that is available.</span>
              </p>
            </div>
            
            <div className="space-y-8">
              {/* Email Context Input */}
              <div className="w-full max-w-2xl mx-auto text-left space-y-2">
                <label className="text-sm font-semibold text-k2-grey pl-1 flex justify-between" style={{ fontWeight: 600 }}>
                  <span>Option A: Email File (.eml)</span>
                </label>
                
                {!emailFileName ? (
                  <div className="relative group">
                    <label 
                      htmlFor="email-upload" 
                      className="flex items-center justify-center w-full h-24 bg-k2-black border-2 border-dashed border-k2-blue/30 rounded-xl p-4 text-k2-grey cursor-pointer hover:border-k2-blue hover:bg-k2-black hover:text-k2-green transition-all group-hover:shadow-lg group-hover:shadow-k2-blue/5"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-6 h-6 opacity-70 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-light tracking-wide">Upload <span className="font-mono text-xs bg-k2-black border border-k2-blue px-1.5 py-0.5 rounded text-k2-green">.eml</span> file</span>
                      </div>
                      <input 
                        id="email-upload" 
                        type="file" 
                        accept=".eml,message/rfc822" 
                        className="hidden"
                        onChange={handleEmailSelect}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between w-full p-4 bg-k2-black border border-k2-blue rounded-xl">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2.5 bg-k2-green/10 rounded-lg text-k2-green flex-shrink-0">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm text-white font-semibold tracking-wide truncate" style={{ fontWeight: 600 }}>{emailFileName}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] uppercase font-semibold text-k2-green tracking-wider" style={{ fontWeight: 600 }}>Email Attached</span>
                            {isEmailSummarized && (
                              <span className="text-[10px] uppercase font-semibold text-k2-green tracking-wider bg-k2-green/10 px-1.5 py-0.5 rounded">Summarized</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={removeEmail} 
                        className="p-2 text-k2-grey hover:text-red-400 hover:bg-red-400/10 rounded-full transition-all flex-shrink-0"
                        title="Remove email"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Email Metadata */}
                    {emailMetadata && (emailMetadata.subject || emailMetadata.from) && (
                      <div className="px-4 py-2 bg-k2-black border border-k2-blue rounded-lg text-left">
                        {emailMetadata.subject && (
                          <div className="text-xs text-k2-grey mb-1" style={{ fontWeight: 300 }}>
                            <span className="font-semibold" style={{ fontWeight: 600 }}>Subject:</span> <span className="text-white">{emailMetadata.subject}</span>
                          </div>
                        )}
                        {emailMetadata.from && (
                          <div className="text-xs text-k2-grey" style={{ fontWeight: 300 }}>
                            <span className="font-semibold" style={{ fontWeight: 600 }}>From:</span> <span className="text-white">{emailMetadata.fromName || emailMetadata.from}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Extracted Attachments from Email */}
                    {emailAttachments.length > 0 && (
                      <div className="px-4 py-2 bg-k2-black border border-k2-blue rounded-lg">
                        <div className="text-xs font-semibold text-k2-green uppercase tracking-wider mb-2 flex items-center gap-2" style={{ fontWeight: 600 }}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          Extracted from Email ({emailAttachments.length})
                        </div>
                        <ul className="space-y-1">
                          {emailAttachments.map((file, idx) => (
                            <li key={`email-attachment-${idx}`} className="text-xs text-k2-grey flex items-center gap-2" style={{ fontWeight: 300 }}>
                              <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              <span className="text-white">{file.name}</span>
                              <span className="text-k2-grey/60">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center w-full">
                  <span className="text-xs font-semibold text-k2-grey bg-k2-black px-3 py-1 rounded-full border border-k2-blue">OR / AND</span>
              </div>

              {/* PDF Upload */}
              <div className="w-full max-w-2xl mx-auto text-left">
                 <label className="text-sm font-semibold text-k2-grey pl-1 mb-2 block" style={{ fontWeight: 600 }}>Option B: PDF Applications</label>
                 <FileUpload onFileSelect={handlePdfSelect} isProcessing={isProcessing} />
              </div>

              {/* Staged Files List */}
              {pdfFiles.length > 0 && (
                <div className="w-full max-w-2xl mx-auto bg-k2-black rounded-xl border border-k2-blue overflow-hidden animate-fade-in">
                  <div className="px-4 py-2 bg-k2-black border-b border-k2-blue flex justify-between items-center">
                    <span className="text-xs font-semibold text-k2-grey uppercase tracking-widest">Selected PDFs ({pdfFiles.length})</span>
                    <button onClick={() => {
                      setPdfFiles([]);
                      setEmailAttachments([]);
                    }} className="text-xs text-k2-grey hover:text-white transition-colors">Clear All</button>
                  </div>
                  <ul className="divide-y divide-k2-blue/30">
                    {pdfFiles.map((file, idx) => {
                      const isFromEmail = emailAttachments.some(ea => ea.name === file.name);
                      return (
                        <li key={`${file.name}-${idx}`} className="px-4 py-3 flex items-center justify-between hover:bg-k2-blue/10 transition-colors">
                          <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white truncate">{file.name}</span>
                                {isFromEmail && (
                                  <span className="text-[10px] uppercase font-semibold text-k2-green tracking-wider bg-k2-green/10 px-1.5 py-0.5 rounded flex-shrink-0">From Email</span>
                                )}
                              </div>
                              <span className="text-xs text-k2-grey/60">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                            </div>
                          </div>
                          <button onClick={() => removePdf(file.name)} className="text-k2-grey hover:text-red-400 p-1 rounded hover:bg-red-900/20 transition-colors flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
            
            {/* Analyze Button */}
            <div className="flex justify-center pt-4">
               <button
                 onClick={() => {
                   console.log('Analyze button clicked - emailBody length:', emailBody.length, 'pdfFiles:', pdfFiles.length);
                   handleAnalyze();
                 }}
                 disabled={isProcessing || (pdfFiles.length === 0 && !emailBody)}
                 className={`
                    px-10 py-4 rounded-xl font-semibold text-lg tracking-wide shadow-xl transition-all transform
                    ${(pdfFiles.length > 0 || emailBody) && !isProcessing
                      ? 'bg-k2-green text-k2-black hover:bg-k2-green-light hover:scale-105 hover:shadow-k2-green/25'
                      : 'bg-k2-black text-k2-grey cursor-not-allowed opacity-50 border border-k2-blue/50'
                    }
                 `}
                 style={{ fontWeight: 600 }}
               >
                 {isProcessing ? (
                   <span className="flex items-center gap-2">
                     <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     Processing...
                   </span>
                 ) : (
                   'Analyze Documents'
                 )}
               </button>
            </div>

            {error && (
              <div className="max-w-2xl mx-auto p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200 text-sm flex items-start gap-3 animate-fade-in text-left">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 text-left max-w-5xl mx-auto">
              <div className="p-6 rounded-2xl bg-k2-black border border-k2-blue hover:border-k2-blue transition-colors">
                <div className="w-12 h-12 bg-k2-green/10 rounded-xl flex items-center justify-center mb-4">
                   <svg className="w-6 h-6 text-k2-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2" style={{ fontWeight: 600 }}>Smart Extraction</h3>
                <p className="text-sm font-light text-k2-grey" style={{ fontWeight: 300 }}>AI-driven parsing that understands insurance forms regardless of layout or provider.</p>
              </div>
              <div className="p-6 rounded-2xl bg-k2-black border border-k2-blue hover:border-k2-blue transition-colors">
                <div className="w-12 h-12 bg-k2-green/10 rounded-xl flex items-center justify-center mb-4">
                   <svg className="w-6 h-6 text-k2-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2" style={{ fontWeight: 600 }}>Immediate Feedback</h3>
                <p className="text-sm font-light text-k2-grey" style={{ fontWeight: 300 }}>Instantly identify missing critical data points required for binding.</p>
              </div>
              <div className="p-6 rounded-2xl bg-k2-black border border-k2-blue hover:border-k2-blue transition-colors">
                <div className="w-12 h-12 bg-k2-teal/10 rounded-xl flex items-center justify-center mb-4">
                   <svg className="w-6 h-6 text-k2-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2" style={{ fontWeight: 600 }}>API Ready</h3>
                <p className="text-sm font-light text-k2-grey" style={{ fontWeight: 300 }}>Converts unstructured PDFs into structured JSON payloads for your backend.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
             <button 
                onClick={resetForm}
                className="mb-6 flex items-center text-sm text-k2-grey hover:text-k2-green transition-colors"
             >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Upload New Document
             </button>
            <QuoteForm data={parsedData} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;