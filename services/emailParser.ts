import { ParsedEmail, EmailMetadata } from '../types';

// Use dynamic import with proper CommonJS handling
// emailjs-mime-parser exports as: exports.default = parse
let parseFn: any = null;

async function getParser() {
  if (!parseFn) {
    try {
      console.log('Loading emailjs-mime-parser module...');
      const emailParserModule = await import('emailjs-mime-parser');
      console.log('Module loaded:', {
        hasDefault: 'default' in emailParserModule,
        defaultType: typeof emailParserModule.default,
        keys: Object.keys(emailParserModule).slice(0, 5)
      });
      
      // The module structure: { default: parseFunction, ... }
      // In Vite/ESM, CommonJS default exports become .default
      parseFn = emailParserModule.default;
      
      // Verify it's a function
      if (typeof parseFn !== 'function') {
        console.error('Parser module structure:', emailParserModule);
        console.error('Parser type:', typeof parseFn);
        console.error('Available keys:', Object.keys(emailParserModule));
        throw new Error(`Email parser is not a function. Got type: ${typeof parseFn}`);
      }
      
      console.log('✅ Email parser loaded successfully');
    } catch (importError) {
      console.error('❌ Failed to import emailjs-mime-parser:', importError);
      throw importError;
    }
  }
  return parseFn;
}

/**
 * Parses an .eml file and extracts clean email body, attachments, and metadata
 */
export async function parseEmailFile(file: File): Promise<ParsedEmail> {
  try {
    console.log('Starting email parsing for file:', file.name, 'size:', file.size);
    
    // Get the parser function
    const parser = await getParser();
    console.log('Parser function obtained, type:', typeof parser);
    
    // Read file as text
    const fileContent = await file.text();
    console.log('File content read, length:', fileContent.length);
    
    // Parse the email using emailjs-mime-parser
    console.log('Calling parser function...');
    const parsed = parser(fileContent);
    console.log('Parser returned:', {
      hasText: !!parsed.text,
      hasHtml: !!parsed.html,
      hasAttachments: !!parsed.attachments,
      attachmentsCount: parsed.attachments?.length || 0,
      subject: parsed.subject,
      contentType: parsed.contentType,
      hasChildNodes: !!parsed.childNodes,
      childNodesCount: parsed.childNodes?.length || 0,
      allKeys: Object.keys(parsed)
    });
    
    // Debug: Check parsed object structure for headers
    console.log('=== PARSED OBJECT DEBUG ===');
    console.log('parsed.from:', parsed.from);
    console.log('parsed.subject:', parsed.subject);
    console.log('parsed.to:', parsed.to);
    console.log('parsed.date:', parsed.date);
    console.log('parsed.headers exists?', !!parsed.headers);
    if (parsed.headers) {
      console.log('parsed.headers keys:', Object.keys(parsed.headers));
      console.log('parsed.headers["from"]:', parsed.headers['from']);
      console.log('parsed.headers["From"]:', parsed.headers['From']);
      console.log('parsed.headers["FROM"]:', parsed.headers['FROM']);
      // Try to find any case variation
      const headerKeys = Object.keys(parsed.headers);
      const fromKeys = headerKeys.filter(k => k.toLowerCase() === 'from');
      console.log('All "from" header keys (case-insensitive):', fromKeys);
      fromKeys.forEach(key => {
        console.log(`parsed.headers["${key}"]:`, parsed.headers[key]);
      });
    }
    
    // Log first level child nodes for debugging
    if (parsed.childNodes && Array.isArray(parsed.childNodes)) {
      console.log('First level child nodes:', parsed.childNodes.map((child: any, idx: number) => ({
        index: idx,
        contentType: child.contentType || child.headers?.['content-type']?.[0],
        hasText: !!child.text,
        hasHtml: !!child.html,
        hasChildNodes: !!child.childNodes,
        childNodesCount: child.childNodes?.length || 0,
        disposition: child.disposition || child.headers?.['content-disposition']?.[0]
      })));
    }
    
    // Helper to extract email address from parsed address field
    function extractEmailAddress(addressField: any): string | null {
      if (!addressField) return null;
      
      // If it's already a string, extract email from it
      if (typeof addressField === 'string') {
        const emailMatch = addressField.match(/[\w\.-]+@[\w\.-]+\.\w+/);
        if (emailMatch) return emailMatch[0];
        return null;
      }
      
      // Try different structures that emailjs-mime-parser might use
      if (Array.isArray(addressField.value)) {
        // Standard structure: { value: [{ address: "...", name: "..." }] }
        const firstAddress = addressField.value[0];
        if (firstAddress?.address) {
          return firstAddress.address;
        }
      } else if (typeof addressField.value === 'string') {
        // Simple string format
        const emailMatch = addressField.value.match(/[\w\.-]+@[\w\.-]+\.\w+/);
        if (emailMatch) return emailMatch[0];
      } else if (addressField.address) {
        // Direct address property
        return addressField.address;
      }
      
      return null;
    }
    
    // Extract broker/agent email - try multiple sources
    let brokerEmail: string | null = null;
    
    console.log('=== Starting broker email extraction ===');
    console.log('parsed.from structure:', JSON.stringify(parsed.from, null, 2));
    
    // 1. Try "From" header (most reliable for sender)
    brokerEmail = extractEmailAddress(parsed.from);
    console.log('After extractEmailAddress(parsed.from):', brokerEmail);
    
    // 2. Try "Return-Path" header (often more reliable for actual sender)
    if (!brokerEmail && parsed.headers?.['return-path']) {
      const returnPathHeader = parsed.headers['return-path'][0];
      let returnPath: string | null = null;
      
      if (returnPathHeader) {
        if (typeof returnPathHeader === 'string') {
          returnPath = returnPathHeader;
        } else if (returnPathHeader.value && typeof returnPathHeader.value === 'string') {
          returnPath = returnPathHeader.value;
        }
      }
      
      if (returnPath && typeof returnPath === 'string') {
        const emailMatch = returnPath.match(/[\w\.-]+@[\w\.-]+\.\w+/);
        if (emailMatch) brokerEmail = emailMatch[0];
      }
    }
    
    // 3. Try "Reply-To" header
    if (!brokerEmail && parsed.headers?.['reply-to']) {
      const replyToHeader = parsed.headers['reply-to'][0];
      if (replyToHeader) {
        brokerEmail = extractEmailAddress(replyToHeader);
      }
    }
    
    // 4. Try "Sender" header
    if (!brokerEmail && parsed.headers?.['sender']) {
      const senderHeader = parsed.headers['sender'][0];
      if (senderHeader) {
        brokerEmail = extractEmailAddress(senderHeader);
      }
    }
    
    // 5. Try parsing from raw headers if still not found
    if (!brokerEmail && parsed.headers) {
      // Check all header keys for email patterns
      for (const [key, values] of Object.entries(parsed.headers)) {
        if (['from', 'return-path', 'reply-to', 'sender'].includes(key.toLowerCase())) {
          const headerValue = Array.isArray(values) ? values[0] : values;
          const valueStr = headerValue?.value || headerValue;
          if (typeof valueStr === 'string') {
            const emailMatch = valueStr.match(/[\w\.-]+@[\w\.-]+\.\w+/);
            if (emailMatch) {
              brokerEmail = emailMatch[0];
              console.log(`Found broker email from ${key} header: ${brokerEmail}`);
              break;
            }
          }
        }
      }
    }
    
    // Extract from name
    let fromName: string | null = null;
    if (parsed.from?.value?.[0]?.name) {
      fromName = parsed.from.value[0].name;
    } else if (parsed.from?.value && typeof parsed.from.value === 'string') {
      // Try to extract name from "Name <email@domain.com>" format
      const nameMatch = parsed.from.value.match(/^([^<]+)<[\w\.-]+@[\w\.-]+\.\w+>/);
      if (nameMatch) fromName = nameMatch[1].trim().replace(/["']/g, '');
    }
    
    // Extract metadata
    console.log('=== Extracting metadata ===');
    console.log('parsed.subject:', parsed.subject, typeof parsed.subject);
    console.log('parsed.to:', parsed.to);
    console.log('parsed.date:', parsed.date, typeof parsed.date);
    
    const metadata: EmailMetadata = {
      subject: parsed.subject || null,
      from: brokerEmail,
      fromName: fromName,
      to: parsed.to?.value?.map((v: any) => v.address || v).join(', ') || null,
      date: parsed.date ? new Date(parsed.date).toISOString() : null,
    };
    
    console.log('Extracted metadata:', {
      subject: metadata.subject,
      from: metadata.from,
      fromName: metadata.fromName,
      to: metadata.to,
      date: metadata.date
    });
    
    // If broker email is still null, try parsing from raw email content as fallback
    if (!brokerEmail) {
      console.log('Broker email still null, trying to parse from raw email content...');
      // Try to extract From header directly from raw email content
      const fromMatch = fileContent.match(/^From:\s*(.+)$/im);
      if (fromMatch) {
        const fromLine = fromMatch[1];
        console.log('Found From line in raw content:', fromLine);
        const emailMatch = fromLine.match(/[\w\.-]+@[\w\.-]+\.\w+/);
        if (emailMatch) {
          brokerEmail = emailMatch[0];
          console.log('✅ Extracted broker email from raw email content:', brokerEmail);
          metadata.from = brokerEmail;
        }
      }
      
      // Also try Return-Path
      if (!brokerEmail) {
        const returnPathMatch = fileContent.match(/^Return-Path:\s*<(.+)>$/im);
        if (returnPathMatch) {
          brokerEmail = returnPathMatch[1];
          console.log('✅ Extracted broker email from Return-Path in raw content:', brokerEmail);
          metadata.from = brokerEmail;
        }
      }
    }
    
    // If subject is still null, try parsing from raw content
    if (!metadata.subject) {
      const subjectMatch = fileContent.match(/^Subject:\s*(.+)$/im);
      if (subjectMatch) {
        metadata.subject = subjectMatch[1].trim();
        console.log('✅ Extracted subject from raw email content:', metadata.subject);
      }
    }
    
    // Helper to convert Uint8Array content to string
    function contentToString(node: any): string {
      if (!node) return '';
      
      // If content is a Uint8Array, convert to string
      if (node.content instanceof Uint8Array) {
        try {
          // Try UTF-8 first
          return new TextDecoder('utf-8').decode(node.content);
        } catch (e) {
          // Fallback to simple conversion
          return String.fromCharCode.apply(null, Array.from(node.content));
        }
      }
      
      // If content is already a string
      if (typeof node.content === 'string') {
        return node.content;
      }
      
      // Check for text/html properties (some parsers expose these)
      if (node.text) return node.text;
      if (node.html) return node.html;
      
      return '';
    }
    
    // Recursive function to extract text/html from nested MimeNode structure
    function extractBodyFromNode(node: any, preferText: boolean = true): string {
      if (!node) return '';
      
      const contentType = node.contentType?.value || 
                         node.contentType ||
                         node.headers?.['content-type']?.[0]?.value ||
                         node.headers?.['content-type']?.[0] ||
                         '';
      
      // Check if this node has text/html content
      const isTextPlain = contentType.includes('text/plain');
      const isTextHtml = contentType.includes('text/html');
      
      // Skip attachments and non-text content
      const disposition = node.disposition || 
                         node.headers?.['content-disposition']?.[0]?.value ||
                         node.headers?.['content-disposition']?.[0] ||
                         '';
      
      if (disposition.includes('attachment') && !isTextPlain && !isTextHtml) {
        return '';
      }
      
      // If this is a text node, extract its content
      if (isTextPlain || isTextHtml) {
        const content = contentToString(node);
        if (content) {
          if (isTextHtml) {
            // Strip HTML tags for cleaner text
            return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          }
          return content;
        }
      }
      
      // Check childNodes recursively
      if (node.childNodes && Array.isArray(node.childNodes)) {
        // First pass: look for text/plain
        if (preferText) {
          for (const child of node.childNodes) {
            const childContentType = child.contentType?.value || 
                                    child.contentType ||
                                    child.headers?.['content-type']?.[0]?.value ||
                                    child.headers?.['content-type']?.[0] ||
                                    '';
            
            if (childContentType.includes('text/plain')) {
              const text = extractBodyFromNode(child, true);
              if (text) return text;
            }
          }
        }
        
        // Second pass: look for text/html
        for (const child of node.childNodes) {
          const childContentType = child.contentType?.value || 
                                  child.contentType ||
                                  child.headers?.['content-type']?.[0]?.value ||
                                  child.headers?.['content-type']?.[0] ||
                                  '';
          
          if (childContentType.includes('text/html')) {
            const html = extractBodyFromNode(child, false);
            if (html) return html;
          }
        }
        
        // Last resort: try any child node that's not an attachment
        for (const child of node.childNodes) {
          const childDisposition = child.disposition || 
                                  child.headers?.['content-disposition']?.[0]?.value ||
                                  child.headers?.['content-disposition']?.[0] ||
                                  '';
          
          if (!childDisposition.includes('attachment')) {
            const text = extractBodyFromNode(child, preferText);
            if (text) return text;
          }
        }
      }
      
      return '';
    }
    
    // Extract clean email body
    let emailBody = '';
    
    // Try to get text body first, then HTML
    if (parsed.text) {
      emailBody = parsed.text;
      console.log('Using parsed.text, length:', emailBody.length);
    } else if (parsed.html) {
      // Strip HTML tags for cleaner text (basic approach)
      emailBody = parsed.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log('Using parsed.html (stripped), length:', emailBody.length);
    } else {
      console.log('No direct text/html, checking nested structure...');
      console.log('Parsed structure:', {
        keys: Object.keys(parsed),
        contentType: parsed.contentType,
        hasChildNodes: !!parsed.childNodes,
        childNodesCount: parsed.childNodes?.length || 0
      });
      
      // Use recursive extraction
      emailBody = extractBodyFromNode(parsed, true);
      if (emailBody) {
        console.log('Extracted body from nested structure, length:', emailBody.length);
      }
    }
    
    console.log('Final email body length:', emailBody.length);
    
    // Helper to extract filename from content-disposition header
    function extractFilename(node: any): string {
      const disposition = node.disposition || 
                         node.headers?.['content-disposition']?.[0]?.value ||
                         node.headers?.['content-disposition']?.[0] ||
                         '';
      
      // Try to extract filename from disposition
      const filenameMatch = disposition.match(/filename[^=]*=\s*(?:UTF-8'')?["']?([^"'\s;]+)["']?/i);
      if (filenameMatch && filenameMatch[1]) {
        // Decode URL-encoded filename
        try {
          return decodeURIComponent(filenameMatch[1]);
        } catch {
          return filenameMatch[1];
        }
      }
      
      return node.filename || node.name || 'attachment.pdf';
    }
    
    // Recursive function to extract attachments from nested structure
    function extractAttachmentsFromNode(node: any, attachments: any[] = []): any[] {
      if (!node) return attachments;
      
      // Check if this node is an attachment
      const contentType = node.contentType?.value || 
                         node.contentType ||
                         node.headers?.['content-type']?.[0]?.value ||
                         node.headers?.['content-type']?.[0] ||
                         '';
      const disposition = node.disposition || 
                         node.headers?.['content-disposition']?.[0]?.value ||
                         node.headers?.['content-disposition']?.[0] ||
                         '';
      const filename = extractFilename(node);
      
      // If it's an attachment or has attachment disposition
      const isAttachment = disposition.toLowerCase().includes('attachment') ||
                          (contentType.includes('application/pdf') && filename.toLowerCase().endsWith('.pdf')) ||
                          (contentType.includes('application/octet-stream') && filename.toLowerCase().endsWith('.pdf'));
      
      if (isAttachment && node.content) {
        attachments.push({
          ...node,
          filename,
          contentType,
          disposition
        });
      }
      
      // Recursively check child nodes
      if (node.childNodes && Array.isArray(node.childNodes)) {
        for (const child of node.childNodes) {
          extractAttachmentsFromNode(child, attachments);
        }
      }
      
      return attachments;
    }
    
    // Extract PDF attachments
    const pdfAttachments: File[] = [];
    
    // First try the direct attachments array
    let allAttachments: any[] = [];
    if (parsed.attachments && Array.isArray(parsed.attachments)) {
      allAttachments = [...parsed.attachments];
    }
    
    // Also extract from nested structure
    const nestedAttachments = extractAttachmentsFromNode(parsed);
    allAttachments = [...allAttachments, ...nestedAttachments];
    
    console.log('Found attachments:', allAttachments.length);
    
    for (const attachment of allAttachments) {
      // Check if it's a PDF
      const contentType = attachment.contentType?.value || 
                         attachment.contentType ||
                         attachment.headers?.['content-type']?.[0]?.value ||
                         attachment.headers?.['content-type']?.[0] ||
                         '';
      const filename = extractFilename(attachment);
      
      console.log('Checking attachment:', { 
        contentType, 
        filename,
        hasContent: !!attachment.content,
        contentTypeType: typeof attachment.content,
        isUint8Array: attachment.content instanceof Uint8Array,
        keys: Object.keys(attachment).slice(0, 10)
      });
      
      if (contentType.includes('application/pdf') || filename.toLowerCase().endsWith('.pdf')) {
        try {
          // emailjs-mime-parser stores content as Uint8Array
          let attachmentData = attachment.content;
          
          if (attachmentData) {
            let bytes: Uint8Array;
            
            if (attachmentData instanceof Uint8Array) {
              bytes = attachmentData;
              console.log(`✅ Using Uint8Array content for ${filename}, size: ${bytes.length} bytes`);
            } else if (attachmentData instanceof ArrayBuffer) {
              bytes = new Uint8Array(attachmentData);
            } else if (typeof attachmentData === 'string') {
              // Base64 string - decode it
              try {
                const cleanBase64 = attachmentData.replace(/\s/g, '');
                const binaryString = atob(cleanBase64);
                bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                console.log(`✅ Decoded base64 attachment ${filename}, size: ${bytes.length} bytes`);
              } catch (e) {
                console.warn('Failed to decode base64 attachment data:', e);
                continue;
              }
            } else {
              console.warn('Unknown attachment data type, skipping:', typeof attachmentData);
              continue;
            }
            
            // Create File object from attachment
            const pdfFile = new File([bytes], filename, { type: 'application/pdf' });
            pdfAttachments.push(pdfFile);
            console.log(`✅ Added PDF attachment: ${filename} (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
          } else {
            console.warn(`No content found for attachment ${filename}`);
          }
        } catch (err) {
          console.warn(`Failed to extract attachment ${filename}:`, err);
          // Continue with other attachments
        }
      }
    }
    
    console.log(`Total PDF attachments extracted: ${pdfAttachments.length}`);
    
    return {
      body: emailBody,
      attachments: pdfAttachments,
      metadata,
      originalFile: file,
    };
  } catch (error) {
    console.error('Error parsing email file:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Invalid') || error.message.includes('parse')) {
        throw new Error('Invalid email file format. Please ensure the file is a valid .eml file.');
      }
      if (error.message.includes('encoding') || error.message.includes('charset')) {
        throw new Error('Email file encoding error. Please try a different email file.');
      }
      throw new Error(`Failed to parse email file: ${error.message}`);
    }
    
    throw new Error('Failed to parse email file: Unknown error occurred');
  }
}

