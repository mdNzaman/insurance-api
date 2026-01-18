const { parentPort, workerData } = require('worker_threads');
const { parse } = require('csv-parse/sync');
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Agent = require('../models/Agent');
const User = require('../models/User');
const UserAccount = require('../models/UserAccount');
const LOB = require('../models/LOB');
const Carrier = require('../models/Carrier');
const Policy = require('../models/Policy');

const processCSV = async (csvData) => {
  try {
    // Connect to MongoDB in worker thread
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/insured-mine';
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Parse CSV
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    let processed = 0;
    let errors = 0;
    const errorsList = [];

    // Cache for IDs to avoid duplicate queries
    const agentCache = new Map();
    const lobCache = new Map();
    const carrierCache = new Map();
    const userCache = new Map();
    const accountCache = new Map();

    // Helper function to get or create Agent
    const getOrCreateAgent = async (agentName) => {
      if (!agentName) return null;
      
      if (agentCache.has(agentName)) {
        return agentCache.get(agentName);
      }

      let agent = await Agent.findOne({ name: agentName });
      if (!agent) {
        agent = await Agent.create({ name: agentName });
      }
      agentCache.set(agentName, agent._id);
      return agent._id;
    };

    // Helper function to get or create LOB
    const getOrCreateLOB = async (categoryName) => {
      if (!categoryName) return null;
      
      if (lobCache.has(categoryName)) {
        return lobCache.get(categoryName);
      }

      let lob = await LOB.findOne({ category_name: categoryName });
      if (!lob) {
        lob = await LOB.create({ category_name: categoryName });
      }
      lobCache.set(categoryName, lob._id);
      return lob._id;
    };

    // Helper function to get or create Carrier
    const getOrCreateCarrier = async (companyName) => {
      if (!companyName) return null;
      
      if (carrierCache.has(companyName)) {
        return carrierCache.get(companyName);
      }

      let carrier = await Carrier.findOne({ company_name: companyName });
      if (!carrier) {
        carrier = await Carrier.create({ company_name: companyName });
      }
      carrierCache.set(companyName, carrier._id);
      return carrier._id;
    };

    // Helper function to get or create UserAccount
    const getOrCreateUserAccount = async (accountName) => {
      if (!accountName) return null;
      
      if (accountCache.has(accountName)) {
        return accountCache.get(accountName);
      }

      let account = await UserAccount.findOne({ account_name: accountName });
      if (!account) {
        account = await UserAccount.create({ account_name: accountName });
      }
      accountCache.set(accountName, account._id);
      return account._id;
    };

    // Helper function to get or create User
    const getOrCreateUser = async (userData) => {
      const userKey = `${userData.firstname}_${userData.email}_${userData.dob}`;
      
      if (userCache.has(userKey)) {
        return userCache.get(userKey);
      }

      // Parse DOB
      let dob = null;
      if (userData.dob) {
        dob = new Date(userData.dob);
        if (isNaN(dob.getTime())) {
          dob = null;
        }
      }

      // Try to find existing user by firstname and email
      let user = null;
      if (userData.firstname && userData.email) {
        user = await User.findOne({ 
          firstname: userData.firstname,
          email: userData.email 
        });
      }

      if (!user) {
        user = await User.create({
          firstname: userData.firstname || '',
          dob: dob,
          address: userData.address || '',
          phone: userData.phone || '',
          state: userData.state || '',
          zip: userData.zip || '',
          email: userData.email || '',
          gender: userData.gender || '',
          userType: userData.userType || ''
        });
      }

      userCache.set(userKey, user._id);
      return user._id;
    };

    // Process records in batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const record of batch) {
        try {
          // Get or create related entities
          const agentId = await getOrCreateAgent(record.agent);
          const lobId = await getOrCreateLOB(record.category_name);
          const carrierId = await getOrCreateCarrier(record.company_name);
          
          // Create or get user
          const userId = await getOrCreateUser({
            firstname: record.firstname,
            dob: record.dob,
            address: record.address,
            phone: record.phone,
            state: record.state,
            zip: record.zip,
            email: record.email,
            gender: record.gender,
            userType: record.userType
          });

          // Create or get user account
          await getOrCreateUserAccount(record.account_name);

          // Parse dates
          let startDate = null;
          let endDate = null;
          if (record.policy_start_date) {
            startDate = new Date(record.policy_start_date);
            if (isNaN(startDate.getTime())) startDate = null;
          }
          if (record.policy_end_date) {
            endDate = new Date(record.policy_end_date);
            if (isNaN(endDate.getTime())) endDate = null;
          }

          // Create policy if policy_number exists
          if (record.policy_number && lobId && carrierId && userId && startDate && endDate) {
            const existingPolicy = await Policy.findOne({ policy_number: record.policy_number });
            if (!existingPolicy) {
              await Policy.create({
                policy_number: record.policy_number,
                policy_start_date: startDate,
                policy_end_date: endDate,
                policy_category_id: lobId,
                company_collection_id: carrierId,
                user_id: userId
              });
            }
          }

          processed++;
          
          // Send progress update to main thread
          if (processed % 50 === 0) {
            parentPort.postMessage({ 
              type: 'progress', 
              processed, 
              total: records.length 
            });
          }
        } catch (error) {
          errors++;
          errorsList.push({
            row: i + batch.indexOf(record) + 1,
            error: error.message,
            record: record.policy_number || 'N/A'
          });
        }
      }
    }

    await mongoose.connection.close();

    parentPort.postMessage({
      type: 'done',
      success: true,
      processed,
      errors,
      total: records.length,
      errorsList: errorsList.slice(0, 10) // Send first 10 errors
    });
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      error: error.message
    });
  }
};

// Start processing
if (workerData && workerData.csvData) {
  processCSV(workerData.csvData).catch(error => {
    parentPort.postMessage({
      type: 'error',
      error: error.message || 'Unknown error occurred'
    });
  });
}

