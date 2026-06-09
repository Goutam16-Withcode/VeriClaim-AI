const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure claims database file exists
const dbPath = path.join(__dirname, 'claims.json');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([]));
}

// Serve uploaded files statically
app.use('/api/uploads', express.static(uploadsDir));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and images (PNG, JPG, JPEG, WEBP) are allowed'));
    }
  }
});

// Helper to read claims from JSON file
const readClaims = () => {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading claims database:', err);
    return [];
  }
};

// Helper to write claims to JSON file
const writeClaims = (claims) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(claims, null, 2));
  } catch (err) {
    console.error('Error writing claims database:', err);
  }
};

// Python executable path
const pythonPath = 'E:\\File Programming\\global_env\\Scripts\\python.exe';

// API: Submit a claim
app.post('/api/claims', upload.fields([
  { name: 'receipt', maxCount: 1 },
  { name: 'prescription', maxCount: 1 }
]), (req, res) => {
  try {
    const { name, date, facility, amount, reason, type, desc } = req.body;
    
    if (!req.files || !req.files.receipt) {
      return res.status(400).json({ error: 'Consultation Receipt is required' });
    }
    
    const receiptFile = req.files.receipt[0];
    const prescriptionFile = req.files.prescription ? req.files.prescription[0] : null;
    
    const receiptPath = receiptFile.path;
    const prescriptionPath = prescriptionFile ? prescriptionFile.path : '';
    
    // Spawn python analysis engine
    const args = [
      path.join(__dirname, 'claim_engine.py'),
      '--receipt', receiptPath,
      '--name', name,
      '--date', date,
      '--facility', facility,
      '--amount', amount,
      '--reason', reason,
      '--type', type,
      '--desc', desc || ''
    ];
    
    if (prescriptionPath) {
      args.push('--prescription', prescriptionPath);
    }
    
    console.log(`Spawning Python process: ${pythonPath} ${args.join(' ')}`);
    
    const pythonProcess = spawn(pythonPath, args);
    
    let stdoutData = '';
    let stderrData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      
      if (code !== 0) {
        console.error(`Python Stderr: ${stderrData}`);
        return res.status(500).json({ 
          error: 'Claims processing engine failed', 
          details: stderrData 
        });
      }
      
      try {
        const analysisResult = JSON.parse(stdoutData.trim());
        
        if (analysisResult.error) {
          return res.status(400).json({ error: analysisResult.error });
        }
        
        // Construct final claim record
        const claimId = uuidv4().substring(0, 8).toUpperCase();
        const newClaim = {
          id: claimId,
          dateSubmitted: new Date().toISOString().split('T')[0],
          status: analysisResult.final_decision, // APPROVED, REJECTED, FLAGGED
          formDetails: {
            name,
            date,
            facility,
            amount: parseFloat(amount),
            reason,
            type,
            desc
          },
          extractedDetails: {
            name: analysisResult.extracted_name,
            date: analysisResult.extracted_date,
            facility: analysisResult.extracted_facility,
            disease: analysisResult.extracted_disease,
            icd10: analysisResult.extracted_icd10,
            total: analysisResult.extracted_total,
            itemizedBill: analysisResult.itemized_bill,
            calculatedBillSum: analysisResult.calculated_bill_sum,
            prescriptionMatches: analysisResult.prescription_matches,
            prescriptionMismatchReason: analysisResult.prescription_mismatch_reason,
            exclusionReason: analysisResult.exclusion_reason
          },
          flags: analysisResult.flags,
          fraudRisk: analysisResult.fraud_risk,
          riskPoints: analysisResult.risk_points,
          decisionReason: analysisResult.decision_reason,
          openaiReport: analysisResult.openai_report,
          receiptUrl: `/api/uploads/${path.basename(receiptPath)}`,
          prescriptionUrl: prescriptionFile ? `/api/uploads/${path.basename(prescriptionPath)}` : null,
          adminNotes: ''
        };
        
        // Save to database
        const claims = readClaims();
        claims.unshift(newClaim); // Add to the top
        writeClaims(claims);
        
        res.json(newClaim);
      } catch (parseErr) {
        console.error('Failed to parse Python JSON output:', stdoutData);
        console.error('Parse error:', parseErr);
        res.status(500).json({ 
          error: 'Failed to parse engine response', 
          output: stdoutData 
        });
      }
    });
    
  } catch (err) {
    console.error('Submit claim error:', err);
    res.status(500).json({ error: 'Server error processing claim' });
  }
});

// API: Get all claims
app.get('/api/claims', (req, res) => {
  const claims = readClaims();
  res.json(claims);
});

// API: Get single claim detail
app.get('/api/claims/:id', (req, res) => {
  const claims = readClaims();
  const claim = claims.find(c => c.id === req.params.id);
  if (!claim) {
    return res.status(404).json({ error: 'Claim not found' });
  }
  res.json(claim);
});

// API: Perform Admin Action (Approve / Reject claim)
app.post('/api/claims/:id/action', (req, res) => {
  const { action, notes } = req.body; // action: APPROVED or REJECTED
  
  if (!['APPROVED', 'REJECTED'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be APPROVED or REJECTED' });
  }
  
  const claims = readClaims();
  const index = claims.findIndex(c => c.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Claim not found' });
  }
  
  claims[index].status = action;
  claims[index].adminNotes = notes || '';
  claims[index].decisionReason = `Manual Review Decision: ${action}. Adjuster Notes: ${notes || 'None'}`;
  
  writeClaims(claims);
  res.json(claims[index]);
});

// Serve frontend build static files in production
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
