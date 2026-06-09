import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, XCircle, AlertTriangle, Loader2, Sparkles, HelpCircle } from 'lucide-react';

const CLAIM_ITEMS = [
  "General Practitioner",
  "Specialist",
  "Prescribed Western Medication",
  "Diag. Imaging & Lab Tests",
  "Health Check-up",
  "Bonesetter",
  "Vaccination",
  "Physiotherapist",
  "Chiropractor",
  "Dental Consultation",
  "Psychiatric-related Treatments"
];

function ClaimForm({ onSwitchToAdmin }) {
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    facility: '',
    amount: '',
    reason: '',
    type: '',
    desc: ''
  });
  
  const [receiptFile, setReceiptFile] = useState(null);
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  
  const [isDraggingReceipt, setIsDraggingReceipt] = useState(false);
  const [isDraggingPrescription, setIsDraggingPrescription] = useState(false);
  
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState(null);
  const [loadingStep, setLoadingStep] = useState(0);

  const receiptInputRef = useRef(null);
  const prescriptionInputRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Drag and drop handlers
  const handleDragOver = (e, setDrag) => {
    e.preventDefault();
    setDrag(true);
  };

  const handleDragLeave = (e, setDrag) => {
    e.preventDefault();
    setDrag(false);
  };

  const handleDrop = (e, setFile, setDrag) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e, setFile) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!receiptFile) {
      setErrorMessage("Please upload your consultation receipt / invoice.");
      setStatus('error');
      return;
    }

    setStatus('loading');
    setLoadingStep(0);

    // Animate processing steps
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev < 4) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 2500);

    const data = new FormData();
    data.append('name', formData.name);
    data.append('date', formData.date);
    data.append('facility', formData.facility);
    data.append('amount', formData.amount);
    data.append('reason', formData.reason);
    data.append('type', formData.type);
    data.append('desc', formData.desc);
    data.append('receipt', receiptFile);
    if (prescriptionFile) {
      data.append('prescription', prescriptionFile);
    }

    try {
      const response = await fetch('/api/claims', {
        method: 'POST',
        body: data
      });
      
      const resData = await response.json();
      
      clearInterval(stepInterval);

      if (!response.ok) {
        throw new Error(resData.error || 'Something went wrong during claim processing');
      }

      setResult(resData);
      setStatus('success');
    } catch (err) {
      clearInterval(stepInterval);
      setErrorMessage(err.message);
      setStatus('error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      facility: '',
      amount: '',
      reason: '',
      type: '',
      desc: ''
    });
    setReceiptFile(null);
    setPrescriptionFile(null);
    setResult(null);
    setStatus('idle');
  };

  // Loading Screen Steps
  const processingSteps = [
    "Uploading receipt and prescription files to server...",
    "Extracting details from invoice (OCR text extraction)...",
    "Searching policy handbook via FAISS semantic indexing...",
    "Running LLM audits, fraud models, and ICD-10 code mapping...",
    "Finalizing claim audit checklist and decision report..."
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {status === 'loading' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-bupa-500 to-indigo-500 animate-pulse"></div>
            
            <Loader2 className="h-14 w-14 text-bupa-500 animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-2 text-white">Verifying Insurance Claim</h2>
            <p className="text-slate-400 text-sm mb-8">Please wait while the AI intelligence audits your documents.</p>
            
            <div className="text-left space-y-4 max-w-md mx-auto">
              {processingSteps.map((step, idx) => {
                const isCompleted = idx < loadingStep;
                const isCurrent = idx === loadingStep;
                return (
                  <div key={idx} className={`flex items-start space-x-3 transition-opacity duration-300 ${isCompleted ? 'text-emerald-400' : isCurrent ? 'text-white font-medium' : 'text-slate-500'}`}>
                    {isCompleted ? (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 size={18} className="mt-0.5 animate-spin text-bupa-400 shrink-0" />
                    ) : (
                      <div className="h-[18px] w-[18px] rounded-full border border-slate-700 mt-0.5 shrink-0" />
                    )}
                    <span className="text-sm">{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {status === 'success' && result && (
        <div className="space-y-8 animate-fade-in">
          {/* Header Banner */}
          <div className={`p-6 rounded-3xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
            result.status === 'APPROVED' 
              ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-100' 
              : result.status === 'REJECTED' 
              ? 'bg-rose-950/30 border-rose-800/50 text-rose-100' 
              : 'bg-amber-950/30 border-amber-800/50 text-amber-100'
          }`}>
            <div>
              <div className="flex items-center space-x-2">
                <Sparkles size={20} className={result.status === 'APPROVED' ? 'text-emerald-400' : result.status === 'REJECTED' ? 'text-rose-400' : 'text-amber-400'} />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Claim ID: #{result.id}</span>
              </div>
              <h1 className="text-3xl font-bold mt-1">Claim {result.status === 'APPROVED' ? 'Auto-Approved' : result.status === 'REJECTED' ? 'Rejected' : 'Flagged for Review'}</h1>
              <p className="text-slate-400 mt-1 text-sm">{result.decisionReason}</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={resetForm}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all"
              >
                Submit New Claim
              </button>
              {result.status === 'FLAGGED' && (
                <button 
                  onClick={onSwitchToAdmin}
                  className="px-5 py-2.5 bg-bupa-600 hover:bg-bupa-500 text-white rounded-xl text-sm font-medium shadow-lg transition-all"
                >
                  Open Admin Dashboard
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Details Check */}
            <div className="lg:col-span-2 space-y-8">
              {/* Audit Checklist Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white mb-6">AI Verification Checkpoints</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Check 1 */}
                  <div className="flex items-start p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                    {!result.flags.includes("PATIENT_NAME_DISCREPANCY") ? (
                      <CheckCircle2 className="text-emerald-400 mr-3 mt-0.5 shrink-0" size={20} />
                    ) : (
                      <XCircle className="text-rose-400 mr-3 mt-0.5 shrink-0" size={20} />
                    )}
                    <div>
                      <h4 className="text-sm font-medium text-white">Patient Name Identity</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {!result.flags.includes("PATIENT_NAME_DISCREPANCY") 
                          ? `Match verified: "${result.extractedDetails.name}" matches patient profile.`
                          : `Mismatch: Form has "${result.formDetails.name}" but bill lists "${result.extractedDetails.name}".`}
                      </p>
                    </div>
                  </div>

                  {/* Check 2 */}
                  <div className="flex items-start p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                    {!result.flags.includes("TREATMENT_DATE_MISMATCH") ? (
                      <CheckCircle2 className="text-emerald-400 mr-3 mt-0.5 shrink-0" size={20} />
                    ) : (
                      <XCircle className="text-rose-400 mr-3 mt-0.5 shrink-0" size={20} />
                    )}
                    <div>
                      <h4 className="text-sm font-medium text-white">Treatment Date Alignment</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {!result.flags.includes("TREATMENT_DATE_MISMATCH") 
                          ? `Match verified: "${result.extractedDetails.date}" matches submitted date.`
                          : `Mismatch: Claimed date is "${result.formDetails.date}" but bill date is "${result.extractedDetails.date}".`}
                      </p>
                    </div>
                  </div>

                  {/* Check 3 */}
                  <div className="flex items-start p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                    {!result.flags.includes("CLAIM_EXCEEDS_INVOICE_TOTAL") && !result.flags.includes("INVOICE_SUM_MISMATCH") ? (
                      <CheckCircle2 className="text-emerald-400 mr-3 mt-0.5 shrink-0" size={20} />
                    ) : (
                      <AlertTriangle className="text-amber-400 mr-3 mt-0.5 shrink-0" size={20} />
                    )}
                    <div>
                      <h4 className="text-sm font-medium text-white">Billing Sum Check</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {result.flags.includes("CLAIM_EXCEEDS_INVOICE_TOTAL") 
                          ? `Warning: Claimed $${result.formDetails.amount} exceeds bill total $${result.extractedDetails.total}.`
                          : `Billed sum totals $${result.extractedDetails.total} matching the itemized list.`}
                      </p>
                    </div>
                  </div>

                  {/* Check 4 */}
                  <div className="flex items-start p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                    {!result.flags.includes("POLICY_EXCLUDED_DISEASE") ? (
                      <CheckCircle2 className="text-emerald-400 mr-3 mt-0.5 shrink-0" size={20} />
                    ) : (
                      <XCircle className="text-rose-400 mr-3 mt-0.5 shrink-0" size={20} />
                    )}
                    <div>
                      <h4 className="text-sm font-medium text-white">Policy Exclusions Check</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {!result.flags.includes("POLICY_EXCLUDED_DISEASE") 
                          ? "Success: Diagnosis does not fall under policy exclusions list."
                          : `Rejected: Diagnosed "${result.extractedDetails.disease}" is excluded.`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Table Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-white">Extracted Invoice Items</h3>
                  <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg">
                    ICD-10: {result.extractedDetails.icd10 || 'N/A'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-xs">
                        <th className="pb-3 font-semibold">Service / Treatment Item</th>
                        <th className="pb-3 text-right font-semibold">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {result.extractedDetails.itemizedBill && result.extractedDetails.itemizedBill.map((item, index) => (
                        <tr key={index} className="text-slate-300">
                          <td className="py-3.5 font-medium">{item.item}</td>
                          <td className="py-3.5 text-right font-semibold">${parseFloat(item.cost).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold text-white border-t border-slate-800">
                        <td className="pt-4 pb-2">Calculated Total</td>
                        <td className="pt-4 pb-2 text-right">${parseFloat(result.extractedDetails.calculatedBillSum).toFixed(2)}</td>
                      </tr>
                      <tr className="text-slate-400 font-normal">
                        <td className="py-1">Extracted Invoice Total</td>
                        <td className="py-1 text-right">${parseFloat(result.extractedDetails.total).toFixed(2)}</td>
                      </tr>
                      <tr className="text-bupa-400 font-semibold">
                        <td className="py-1">Claimed Payout Request</td>
                        <td className="py-1 text-right">${parseFloat(result.formDetails.amount).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* OpenAI Markdown Report */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white mb-6">AI Audit Findings & Analysis</h3>
                <div className="prose prose-invert prose-sm max-w-none text-slate-300 space-y-4">
                  {result.openaiReport ? (
                    result.openaiReport.split('\n').map((line, index) => {
                      if (line.startsWith('### ')) {
                        return <h4 key={index} className="text-md font-bold text-white mt-4">{line.substring(4)}</h4>;
                      } else if (line.startsWith('## ')) {
                        return <h3 key={index} className="text-lg font-bold text-bupa-300 mt-6 border-b border-slate-800 pb-2">{line.substring(3)}</h3>;
                      } else if (line.startsWith('- ')) {
                        return <li key={index} className="ml-4 list-disc text-slate-300">{line.substring(2)}</li>;
                      } else if (line.trim() === '') {
                        return <div key={index} className="h-2" />;
                      } else {
                        return <p key={index} className="leading-relaxed">{line}</p>;
                      }
                    })
                  ) : (
                    <p>No report generated.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Risk & Files */}
            <div className="space-y-8">
              {/* Fraud Risk Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Fraud Assessment</h3>
                <div className="text-center p-6 bg-slate-950/60 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Risk Threat Level</span>
                  <span className={`text-4xl font-extrabold block mt-2 ${
                    result.fraudRisk === 'LOW' 
                      ? 'text-emerald-400' 
                      : result.fraudRisk === 'MEDIUM' 
                      ? 'text-amber-400' 
                      : 'text-rose-500'
                  }`}>
                    {result.fraudRisk}
                  </span>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full mt-4 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        result.fraudRisk === 'LOW' 
                          ? 'bg-emerald-400 w-1/5' 
                          : result.fraudRisk === 'MEDIUM' 
                          ? 'bg-amber-400 w-3/5' 
                          : 'bg-rose-500 w-full'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-slate-500 mt-2 block">{result.riskPoints} Risk Anomaly Points</span>
                </div>
                
                {result.flags.length > 0 && (
                  <div className="mt-6 space-y-2.5">
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Security Indicators Raised:</span>
                    {result.flags.map((flag, index) => (
                      <div key={index} className="flex items-center space-x-2 px-3 py-2 bg-rose-950/15 border border-rose-900/40 rounded-xl text-rose-400 text-xs">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span className="font-mono">{flag}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Uploaded Documents Preview */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Submitted Documents</h3>
                <div className="space-y-4">
                  {/* Receipt URL */}
                  <a 
                    href={result.receiptUrl} 
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
                        <span className="text-xs text-slate-500 block">Uploaded receipt file</span>
                      </div>
                    </div>
                  </a>

                  {/* Prescription URL */}
                  {result.prescriptionUrl ? (
                    <a 
                      href={result.prescriptionUrl} 
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
                          <span className="text-xs text-slate-500 block">Clinical audit trail</span>
                        </div>
                      </div>
                    </a>
                  ) : (
                    <div className="p-4 bg-slate-950/30 border border-dashed border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                      No prescription document was uploaded.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="p-6 bg-rose-950/30 border border-rose-800/50 text-rose-100 rounded-3xl mb-8 flex items-start space-x-3">
          <XCircle className="text-rose-400 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-lg">Error Submitting Claim</h3>
            <p className="text-slate-400 text-sm mt-1">{errorMessage}</p>
            <button 
              onClick={() => setStatus('idle')}
              className="mt-4 px-4 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {status === 'idle' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Submission Info / Instructions */}
          <div className="lg:col-span-1 space-y-6">
            <div>
              <span className="px-3 py-1 bg-bupa-500/10 text-bupa-400 text-xs font-semibold tracking-wider uppercase rounded-full">
                Insurance Automation
              </span>
              <h1 className="text-4xl font-extrabold text-white mt-4 leading-tight">
                AI Claims Processing
              </h1>
              <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                Submit your claim details and patient documents. Our automated intelligence matches invoices, runs fraud models, cross-checks exclusions, and drafts reports.
              </p>
            </div>

            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <h4 className="text-sm font-semibold text-white flex items-center space-x-2">
                <HelpCircle size={16} className="text-bupa-400" />
                <span>Document Guidelines</span>
              </h4>
              <ul className="text-xs text-slate-400 space-y-2.5">
                <li className="flex items-start">
                  <CheckCircle2 size={12} className="text-bupa-400 mr-2 mt-0.5 shrink-0" />
                  <span>The invoice must display the patient name clearly.</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 size={12} className="text-bupa-400 mr-2 mt-0.5 shrink-0" />
                  <span>Ensure the date of treatment matches the claim.</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 size={12} className="text-bupa-400 mr-2 mt-0.5 shrink-0" />
                  <span>Provide individual costs or a total itemized amount.</span>
                </li>
                <li className="flex items-start text-indigo-300 font-medium">
                  <Sparkles size={12} className="text-indigo-400 mr-2 mt-0.5 shrink-0" />
                  <span>Upload an optional doctor's note / prescription to auto-verify clinical necessity.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Claim Submission Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-bupa-600 to-blue-500"></div>
              
              <h3 className="text-xl font-bold text-white border-b border-slate-800 pb-4">Insurance Claims Request Form</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Patient Name */}
                <div className="space-y-2">
                  <label htmlFor="name" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Patient Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter full patient name"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-bupa-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all"
                  />
                </div>

                {/* Treatment Date */}
                <div className="space-y-2">
                  <label htmlFor="date" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Treatment Date</label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    required
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-bupa-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none transition-all"
                  />
                </div>

                {/* Claim Item Type */}
                <div className="space-y-2">
                  <label htmlFor="type" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Claim Category</label>
                  <select
                    id="type"
                    name="type"
                    required
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-bupa-500 rounded-xl px-4 py-3 text-sm text-slate-400 focus:text-slate-100 outline-none transition-all"
                  >
                    <option value="" disabled>Select category</option>
                    {CLAIM_ITEMS.map((item, idx) => (
                      <option key={idx} value={item} className="bg-slate-950 text-slate-100">{item}</option>
                    ))}
                  </select>
                </div>

                {/* Medical Facility */}
                <div className="space-y-2">
                  <label htmlFor="facility" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Medical Facility</label>
                  <input
                    type="text"
                    id="facility"
                    name="facility"
                    required
                    value={formData.facility}
                    onChange={handleInputChange}
                    placeholder="Clinic or Hospital Name"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-bupa-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all"
                  />
                </div>

                {/* Claimed Amount */}
                <div className="space-y-2">
                  <label htmlFor="amount" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Claim Amount ($)</label>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    required
                    min="1"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-bupa-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                {/* Claim Reason */}
                <div className="space-y-2">
                  <label htmlFor="reason" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Diagnosis / Claim Reason</label>
                  <input
                    type="text"
                    id="reason"
                    name="reason"
                    required
                    value={formData.reason}
                    onChange={handleInputChange}
                    placeholder="e.g. Influenza, back pain"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-bupa-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label htmlFor="desc" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Description / Notes</label>
                <textarea
                  id="desc"
                  name="desc"
                  rows="3"
                  value={formData.desc}
                  onChange={handleInputChange}
                  placeholder="Provide any additional context for the claim review"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-bupa-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all resize-none"
                />
              </div>

              {/* Document Upload Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                {/* Receipt Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Consultation Receipt (Required)</label>
                  <div
                    onDragOver={(e) => handleDragOver(e, setIsDraggingReceipt)}
                    onDragLeave={(e) => handleDragLeave(e, setIsDraggingReceipt)}
                    onDrop={(e) => handleDrop(e, setReceiptFile, setIsDraggingReceipt)}
                    onClick={() => receiptInputRef.current.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                      receiptFile 
                        ? 'border-emerald-600/80 bg-emerald-950/10' 
                        : isDraggingReceipt 
                        ? 'border-bupa-500 bg-bupa-950/20' 
                        : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={receiptInputRef} 
                      onChange={(e) => handleFileChange(e, setReceiptFile)} 
                      className="hidden" 
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                    />
                    {receiptFile ? (
                      <div className="space-y-2 text-emerald-400">
                        <CheckCircle2 size={36} className="mx-auto" />
                        <span className="text-xs font-medium block truncate max-w-[200px]">{receiptFile.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{(receiptFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    ) : (
                      <div className="space-y-2 text-slate-400">
                        <UploadCloud size={36} className="mx-auto text-slate-500" />
                        <span className="text-xs font-medium block">Drag & Drop Invoice</span>
                        <span className="text-[10px] text-slate-600 block">PDF or Image (PNG, JPG)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Prescription Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Prescription / Discharge note (Optional)</label>
                  <div
                    onDragOver={(e) => handleDragOver(e, setIsDraggingPrescription)}
                    onDragLeave={(e) => handleDragLeave(e, setIsDraggingPrescription)}
                    onDrop={(e) => handleDrop(e, setPrescriptionFile, setIsDraggingPrescription)}
                    onClick={() => prescriptionInputRef.current.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                      prescriptionFile 
                        ? 'border-purple-600/80 bg-purple-950/10' 
                        : isDraggingPrescription 
                        ? 'border-bupa-500 bg-bupa-950/20' 
                        : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={prescriptionInputRef} 
                      onChange={(e) => handleFileChange(e, setPrescriptionFile)} 
                      className="hidden" 
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                    />
                    {prescriptionFile ? (
                      <div className="space-y-2 text-purple-400">
                        <CheckCircle2 size={36} className="mx-auto" />
                        <span className="text-xs font-medium block truncate max-w-[200px]">{prescriptionFile.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{(prescriptionFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    ) : (
                      <div className="space-y-2 text-slate-400">
                        <UploadCloud size={36} className="mx-auto text-slate-500" />
                        <span className="text-xs font-medium block">Drag & Drop Prescription</span>
                        <span className="text-[10px] text-slate-600 block">PDF or Image (PNG, JPG)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-bupa-600 hover:bg-bupa-500 text-white rounded-xl py-4 font-semibold text-sm shadow-lg flex items-center justify-center space-x-2 transition-all"
              >
                <Sparkles size={16} />
                <span>Verify and Submit Insurance Claim</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClaimForm;
