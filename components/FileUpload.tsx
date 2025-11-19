import React, { useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  isProcessing: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isProcessing }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (isProcessing) return;
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
        if (files.length > 0) {
          onFileSelect(files);
        } else {
          alert("Please upload PDF files.");
        }
      }
    },
    [onFileSelect, isProcessing]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing) return;
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
      if (files.length > 0) {
        onFileSelect(files);
      }
    }
  };

  return (
    <div
      className={`w-full max-w-2xl mx-auto mt-8 p-12 border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out relative group ${
        isProcessing
          ? 'border-k2-blue bg-k2-black opacity-50 cursor-not-allowed'
          : 'border-k2-blue/30 bg-k2-black hover:border-k2-blue hover:bg-k2-black hover:shadow-xl hover:shadow-k2-blue/5 cursor-pointer'
      }`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Animated Blue Corner Accents */}
      <div className="absolute top-0 left-0 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-k2-blue rounded-tl-lg" />
      </div>
      <div className="absolute top-0 right-0 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-k2-blue rounded-tr-lg" />
      </div>
      <div className="absolute bottom-0 left-0 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-k2-blue rounded-bl-lg" />
      </div>
      <div className="absolute bottom-0 right-0 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-k2-blue rounded-br-lg" />
      </div>

      <div className="flex flex-col items-center justify-center text-center space-y-6">
        <div className={`p-5 rounded-full transition-all duration-300 ${isProcessing ? 'bg-k2-black text-k2-grey' : 'bg-k2-green/10 text-k2-green group-hover:scale-110 group-hover:bg-k2-green/20'}`}>
          {isProcessing ? (
            <svg className="animate-spin w-10 h-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          )}
        </div>
        <div>
            <h3 className="text-xl font-semibold text-white mb-2 font-sans tracking-tight" style={{ fontWeight: 600 }}>Upload Applications</h3>
            <p className="text-k2-grey text-base max-w-sm font-light" style={{ fontWeight: 300 }}>
            Drag and drop your PDF files here
            <br/>or click the button below.
            </p>
        </div>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          id="file-upload"
          onChange={handleChange}
          disabled={isProcessing}
          multiple
        />
        <label
          htmlFor="file-upload"
          className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all tracking-wide shadow-lg ${
            isProcessing
              ? 'bg-k2-black text-k2-grey'
              : 'bg-k2-green text-k2-black hover:bg-k2-green-light hover:shadow-k2-green/20 active:transform active:scale-95'
          }`}
          style={{ fontWeight: 600 }}
        >
          {isProcessing ? 'Analyzing Documents...' : 'Select PDF Files'}
        </label>
      </div>
    </div>
  );
};