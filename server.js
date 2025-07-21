// server.js

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs'); // Import the entire fs module
const fsp = fs.promises; // Access the promise-based methods
const { VersionedTransaction, Connection, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const path = require('path');

const app = express();

// Multer Configuration for File Uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Environment Variables
const RPC_ENDPOINT = process.env.RPC_ENDPOINT;
const PRIVATE_KEYS = process.env.PRIVATE_KEYS; // Comma-separated private keys
const PUBLIC_KEY = process.env.PUBLIC_KEY;
const PORT = process.env.PORT || 3000;

// Validate Environment Variables
if (!RPC_ENDPOINT || !PRIVATE_KEYS || !PUBLIC_KEY) {
  console.error('Error: Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

// Initialize Connection
const web3Connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Decode the private keys from Base58 and create Keypairs
let signerKeyPairs;
try {
  signerKeyPairs = PRIVATE_KEYS.split(',').map((key) => Keypair.fromSecretKey(bs58.decode(key.trim())));
  if (signerKeyPairs.length === 0 || signerKeyPairs.length > 5) {
    throw new Error('Number of signer keys must be between 1 and 5.');
  }
} catch (error) {
  console.error('Failed to decode PRIVATE_KEYS:', error);
  process.exit(1);
}

// Serve Static Files from the 'public' Directory
app.use(express.static('public'));

// Error-handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: err.message });
});

// Route to Handle Token Creation with Bundled Transactions
app.post('/create-token', upload.single('image'), async (req, res) => {
  try {
    // Check if the file was uploaded
    if (!req.file) {
      throw new Error('No image file uploaded. Please upload an image.');
    }

    // Log receipt of the file
    console.log('Received file:', req.file.originalname);

    // Capture and validate the amount from the form (in token units)
    const amount = parseInt(req.body.amount, 10);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount specified. Please enter a valid number greater than 0.');
    }

    // Capture and validate the priority fee from the form
    const priorityFee = parseFloat(req.body.priorityFee);
    if (isNaN(priorityFee) || priorityFee < 0) {
      throw new Error('Invalid priority fee specified. Please enter a non-negative number.');
    }

    // Check wallet balance for all signers (ensure they have enough SOL for fees)
    for (let i = 0; i < signerKeyPairs.length; i++) {
      const balance = await web3Connection.getBalance(signerKeyPairs[i].publicKey);
      console.log(`Wallet ${i + 1} Balance:`, (balance / 1e9).toFixed(9), 'SOL');

      const requiredLamports = 0.001 * 1e9; // Assuming 0.001 SOL needed for fees
      if (balance < requiredLamports) {
        throw new Error(`Insufficient SOL in Wallet ${i + 1}. Your wallet has ${(balance / 1e9).toFixed(9)} SOL, but ${0.001} SOL is required for fees.`);
      }
    }

    const mintKeypair = Keypair.generate();

    // Prepare FormData for metadata upload
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path)); // Use fs.createReadStream
    formData.append('name', req.body.name);
    formData.append('symbol', req.body.symbol);
    formData.append('description', req.body.description); // Consolidated description
    formData.append('twitter', req.body.twitter);
    formData.append('telegram', req.body.telegram);
    formData.append('website', req.body.website);
    formData.append('showName', 'true');

    // Upload metadata to IPFS
    const metadataResponse = await fetch('https://pump.fun/api/ipfs', {
      method: 'POST',
      body: formData,
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      throw new Error(`Failed to upload metadata to IPFS: ${errorText}`);
    }

    const metadataResponseJSON = await metadataResponse.json();
    console.log('Metadata uploaded to IPFS:', metadataResponseJSON.metadataUri);

    // Prepare Bundled Transaction Arguments
    const bundledTxArgs = signerKeyPairs.map((signer, index) => ({
      publicKey: signer.publicKey.toBase58(),
      action: index === 0 ? 'create' : 'buy', // First signer creates, others buy
      tokenMetadata: index === 0 ? {
        name: req.body.name,
        symbol: req.body.symbol,
        uri: metadataResponseJSON.metadataUri
      } : undefined, // Only 'create' action needs tokenMetadata
      mint: mintKeypair.publicKey.toBase58(),
      denominatedInSol: 'false', // Changed to boolean
      amount: amount, // Amount in token units
      slippage: 50, // Adjust slippage as per your requirement
      priorityFee: index === 0 ? 0.001 : 0.0005, // Increased priority fees
      pool: 'pump'
    }));

    // Log the bundled transaction arguments for debugging
    console.log('Bundled Transaction Arguments:', JSON.stringify(bundledTxArgs, null, 2));

    // Send Bundled Transactions to Pumpportal.fun API
    const response = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bundledTxArgs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get transactions from PumpPortal: ${errorText}`);
    }

    const transactions = await response.json(); // Assuming it's an array of serialized transactions
    console.log('Received bundled transactions:', transactions);

    if (!Array.isArray(transactions) || transactions.length !== bundledTxArgs.length) {
      throw new Error('Mismatch between bundled transaction arguments and received transactions.');
    }

    // Sign Transactions
    let encodedSignedTransactions = [];
    let signatures = [];

    for (let i = 0; i < bundledTxArgs.length; i++) {
      const txData = bs58.decode(transactions[i]);
      const tx = VersionedTransaction.deserialize(txData);

      if (bundledTxArgs[i].action === 'create') {
        tx.sign([mintKeypair, signerKeyPairs[i]]);
      } else {
        tx.sign([signerKeyPairs[i]]);
      }

      const serializedTx = tx.serialize();
      const encodedTx = bs58.encode(serializedTx);
      encodedSignedTransactions.push(encodedTx);

      const signature = tx.signatures[0];
      if (!signature) {
        throw new Error(`Transaction ${i + 1} failed to sign.`);
      }
      signatures.push(bs58.encode(signature));
    }

    // Log the signatures for verification
    console.log('Signed Transaction Signatures:', signatures);

    // Send the bundle to Jito API
    try {
      const jitoResponse = await fetch('https://mainnet.block-engine.jito.wtf/api/v1/bundles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [encodedSignedTransactions]
        })
      });

      const jitoResponseJSON = await jitoResponse.json();
      console.log('Jito API Response:', JSON.stringify(jitoResponseJSON, null, 2));
      
      if (jitoResponse.ok && jitoResponseJSON.result) {
        // Assuming jitoResponseJSON.result contains a confirmation or bundle ID
        res.json({
          message: 'Bundled transactions sent successfully!',
          jitoResult: jitoResponseJSON.result,
          signatures: signatures.map(sig => `https://solscan.io/tx/${sig}`)
        });
      } else {
        throw new Error(`Jito API Error: ${JSON.stringify(jitoResponseJSON)}`);
      }
    } catch (e) {
      console.error('Error sending bundle to Jito:', e.message);
      res.status(500).json({ error: e.message });
    }

    // Clean up uploaded file
    await fsp.unlink(req.file.path);
  } catch (error) {
    console.error('Error:', error);

    // Clean up uploaded file if it exists
    if (req.file && req.file.path) {
      try {
        await fsp.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded file:', cleanupError);
      }
    }

    res.status(500).json({ error: error.message });
  }
});

// Start the Server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
