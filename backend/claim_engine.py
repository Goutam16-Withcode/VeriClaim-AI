import os
import sys
import argparse
import json
import re
from PyPDF2 import PdfReader
from dotenv import load_dotenv

# Load env variables from root workspace directory
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(root_dir, ".env"))

# Set API keys
api_key = os.getenv("OPENAI_API_KEY")
if api_key:
    api_key = api_key.strip().strip('"').strip("'")
    os.environ["OPENAI_API_KEY"] = api_key

anthropic_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY") or os.getenv("CLUDE_API_KEY")
if anthropic_key:
    anthropic_key = anthropic_key.strip().strip('"').strip("'")
    os.environ["ANTHROPIC_API_KEY"] = anthropic_key

google_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
if google_key:
    google_key = google_key.strip().strip('"').strip("'")
    os.environ["GOOGLE_API_KEY"] = google_key
    os.environ["GEMINI_API_KEY"] = google_key

try:
    from langchain_openai import OpenAIEmbeddings, ChatOpenAI
    from langchain_community.vectorstores import FAISS
    from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    from langchain.schema import Document
except ImportError as e:
    print(json.dumps({"error": f"Import error: {str(e)}"}))
    sys.exit(1)

try:
    from langchain_anthropic import ChatAnthropic
except ImportError:
    ChatAnthropic = None

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

# General exclusions list fallback
GENERAL_EXCLUSION_LIST = [
    "HIV/AIDS", "Parkinson's disease", "Alzheimer's disease", "pregnancy",
    "substance abuse", "self-inflicted injuries", "sexually transmitted diseases(std)",
    "pre-existing conditions"
]

def extract_text_from_file(file_path):
    if not file_path or not os.path.exists(file_path):
        return ""
    
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == '.pdf':
        text = ""
        try:
            reader = PdfReader(file_path)
            for page in reader.pages:
                text += page.extract_text() or ""
        except Exception as e:
            print(f"Error reading PDF with PyPDF2: {e}", file=sys.stderr)
        
        # If PyPDF2 returns empty or extremely short text (scanned PDF), use PyMuPDF + EasyOCR fallback
        if len(text.strip()) < 30:
            print(f"PDF contains no selectable text (scanned). Running PyMuPDF + EasyOCR on {file_path}...", file=sys.stderr)
            try:
                import fitz
                import easyocr
                doc = fitz.open(file_path)
                ocr_texts = []
                reader_ocr = easyocr.Reader(['en'], gpu=False, verbose=False)
                for page_num in range(len(doc)):
                    pix = doc[page_num].get_pixmap(dpi=150)
                    img_bytes = pix.tobytes("png")
                    results = reader_ocr.readtext(img_bytes)
                    page_text = " ".join([res[1] for res in results])
                    ocr_texts.append(page_text)
                text = "\n".join(ocr_texts)
            except Exception as e:
                print(f"Error during scanned PDF OCR: {e}", file=sys.stderr)
        return text
    
    elif ext in ['.png', '.jpg', '.jpeg', '.webp']:
        try:
            import easyocr
            reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            results = reader.readtext(file_path)
            text = " ".join([res[1] for res in results])
            return text
        except Exception as e:
            print(f"Error running EasyOCR: {e}", file=sys.stderr)
            return ""
            
    return ""

def load_or_create_vector_db():
    try:
        # If no OpenAI key, we cannot load FAISS built with OpenAI embeddings
        if not api_key or api_key == "YOUR_OPENAI_API_KEY_HERE" or api_key == "":
            return None
            
        db_path = os.path.join(root_dir, "faiss_index")
        embeddings = OpenAIEmbeddings()
        
        if os.path.exists(db_path):
            try:
                db = FAISS.load_local(db_path, embeddings, allow_dangerous_deserialization=True)
                return db
            except Exception as e:
                print(f"Error loading cached FAISS db: {e}", file=sys.stderr)
                
        # Fallback to create FAISS DB if not exists
        docs_path = os.path.join(root_dir, "documents")
        if not os.path.exists(docs_path):
            os.makedirs(docs_path, exist_ok=True)
            
        loader = DirectoryLoader(docs_path, glob="**/*.pdf", loader_cls=PyPDFLoader)
        try:
            documents = loader.load()
            if not documents:
                # Create a dummy document if folder is empty
                documents = [Document(page_content="Policy documents and claim exclusions handbook template.")]
        except Exception as e:
            print(f"Error loading documents: {e}", file=sys.stderr)
            documents = [Document(page_content="Policy documents and claim exclusions handbook template.")]
            
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)
        
        db = FAISS.from_documents(chunks, embeddings)
        try:
            db.save_local(db_path)
        except Exception as e:
            print(f"Error saving FAISS db: {e}", file=sys.stderr)
            
        return db
    except Exception as e:
        print(f"Failed to load or build FAISS index (OpenAI embedding error): {e}", file=sys.stderr)
        return None

def analyze_claim(args):
    has_openai = api_key and api_key != "YOUR_OPENAI_API_KEY_HERE" and api_key != ""
    has_anthropic = anthropic_key and anthropic_key != "YOUR_CLAUDE_API_KEY_HERE" and anthropic_key != ""
    has_google = google_key and google_key != "YOUR_GEMINI_API_KEY_HERE" and google_key != ""
    
    if not has_openai and not has_anthropic and not has_google:
        return {"error": "API Key is missing. Please configure OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY in your .env file."}
        
    # 1. Load files & extract text
    receipt_text = extract_text_from_file(args.receipt)
    prescription_text = extract_text_from_file(args.prescription) if args.prescription else ""
    
    if not receipt_text:
        return {"error": "Could not extract any text from the Consultation Receipt. Please ensure it is a clear image or PDF."}
        
    # 2. Get RAG Context
    claim_approval_context = ""
    general_exclusion_context = ""
    
    db = load_or_create_vector_db()
    if db:
        try:
            claim_approval_hits = db.similarity_search("What are the documents required for claim approval?", k=2)
            claim_approval_context = "\n".join([doc.page_content for doc in claim_approval_hits])
            
            general_exclusion_hits = db.similarity_search("Give a list of all general exclusions", k=2)
            general_exclusion_context = "\n".join([doc.page_content for doc in general_exclusion_hits])
        except Exception as e:
            print(f"RAG Error: {e}", file=sys.stderr)
            db = None
            
    if not db:
        # Fallback document reader (for Claude/No-OpenAI key)
        print("Bypassing FAISS search, running fallback document reader...", file=sys.stderr)
        docs_path = os.path.join(root_dir, "documents")
        document_texts = []
        if os.path.exists(docs_path):
            for file in os.listdir(docs_path):
                if file.endswith('.pdf') and "bill" not in file.lower() and "patient" not in file.lower():
                    try:
                        reader = PdfReader(os.path.join(docs_path, file))
                        file_text = f"--- Document: {file} ---\n"
                        # Extract first 4 pages to stay within context size
                        for i in range(min(4, len(reader.pages))):
                            file_text += reader.pages[i].extract_text() or ""
                        document_texts.append(file_text)
                    except Exception as e:
                        print(f"Fallback reading error for {file}: {e}", file=sys.stderr)
        
        fallback_context = "\n".join(document_texts)
        claim_approval_context = fallback_context[:8000]
        general_exclusion_context = fallback_context[:8000]
        if not claim_approval_context:
            claim_approval_context = "Consultation receipts must match patient name and treatment date."
            general_exclusion_context = ", ".join(GENERAL_EXCLUSION_LIST)

    # 3. Call LLM for Information Extraction and Analysis
    llm_type = "openai"
    llm = None
    
    if has_google and genai is not None:
        print("Using Google Gemini model...", file=sys.stderr)
        llm_type = "gemini"
    elif has_anthropic and (not has_openai or ChatAnthropic is not None):
        if ChatAnthropic is None:
            return {"error": "Anthropic LangChain module is not installed."}
        print("Using Anthropic Claude model...", file=sys.stderr)
        llm = ChatAnthropic(model="claude-3-5-sonnet-20240620", temperature=0.2)
        llm_type = "anthropic"
    else:
        print("Using OpenAI GPT model...", file=sys.stderr)
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
        llm_type = "openai"
    
    prompt = f"""
You are an expert AI claims validator working for VeriClaim AI. Your job is to extract billing information and analyze the claim for eligibility and compliance.

FORM DETAILS (Submitted by Patient):
- Submitted Name: {args.name}
- Submitted Date: {args.date}
- Submitted Medical Facility: {args.facility}
- Submitted Claim Amount: {args.amount}
- Claim Reason / Symptoms: {args.reason}
- Claim Category / Item: {args.type}
- Claim Description: {args.desc}

EXTRACTED TEXT FROM PATIENT INVOICE/RECEIPT:
\"\"\"
{receipt_text}
\"\"\"

EXTRACTED TEXT FROM DOCTOR'S PRESCRIPTION / DISCHARGE SUMMARY (IF PROVIDED):
\"\"\"
{prescription_text}
\"\"\"

POLICY GUIDELINES & EXCLUSIONS RETRIEVED FROM MANUALS:
- Claim Approval Documents: {claim_approval_context}
- Policy General Exclusions: {general_exclusion_context}
- Standard Exclusion Keywords: {", ".join(GENERAL_EXCLUSION_LIST)}

INSTRUCTIONS:
1. Extract the patient's name, date of treatment, and medical facility from the invoice text.
2. Formulate the primary diagnosis / disease treated, map it to its appropriate ICD-10 code (e.g. J06.9, M54.5), and write a brief description of the code.
3. Extract an itemized list of all billed services, consultation fees, medicines, or tests, with their individual costs. If not itemized, create a single line item representing the total consultation.
4. Verify if the diagnosed disease/reason falls under the General Exclusions list. Perform a semantic check.
5. If a prescription was provided, cross-reference the billed items/medications against the prescription to see if they were authorized.
6. Write a comprehensive, professional Claim Audit Report. Structure it with:
   - **Executive Summary**
   - **Introduction & Claim Details**
   - **Document Verification Details**
   - **Itemized Bill Audit**
   - **Exclusion & Fraud Assessment**
   - **Final Verdict**

Return your analysis strictly in valid JSON format. Do not put markdown around the JSON, just return the JSON string.
Format:
{{
  "extracted_name": "Name extracted from receipt",
  "extracted_date": "Date extracted from receipt (YYYY-MM-DD or readable format)",
  "extracted_facility": "Facility extracted from receipt",
  "extracted_disease": "Diagnosed disease/condition",
  "extracted_icd10": "ICD-10 code and brief title (e.g. 'J06.9 - Acute upper respiratory infection')",
  "extracted_total": 0.0,
  "itemized_bill": [
    {{"item": "Consultation Fee", "cost": 100.00}},
    {{"item": "Medicine X", "cost": 25.50}}
  ],
  "is_excluded": false,
  "exclusion_reason": "Explanation of exclusion if true, otherwise empty",
  "prescription_matches": true,
  "prescription_mismatch_reason": "Details if some items were not prescribed",
  "openai_report": "Markdown report content..."
}}
"""
    
    try:
        print("Calling LLM...", file=sys.stderr)
        if llm_type == "gemini":
            client = genai.Client(api_key=google_key)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.2)
            )
            content = response.text.strip()
        else:
            response = llm.invoke(prompt)
            content = response.content.strip()
    except Exception as e:
        print(f"Primary LLM completion error: {e}", file=sys.stderr)
        # Check if we can fall back to OpenAI if primary failed
        if (llm_type == "anthropic" or llm_type == "gemini") and has_openai:
            print(f"Primary LLM ({llm_type}) call failed. Falling back to OpenAI GPT...", file=sys.stderr)
            try:
                llm_fallback = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
                response = llm_fallback.invoke(prompt)
                content = response.content.strip()
            except Exception as e_inner:
                print(f"Fallback OpenAI completion error: {e_inner}", file=sys.stderr)
                return {"error": f"Failed to analyze claim with LLM (Primary & Fallback failed): {str(e_inner)}"}
        else:
            return {"error": f"Failed to analyze claim with LLM: {str(e)}"}

    try:
        # Clean any potential markdown wrapping (like ```json ... ```)
        if content.startswith("```"):
            content = re.sub(r"^```(json)?\n", "", content)
            content = re.sub(r"\n```$", "", content)
            
        data = json.loads(content)
    except Exception as e:
        print(f"Failed to parse LLM JSON output: {e}", file=sys.stderr)
        return {"error": f"Failed to parse LLM response: {str(e)}"}
        
    # 4. Programmatic Fraud Checks & Risk Scoring
    flags = []
    
    # Name validation (Fuzzy check)
    submitted_name_clean = re.sub(r'[^a-zA-Z]', '', args.name.lower())
    extracted_name_clean = re.sub(r'[^a-zA-Z]', '', data.get("extracted_name", "").lower())
    
    # Simple check if one name is contained in the other
    if not extracted_name_clean or (submitted_name_clean not in extracted_name_clean and extracted_name_clean not in submitted_name_clean):
        flags.append("PATIENT_NAME_DISCREPANCY")
        
    # Date validation
    submitted_date = args.date.strip()
    extracted_date = data.get("extracted_date", "").strip()
    
    # Clean and extract year/month/day
    sub_date_digits = "".join(re.findall(r'\d', submitted_date))
    ext_date_digits = "".join(re.findall(r'\d', extracted_date))
    
    if ext_date_digits and (sub_date_digits not in ext_date_digits and ext_date_digits not in sub_date_digits):
        # Allow some flexibility, but flag if totally different
        flags.append("TREATMENT_DATE_MISMATCH")
        
    # Math verification: sum of items vs receipt total vs claimed amount
    item_sum = sum(item.get("cost", 0.0) for item in data.get("itemized_bill", []))
    extracted_total = float(data.get("extracted_total", 0.0) or 0.0)
    claimed_amount = float(args.amount or 0.0)
    
    if abs(item_sum - extracted_total) > 1.0:
        flags.append("INVOICE_SUM_MISMATCH")
        
    if claimed_amount > extracted_total + 1.0:
        flags.append("CLAIM_EXCEEDS_INVOICE_TOTAL")
        
    # Prescription check flag
    if args.prescription and not data.get("prescription_matches", True):
        flags.append("UNPRESCRIBED_TREATMENTS_BILLED")
        
    # Policy exclusion check flag
    if data.get("is_excluded", False):
        flags.append("POLICY_EXCLUDED_DISEASE")
        
    # Calculate Fraud Risk Score
    risk_points = 0
    if "PATIENT_NAME_DISCREPANCY" in flags: risk_points += 40
    if "CLAIM_EXCEEDS_INVOICE_TOTAL" in flags: risk_points += 30
    if "TREATMENT_DATE_MISMATCH" in flags: risk_points += 20
    if "INVOICE_SUM_MISMATCH" in flags: risk_points += 10
    if "UNPRESCRIBED_TREATMENTS_BILLED" in flags: risk_points += 20
    
    if risk_points >= 50:
        fraud_risk = "HIGH"
    elif risk_points >= 20:
        fraud_risk = "MEDIUM"
    else:
        fraud_risk = "LOW"
        
    # Final Claim Status Decision
    if "POLICY_EXCLUDED_DISEASE" in flags:
        final_decision = "REJECTED"
        decision_reason = f"Rejection: Treatment for '{data.get('extracted_disease')}' is excluded under policy rules. " + data.get("exclusion_reason", "")
    elif "PATIENT_NAME_DISCREPANCY" in flags or fraud_risk == "HIGH":
        final_decision = "REJECTED"
        decision_reason = "Rejection: Security verification failed (Patient name mismatch or high fraud indicators)."
    elif flags: # Any minor flags
        final_decision = "FLAGGED"
        decision_reason = "Flagged: Claim requires manual verification due to minor discrepancies (e.g. date mismatch, invoice sum deviation)."
    else:
        final_decision = "APPROVED"
        decision_reason = "Auto-Approved: All validation criteria passed successfully."
        
    data.update({
        "flags": flags,
        "fraud_risk": fraud_risk,
        "risk_points": risk_points,
        "final_decision": final_decision,
        "decision_reason": decision_reason,
        "calculated_bill_sum": round(item_sum, 2)
    })
    
    return data

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="AI Insurance Claim Processing Engine")
    parser.add_argument("--receipt", required=True, help="Path to Consultation Receipt PDF or Image")
    parser.add_argument("--prescription", help="Path to Prescription PDF or Image")
    parser.add_argument("--name", required=True, help="Patient Name")
    parser.add_argument("--date", required=True, help="Treatment Date (YYYY-MM-DD)")
    parser.add_argument("--facility", required=True, help="Medical Facility Name")
    parser.add_argument("--amount", required=True, help="Claimed Amount")
    parser.add_argument("--reason", required=True, help="Claim Reason")
    parser.add_argument("--type", required=True, help="Claim Type")
    parser.add_argument("--desc", default="", help="Description")
    
    args = parser.parse_args()
    
    result = analyze_claim(args)
    print(json.dumps(result))
