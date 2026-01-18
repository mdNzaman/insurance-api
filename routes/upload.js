const express = require('express');
const multer = require('multer');
const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(csv|xlsx|xls)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and XLSX files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/upload - Upload CSV/XLSX file and process with worker threads
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let csvData = '';

    // Handle XLSX files
    if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        req.file.originalname.endsWith('.xlsx') || 
        req.file.originalname.endsWith('.xls')) {
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      csvData = XLSX.utils.sheet_to_csv(worksheet);
    } else {
      // Handle CSV files
      csvData = await fs.readFile(req.file.path, 'utf-8');
    }

    // Start worker thread to process CSV
    const worker = new Worker(path.join(__dirname, '../workers/csvProcessor.js'), {
      workerData: { csvData }
    });

    const result = {
      status: 'processing',
      message: 'File upload successful. Processing started.',
      file: req.file.originalname
    };

    // Send immediate response
    res.status(202).json(result);

    // Handle worker messages
    worker.on('message', (message) => {
      if (message.type === 'progress') {
        console.log(`Progress: ${message.processed}/${message.total} records processed`);
      } else if (message.type === 'done') {
        console.log(`Processing complete: ${message.processed} records processed, ${message.errors} errors`);
        // Clean up uploaded file
        fs.unlink(req.file.path).catch(console.error);
      } else if (message.type === 'error') {
        console.error('Worker error:', message.error);
        // Clean up uploaded file
        fs.unlink(req.file.path).catch(console.error);
      }
    });

    worker.on('error', (error) => {
      console.error('Worker thread error:', error);
      // Clean up uploaded file
      fs.unlink(req.file.path).catch(console.error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && req.file.path) {
      fs.unlink(req.file.path).catch(console.error);
    }

    res.status(500).json({ 
      error: 'Error processing file', 
      message: error.message 
    });
  }
});

module.exports = router;

