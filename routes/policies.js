const express = require('express');
const Policy = require('../models/Policy');
const User = require('../models/User');
const LOB = require('../models/LOB');
const Carrier = require('../models/Carrier');

const router = express.Router();

// GET /api/policies/search?username=John - Search policies by username
router.get('/search', async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ error: 'Username parameter is required' });
    }

    // Find user by firstname (username)
    const users = await User.find({ 
      firstname: { $regex: new RegExp(username, 'i') } 
    });

    if (users.length === 0) {
      return res.status(404).json({ 
        message: 'No user found with the provided username',
        policies: [] 
      });
    }

    const userIds = users.map(user => user._id);

    // Find all policies for these users
    const policies = await Policy.find({ user_id: { $in: userIds } })
      .populate('policy_category_id', 'category_name')
      .populate('company_collection_id', 'company_name')
      .populate('user_id', 'firstname email phone address state zip dob')
      .lean();

    // Format response
    const formattedPolicies = policies.map(policy => ({
      policy_number: policy.policy_number,
      policy_start_date: policy.policy_start_date,
      policy_end_date: policy.policy_end_date,
      policy_category: policy.policy_category_id?.category_name || null,
      company_name: policy.company_collection_id?.company_name || null,
      user: {
        id: policy.user_id._id,
        firstname: policy.user_id.firstname,
        email: policy.user_id.email,
        phone: policy.user_id.phone,
        address: policy.user_id.address,
        state: policy.user_id.state,
        zip: policy.user_id.zip,
        dob: policy.user_id.dob
      }
    }));

    res.json({
      message: `Found ${policies.length} policy(s) for username: ${username}`,
      count: policies.length,
      policies: formattedPolicies
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Error searching policies', 
      message: error.message 
    });
  }
});

// GET /api/policies/aggregated - Get aggregated policies by user
router.get('/aggregated', async (req, res) => {
  try {
    // Aggregate policies by user
    const aggregatedPolicies = await Policy.aggregate([
      {
        $group: {
          _id: '$user_id',
          policy_count: { $sum: 1 },
          policies: {
            $push: {
              policy_number: '$policy_number',
              policy_start_date: '$policy_start_date',
              policy_end_date: '$policy_end_date',
              policy_category_id: '$policy_category_id',
              company_collection_id: '$company_collection_id'
            }
          }
        }
      },
      {
        $sort: { policy_count: -1 }
      }
    ]);

    // Populate user details and related entities
    const result = await Promise.all(
      aggregatedPolicies.map(async (item) => {
        const user = await User.findById(item._id).lean();
        if (!user) return null;

        // Populate policy details
        const policiesWithDetails = await Promise.all(
          item.policies.map(async (policy) => {
            const lob = policy.policy_category_id 
              ? await LOB.findById(policy.policy_category_id).lean() 
              : null;
            const carrier = policy.company_collection_id 
              ? await Carrier.findById(policy.company_collection_id).lean() 
              : null;

            return {
              policy_number: policy.policy_number,
              policy_start_date: policy.policy_start_date,
              policy_end_date: policy.policy_end_date,
              policy_category: lob?.category_name || null,
              company_name: carrier?.company_name || null
            };
          })
        );

        return {
          user: {
            id: user._id,
            firstname: user.firstname,
            email: user.email,
            phone: user.phone,
            address: user.address,
            state: user.state,
            zip: user.zip,
            dob: user.dob,
            gender: user.gender,
            userType: user.userType
          },
          policy_count: item.policy_count,
          policies: policiesWithDetails
        };
      })
    );

    // Filter out null values (users that might have been deleted)
    const filteredResult = result.filter(item => item !== null);

    res.json({
      message: `Found ${filteredResult.length} user(s) with policies`,
      total_users: filteredResult.length,
      total_policies: filteredResult.reduce((sum, item) => sum + item.policy_count, 0),
      data: filteredResult
    });

  } catch (error) {
    console.error('Aggregation error:', error);
    res.status(500).json({ 
      error: 'Error aggregating policies', 
      message: error.message 
    });
  }
});

module.exports = router;

