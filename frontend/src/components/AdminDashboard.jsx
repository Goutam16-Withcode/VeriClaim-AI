import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, XCircle, AlertTriangle, Eye, ArrowLeft, RefreshCw, 
  Search, Filter, Calendar, FileText, CheckCircle2, ChevronRight, MessageSquare,
  Loader2, Sparkles
} from 'lucide-react';

const renderMarkdown = (text) => {
  if (!text) return <p className="text-slate-500 italic">No audit report compiled.</p>;
  
  const lines = text.split('\n');
  const renderedElements = [];
  let inList = false;
  let listItems = [];
  
  const parseInlineStyles = (lineText) => {
    const parts = [];
    let lastIndex = 0;
    const regex = /\*\*(.*?)\*\*/g;
    let match;
    
    while ((match = regex.exec(lineText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(lineText.substring(lastIndex, match.index));
      }
      parts.push(
        <strong key={match.index} className="font-bold text-slate-100 bg-slate-800/30 px-1.5 py-0.5 rounded border border-slate-800/50">
          {match[1]}
        </strong>
      );
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < lineText.length) {
      parts.push(lineText.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : lineText;
  };
  
  const flushList = (key) => {
    if (listItems.length > 0) {
      renderedElements.push(
        <ul key={`list-${key}`} className="list-disc pl-5 my-4 space-y-2 text-slate-300">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.startsWith('### ')) {
      flushList(i);
      renderedElements.push(
        <h4 key={i} className="text-xs font-bold text-bupa-400 uppercase tracking-widest mt-6 mb-2">
          {parseInlineStyles(trimmed.substring(4))}
        </h4>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList(i);
      renderedElements.push(
        <h3 key={i} className="text-sm font-bold text-white mt-8 mb-3 border-b border-slate-800/80 pb-2 flex items-center space-x-2">
          <span className="h-1.5 w-1.5 bg-bupa-500 rounded-full inline-block"></span>
          <span>{parseInlineStyles(trimmed.substring(3))}</span>
        </h3>
      );
    } else if (trimmed.startsWith('# ')) {
      flushList(i);
      renderedElements.push(
        <h2 key={i} className="text-base font-extrabold text-white mt-10 mb-4 pb-2 border-b-2 border-bupa-500/30 tracking-tight">
          {parseInlineStyles(trimmed.substring(2))}
        </h2>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true;
      listItems.push(
        <li key={i} className="text-slate-300 text-xs leading-relaxed">
          {parseInlineStyles(trimmed.substring(2))}
        </li>
      );
    } else if (trimmed === '') {
      flushList(i);
    } else {
      flushList(i);
      renderedElements.push(
        <p key={i} className="text-xs text-slate-300 leading-relaxed mb-3.5">
          {parseInlineStyles(trimmed)}
        </p>
      );
    }
  }
  
  flushList(lines.length);
  return renderedElements;
};

function AdminDashboard() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClaim, setSelectedClaim] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Admin decision form
  const [decisionNotes, setDecisionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/claims');
      if (!response.ok) {
        throw new Error('Failed to load claims database');
      }
      const data = await response.json();
      setClaims(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const handleAdminAction = async (claimId, action) => {
    setSubmittingAction(true);
    try {
      const response = await fetch(`/api/claims/${claimId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: action, // 'APPROVED' or 'REJECTED'
          notes: decisionNotes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update claim status');
      }

      const updatedClaim = await response.json();
      
      // Update locally
      setClaims(prev => prev.map(c => c.id === claimId ? updatedClaim : c));
      setSelectedClaim(updatedClaim);
      setDecisionNotes('');
      
      // Trigger a clean refetch
      fetchClaims();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Calculations for Metrics Cards
  const totalClaims = claims.length;
  const approvedClaims = claims.filter(c => c.status === 'APPROVED').length;
  const rejectedClaims = claims.filter(c => c.status === 'REJECTED').length;
  const flaggedClaims = claims.filter(c => c.status === 'FLAGGED').length;

  // Filter logic
  const filteredClaims = claims.filter(c => {
    const matchesSearch = 
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.formDetails.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.formDetails.facility.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.extractedDetails.disease && c.extractedDetails.disease.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in text-slate-100">
      {selectedClaim ? (
        // Detailed Claim Inspector View
        <div className="space-y-6">
          <button 
            onClick={() => { setSelectedClaim(null); setDecisionNotes(''); }}
            className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition-all bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-xl border border-slate-800"
          >
            <ArrowLeft size={16} />
            <span>Back to Queue</span>
          </button>

          {/* Banner Status bar */}
          <div className={`p-6 rounded-3xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
            selectedClaim.status === 'APPROVED' 
              ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-100' 
              : selectedClaim.status === 'REJECTED' 
              ? 'bg-rose-950/30 border-rose-800/50 text-rose-100' 
              : 'bg-amber-950/30 border-amber-800/50 text-amber-100'
          }`}>
            <div>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span>Submitted on {selectedClaim.dateSubmitted}</span>
                <span>•</span>
                <span>Claim ID: #{selectedClaim.id}</span>
              </div>
              <h2 className="text-2xl font-bold mt-1">Claim {selectedClaim.status === 'APPROVED' ? 'Approved' : selectedClaim.status === 'REJECTED' ? 'Rejected' : 'Pending Manual Adjustment'}</h2>
              <p className="text-xs mt-1 text-slate-400">{selectedClaim.decisionReason}</p>
            </div>
            
            {/* Status Pills */}
            <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${
              selectedClaim.status === 'APPROVED' 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : selectedClaim.status === 'REJECTED' 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {selectedClaim.status}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Auditing and Data Alignment */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Form vs Extract Verification */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Data Ingestion Verification</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Name check block */}
                  <div className={`p-4 rounded-2xl border ${selectedClaim.flags.includes("PATIENT_NAME_DISCREPANCY") ? 'bg-rose-950/20 border-rose-900/40' : 'bg-slate-950/40 border-slate-800/80'}`}>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Patient Name</span>
                      {selectedClaim.flags.includes("PATIENT_NAME_DISCREPANCY") 
                        ? <XCircle size={14} className="text-rose-400" />
                        : <CheckCircle2 size={14} className="text-emerald-400" />
                      }
                    </div>
                    <div className="mt-3">
                      <span className="text-xs text-slate-500 block">Form Input:</span>
                      <span className="text-xs font-semibold text-slate-300 block truncate">{selectedClaim.formDetails.name}</span>
                      <span className="text-xs text-slate-500 block mt-2">Invoice OCR:</span>
                      <span className="text-xs font-semibold text-slate-300 block truncate">{selectedClaim.extractedDetails.name || 'Not Found'}</span>
                    </div>
                  </div>

                  {/* Date check block */}
                  <div className={`p-4 rounded-2xl border ${selectedClaim.flags.includes("TREATMENT_DATE_MISMATCH") ? 'bg-rose-950/20 border-rose-900/40' : 'bg-slate-950/40 border-slate-800/80'}`}>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Treatment Date</span>
                      {selectedClaim.flags.includes("TREATMENT_DATE_MISMATCH") 
                        ? <XCircle size={14} className="text-rose-400" />
                        : <CheckCircle2 size={14} className="text-emerald-400" />
                      }
                    </div>
                    <div className="mt-3">
                      <span className="text-xs text-slate-500 block">Form Input:</span>
                      <span className="text-xs font-semibold text-slate-300 block">{selectedClaim.formDetails.date}</span>
                      <span className="text-xs text-slate-500 block mt-2">Invoice OCR:</span>
                      <span className="text-xs font-semibold text-slate-300 block">{selectedClaim.extractedDetails.date || 'Not Found'}</span>
                    </div>
                  </div>

                  {/* Math check block */}
                  <div className={`p-4 rounded-2xl border ${selectedClaim.flags.includes("CLAIM_EXCEEDS_INVOICE_TOTAL") ? 'bg-rose-950/20 border-rose-900/40' : 'bg-slate-950/40 border-slate-800/80'}`}>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Claim Amount Sum</span>
                      {selectedClaim.flags.includes("CLAIM_EXCEEDS_INVOICE_TOTAL") 
                        ? <AlertTriangle size={14} className="text-amber-400" />
                        : <CheckCircle2 size={14} className="text-emerald-400" />
                      }
                    </div>
                    <div className="mt-3">
                      <span className="text-xs text-slate-500 block">Claim Request:</span>
                      <span className="text-xs font-semibold text-slate-300 block">${selectedClaim.formDetails.amount.toFixed(2)}</span>
                      <span className="text-xs text-slate-500 block mt-2">Extracted Total:</span>
                      <span className="text-xs font-semibold text-slate-300 block">${(selectedClaim.extractedDetails.total || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized bill details */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Itemized Medical Bill Summary</h3>
                    <p className="text-xs text-slate-400 mt-1">Diagnosis: {selectedClaim.extractedDetails.disease || 'N/A'}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg">
                    ICD-10 Code: {selectedClaim.extractedDetails.icd10 || 'N/A'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-xs">
                        <th className="pb-3">Billed Medical Line-Item</th>
                        <th className="pb-3 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {selectedClaim.extractedDetails.itemizedBill && selectedClaim.extractedDetails.itemizedBill.map((item, idx) => (
                        <tr key={idx} className="text-slate-300">
                          <td className="py-3.5">{item.item}</td>
                          <td className="py-3.5 text-right font-mono font-semibold">${parseFloat(item.cost).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold text-white border-t border-slate-800">
                        <td className="pt-4 pb-1">Line-Item Sum</td>
                        <td className="pt-4 pb-1 text-right font-mono">${(selectedClaim.extractedDetails.calculatedBillSum || 0).toFixed(2)}</td>
                      </tr>
                      <tr className="text-slate-400">
                        <td className="py-1">Bill Declared Total</td>
                        <td className="py-1 text-right font-mono">${(selectedClaim.extractedDetails.total || 0).toFixed(2)}</td>
                      </tr>
                      <tr className="text-bupa-400 font-semibold">
                        <td className="py-1">Payout Request Total</td>
                        <td className="py-1 text-right font-mono">${selectedClaim.formDetails.amount.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Side Column: Documents + Override decision */}
            <div className="space-y-8">
              
              {/* Risk metrics card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Fraud Risk Audit</h3>
                <div className="text-center p-6 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block font-medium">Anomaly Risk Classification</span>
                  <span className={`text-4xl font-extrabold block mt-2 ${
                    selectedClaim.fraudRisk === 'LOW' 
                      ? 'text-emerald-400' 
                      : selectedClaim.fraudRisk === 'MEDIUM' 
                      ? 'text-amber-400' 
                      : 'text-rose-500'
                  }`}>
                    {selectedClaim.fraudRisk}
                  </span>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full mt-4 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        selectedClaim.fraudRisk === 'LOW' 
                          ? 'bg-emerald-400 w-1/5' 
                          : selectedClaim.fraudRisk === 'MEDIUM' 
                          ? 'bg-amber-400 w-3/5' 
                          : 'bg-rose-500 w-full'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-slate-500 mt-2 block font-mono">{selectedClaim.riskPoints} Anomaly Score Points</span>
                </div>
                
                {selectedClaim.flags && selectedClaim.flags.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Verification Failures Raised:</span>
                    {selectedClaim.flags.map((flag, idx) => (
                      <div key={idx} className="flex items-center space-x-2 px-3 py-2 bg-rose-950/20 border border-rose-900/30 rounded-xl text-rose-400 text-xs">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span className="font-mono">{flag}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Uploaded Documents */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Verification Artifacts</h3>
                <div className="space-y-3">
                  <a 
                    href={selectedClaim.receiptUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-950/80 rounded-2xl border border-slate-800/80 group transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-bupa-500/10 text-bupa-400 rounded-xl">
                        <FileText size={18} />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-white block group-hover:text-bupa-300">Consultation Invoice</span>
                        <span className="text-xs text-slate-500 block">Open receipt PDF/Image</span>
                      </div>
                    </div>
                  </a>

                  {selectedClaim.prescriptionUrl ? (
                    <a 
                      href={selectedClaim.prescriptionUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-950/80 rounded-2xl border border-slate-800/80 group transition-all"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                          <FileText size={18} />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-white block group-hover:text-purple-300">Doctor Prescription</span>
                          <span className="text-xs text-slate-500 block">Open prescription file</span>
                        </div>
                      </div>
                    </a>
                  ) : (
                    <div className="p-4 bg-slate-950/30 border border-dashed border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                      No prescription document was provided.
                    </div>
                  )}
                </div>
              </div>

              {/* Adjuster override options */}
              {selectedClaim.status === 'FLAGGED' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                    <MessageSquare size={18} className="text-bupa-400" />
                    <span>Claims Adjuster Action</span>
                  </h3>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Decision Notes</label>
                    <textarea 
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      placeholder="Add justifications or manual audit findings for overriding this claim..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-bupa-500 rounded-xl px-3.5 py-3 text-xs text-slate-100 placeholder:text-slate-600 outline-none transition-all resize-none"
                      rows="4"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleAdminAction(selectedClaim.id, 'APPROVED')}
                      disabled={submittingAction}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl py-3 font-semibold text-xs transition-all shadow-md"
                    >
                      Approve Claim
                    </button>
                    <button
                      onClick={() => handleAdminAction(selectedClaim.id, 'REJECTED')}
                      disabled={submittingAction}
                      className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl py-3 font-semibold text-xs transition-all shadow-md"
                    >
                      Reject Claim
                    </button>
                  </div>
                </div>
              )}

              {/* Admin comments on processed claims */}
              {selectedClaim.adminNotes && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Claims Adjuster Notes</h4>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans">
                    {selectedClaim.adminNotes}
                  </div>
                </div>
              )}
            </div>

            {/* AI findings - Full Width Row */}
            <div className="lg:col-span-3 animate-fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 bg-bupa-500/5 rounded-full filter blur-3xl pointer-events-none"></div>
                <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-bupa-500/10 text-bupa-400 rounded-xl">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight">AI Audit Findings & Analysis</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Automated policy checks & medical necessity validation</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 bg-bupa-500/15 border border-bupa-500/30 text-bupa-400 text-[10px] font-bold uppercase rounded-full tracking-wider">
                    Gemini 2.5 Flash
                  </span>
                </div>
                <div className="text-slate-300 font-sans leading-relaxed">
                  {renderMarkdown(selectedClaim.openaiReport)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Main Dashboard List Queue View
        <div className="space-y-8">
          
          {/* Header metrics row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            
            {/* Metric 1: Total */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 h-10 w-10 bg-bupa-500/5 rounded-full filter blur-xl"></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Claims</span>
              <span className="text-3xl font-extrabold text-white block mt-2 font-mono">{totalClaims}</span>
              <span className="text-[10px] text-slate-500 block mt-1.5">Submitted claims queue</span>
            </div>

            {/* Metric 2: Flagged */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden">
              <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider block">Needs Action</span>
              <span className="text-3xl font-extrabold text-amber-400 block mt-2 font-mono">{flaggedClaims}</span>
              <span className="text-[10px] text-slate-500 block mt-1.5">Awaiting adjuster review</span>
            </div>

            {/* Metric 3: Approved */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden">
              <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-wider block">Approved Claims</span>
              <span className="text-3xl font-extrabold text-emerald-400 block mt-2 font-mono">{approvedClaims}</span>
              <span className="text-[10px] text-slate-500 block mt-1.5">Processed successfully</span>
            </div>

            {/* Metric 4: Rejected */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden">
              <span className="text-[10px] font-bold text-rose-500/80 uppercase tracking-wider block">Rejected Claims</span>
              <span className="text-3xl font-extrabold text-rose-500 block mt-2 font-mono">{rejectedClaims}</span>
              <span className="text-[10px] text-slate-500 block mt-1.5">Denied eligibility rules</span>
            </div>
          </div>

          {/* Search, Filter and Actions Toolbar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900 p-4 border border-slate-800 rounded-3xl">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              
              {/* Search input */}
              <div className="relative flex-grow sm:flex-grow-0">
                <Search className="absolute left-3.5 top-3.5 text-slate-500" size={16} />
                <input 
                  type="text"
                  placeholder="Search name, disease, clinic..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-950 border border-slate-800 focus:border-bupa-500 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-100 placeholder:text-slate-600 outline-none w-full sm:w-64 transition-all"
                />
              </div>

              {/* Status Select Filter */}
              <div className="relative">
                <Filter className="absolute left-3.5 top-3.5 text-slate-500" size={14} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 focus:border-bupa-500 rounded-2xl pl-9 pr-6 py-3 text-xs text-slate-400 focus:text-slate-100 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="FLAGGED">Pending Manual Review</option>
                  <option value="REJECTED">Rejected Only</option>
                </select>
              </div>
            </div>

            {/* Refresh database button */}
            <button 
              onClick={fetchClaims}
              className="flex items-center space-x-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-xs px-4 py-3 rounded-2xl text-slate-400 hover:text-white transition-all w-full md:w-auto justify-center"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Queue</span>
            </button>
          </div>

          {/* Main Claims queue table list */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="py-20 text-center text-slate-500">
                <Loader2 size={36} className="animate-spin mx-auto mb-4 text-bupa-500" />
                <span className="text-sm">Fetching claims queue...</span>
              </div>
            ) : error ? (
              <div className="py-20 text-center text-rose-400">
                <XCircle size={36} className="mx-auto mb-4" />
                <span className="text-sm">Error loading data: {error}</span>
              </div>
            ) : filteredClaims.length === 0 ? (
              <div className="py-20 text-center text-slate-500">
                <FileText size={36} className="mx-auto mb-4 text-slate-600" />
                <span className="text-sm">No claims match the search or filter criteria.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-4 px-6">Claim ID</th>
                      <th className="py-4 px-4">Patient Name</th>
                      <th className="py-4 px-4">Treatment Date</th>
                      <th className="py-4 px-4">Facility / Diagnosis</th>
                      <th className="py-4 px-4 text-right">Requested</th>
                      <th className="py-4 px-4 text-center">Threat Level</th>
                      <th className="py-4 px-4 text-center">Status</th>
                      <th className="py-4 px-6 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredClaims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-slate-800/20 text-slate-300 transition-all">
                        {/* ID */}
                        <td className="py-4 px-6 font-mono text-xs font-bold text-slate-400">
                          #{claim.id}
                        </td>
                        
                        {/* Patient Name */}
                        <td className="py-4 px-4 font-medium text-white">
                          {claim.formDetails.name}
                        </td>
                        
                        {/* Date */}
                        <td className="py-4 px-4 text-xs font-mono">
                          {claim.formDetails.date}
                        </td>
                        
                        {/* Facility / Diagnosis */}
                        <td className="py-4 px-4">
                          <span className="text-xs font-semibold text-slate-300 block">{claim.formDetails.facility}</span>
                          <span className="text-[10px] text-slate-500 block truncate max-w-[180px]">
                            {claim.extractedDetails.disease || claim.formDetails.reason}
                          </span>
                        </td>
                        
                        {/* Amount */}
                        <td className="py-4 px-4 text-right font-semibold font-mono text-white">
                          ${claim.formDetails.amount.toFixed(2)}
                        </td>
                        
                        {/* Risk Threat */}
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${
                            claim.fraudRisk === 'LOW' 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : claim.fraudRisk === 'MEDIUM' 
                              ? 'bg-amber-500/10 text-amber-400' 
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {claim.fraudRisk}
                          </span>
                        </td>
                        
                        {/* Status badge */}
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold ${
                            claim.status === 'APPROVED' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : claim.status === 'REJECTED' 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                          }`}>
                            {claim.status}
                          </span>
                        </td>
                        
                        {/* View action button */}
                        <td className="py-4 px-6 text-center">
                          <button 
                            onClick={() => setSelectedClaim(claim)}
                            className="inline-flex items-center space-x-1 text-xs px-3.5 py-2 bg-slate-950 hover:bg-slate-950/80 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                          >
                            <Eye size={12} />
                            <span>Audit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
