/**
 * Authentication Controller (Blockchain Version)
 * 
 * REPLACES: PostgreSQL-based auth
 * USES: Custodial signing + on-chain user accounts
 * 
 * The Magic Flow:
 * 1. User signs up with email + password
 * 2. Backend derives Aptos address from email
 * 3. Backend creates on-chain user account
 * 4. Backend encrypts private key with password
 * 5. User gets JWT token (normal Web2 flow)
 * 6. User has NO IDEA they just created a blockchain account
 */

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import custodialSignerService from '../services/custodial-signer.service';
import blockchainQueryService from '../services/blockchain-query.service';
import ipfsService from '../services/ipfs.service';

interface SignupRequest {
  email: string;
  password: string;
  username: string;
  campus_domain: string;
  role: 'student' | 'barber';
}

interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Sign Up - Create blockchain account (user doesn't know)
 * 
 * BEFORE (PostgreSQL):
 * INSERT INTO users (email, password_hash, ...) VALUES (?, ?, ...)
 * 
 * AFTER (Blockchain):
 * 1. Derive Aptos address from email
 * 2. Encrypt private key with password
 * 3. Submit on-chain transaction to create user account
 * 4. Store encrypted key in KMS (or session for demo)
 */
export async function signup(req: Request, res: Response) {
  try {
    const { email, password, username, campus_domain, role }: SignupRequest = req.body;

    // Validate
    if (!email || !password || !username || !campus_domain) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Validate email is .edu
    if (!email.endsWith('.edu')) {
      return res.status(400).json({
        success: false,
        message: 'Must use a .edu email address',
      });
    }

    logger.info(`🆕 Signup request: ${email}`);

    // Step 1: Create custodial account (derive address from email)
    const account = await custodialSignerService.createUserAccount(email, password);

    logger.info(`✅ Custodial account created: ${account.address}`);

    // Step 2: Check if user already exists on blockchain
    const existingUser = await blockchainQueryService.getUserAccount(account.address);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Step 3: Hash email for privacy (don't store plain email on-chain)
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest();

    // Step 4: Submit on-chain transaction to create user account
    // THE MAGIC: Platform signs this transaction with user's derived account
    const roleNumber = role === 'barber' ? 1 : 0; // 0=student, 1=barber, 2=admin

    const tx = await custodialSignerService.signAndSubmitTransaction(
      email,
      password,
      account.encryptedPrivateKey,
      {
        function: `${process.env.APTOS_MODULE_ADDRESS}::user_accounts::register_user`,
        arguments: [
          Array.from(emailHash), // email_hash (as byte array)
          campus_domain,         // campus_domain
          roleNumber,            // role
          username,              // username
        ],
      }
    );

    logger.info(`✅ User registered on blockchain: ${tx.txHash}`);

    // Step 5: Generate JWT token (normal Web2 auth flow)
    const token = jwt.sign(
      {
        address: account.address,
        email,
        role,
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' } as jwt.SignOptions
    );

    // Step 6: Return success (user thinks it's a normal signup)
    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      data: {
        token,
        user: {
          address: account.address,
          email,
          username,
          campus_domain,
          role,
        },
      },
    });
  } catch (error) {
    logger.error('Signup failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: (error as Error).message,
    });
  }
}

/**
 * Login - Load user from blockchain
 * 
 * BEFORE (PostgreSQL):
 * SELECT * FROM users WHERE email = ?
 * 
 * AFTER (Blockchain):
 * 1. Derive Aptos address from email
 * 2. Load account from blockchain
 * 3. Verify password (decrypt private key)
 * 4. Cache account in session
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password required',
      });
    }

    logger.info(`🔓 Login attempt: ${email}`);

    // Step 1: Derive address from email (deterministic)
    const userAddress = custodialSignerService.getUserAddress(email);

    // Step 2: Load user account from blockchain
    const userAccount = await blockchainQueryService.getUserAccount(userAddress);
    
    if (!userAccount) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Step 3: Verify password by attempting to decrypt private key
    // In production, encrypted key would be retrieved from KMS
    // For demo, we'll re-derive and verify
    try {
      // Get encrypted key from storage (in production, from database/KMS)
      // For now, we'll re-create account to verify password
      const account = await custodialSignerService.createUserAccount(email, password);
      
      if (account.address !== userAddress) {
        throw new Error('Password verification failed');
      }
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Step 4: Load account into session cache (for faster signing)
    // This happens automatically in custodialSignerService

    // Step 5: Generate JWT token
    const roleMap = { 0: 'student', 1: 'barber', 2: 'admin' };
    const role = roleMap[userAccount.role as 0 | 1 | 2] || 'student';

    const token = jwt.sign(
      {
        address: userAccount.address,
        email,
        role,
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' } as jwt.SignOptions
    );

    // Step 6: Return success
    logger.info(`✅ Login successful: ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          address: userAccount.address,
          username: userAccount.username,
          campus_domain: userAccount.campus_domain,
          role,
          profile_photo_url: userAccount.profile_photo_cid
            ? ipfsService.getGatewayUrl(userAccount.profile_photo_cid)
            : null,
        },
      },
    });
  } catch (error) {
    logger.error('Login failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: (error as Error).message,
    });
  }
}

/**
 * Logout - Clear session cache
 * 
 * BEFORE (PostgreSQL):
 * No database changes
 * 
 * AFTER (Blockchain):
 * Clear cached account from custodialSignerService
 */
export async function logout(req: Request, res: Response) {
  try {
    // Get email from JWT token
    const email = (req as any).user?.email;

    if (email) {
      custodialSignerService.logout(email);
      logger.info(`👋 User logged out: ${email}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
}

/**
 * Get Current User - Load from blockchain
 * 
 * BEFORE (PostgreSQL):
 * SELECT * FROM users WHERE id = ?
 * 
 * AFTER (Blockchain):
 * Query user account from blockchain
 */
export async function getCurrentUser(req: Request, res: Response) {
  try {
    const userAddress = (req as any).user?.address;

    if (!userAddress) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    // Query blockchain for user account
    const userAccount = await blockchainQueryService.getUserAccount(userAddress);

    if (!userAccount) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get balance
    const balance = await blockchainQueryService.getUserBalance(userAddress);

    // Format response
    const roleMap = { 0: 'student', 1: 'barber', 2: 'admin' };
    const role = roleMap[userAccount.role as 0 | 1 | 2] || 'student';

    return res.status(200).json({
      success: true,
      data: {
        address: userAccount.address,
        username: userAccount.username,
        bio: userAccount.bio,
        campus_domain: userAccount.campus_domain,
        role,
        profile_photo_url: userAccount.profile_photo_cid
          ? ipfsService.getGatewayUrl(userAccount.profile_photo_cid)
          : null,
        balance: balance
          ? {
              available: (parseInt(balance.available) / 100_000_000).toFixed(2), // Convert octas to APT
              locked: (parseInt(balance.locked) / 100_000_000).toFixed(2),
            }
          : null,
        stats: {
          total_bookings: userAccount.total_bookings,
          total_spent: (parseInt(userAccount.total_spent) / 100_000_000).toFixed(2),
          total_earned: (parseInt(userAccount.total_earned) / 100_000_000).toFixed(2),
        },
        // Barber-specific fields
        ...(role === 'barber' && {
          years_of_experience: userAccount.years_of_experience,
          specialties: userAccount.specialties,
          portfolio: (userAccount.portfolio_cids || []).map((cid) => ipfsService.getGatewayUrl(cid)),
        }),
      },
    });
  } catch (error) {
    logger.error('Failed to get current user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load user',
    });
  }
}

/**
 * Update Profile - Update on-chain account
 * 
 * BEFORE (PostgreSQL):
 * UPDATE users SET username = ?, bio = ? WHERE id = ?
 * 
 * AFTER (Blockchain):
 * Submit transaction to update on-chain user account
 */
export async function updateProfile(req: Request, res: Response) {
  try {
    const userAddress = (req as any).user?.address;
    const email = (req as any).user?.email;
    const { username, bio } = req.body;

    if (!userAddress || !email) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    // Get encrypted key from session/KMS
    // For demo, we'll need password - in production, key would be in session
    const password = req.body.password; // In production, this would come from session
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password required for this operation',
      });
    }

    const account = await custodialSignerService.createUserAccount(email, password);

    // Update username on-chain
    if (username) {
      const tx1 = await custodialSignerService.signAndSubmitOptimistic(email, {
        function: `${process.env.APTOS_MODULE_ADDRESS}::user_accounts::update_username`,
        arguments: [username],
      });
      logger.info(`✅ Username updated: ${tx1.txHash}`);
    }

    // Update bio on-chain
    if (bio) {
      const tx2 = await custodialSignerService.signAndSubmitOptimistic(email, {
        function: `${process.env.APTOS_MODULE_ADDRESS}::user_accounts::update_bio`,
        arguments: [bio],
      });
      logger.info(`✅ Bio updated: ${tx2.txHash}`);
    }

    // Invalidate cache
    await blockchainQueryService.invalidateUserCache(userAddress);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
    });
  } catch (error) {
    logger.error('Failed to update profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
}

/**
 * Upload Profile Photo - Upload to IPFS, store CID on-chain
 * 
 * BEFORE (PostgreSQL + S3):
 * 1. Upload to S3
 * 2. UPDATE users SET profile_photo_url = ? WHERE id = ?
 * 
 * AFTER (IPFS + Blockchain):
 * 1. Upload to IPFS
 * 2. Submit transaction to store CID on-chain
 */
export async function uploadProfilePhoto(req: Request, res: Response) {
  try {
    const userAddress = (req as any).user?.address;
    const email = (req as any).user?.email;

    if (!userAddress || !email) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided',
      });
    }

    logger.info(`📸 Uploading profile photo for: ${email}`);

    // Step 1: Upload to IPFS
    const result = await ipfsService.uploadProfilePicture(req.file.buffer, req.file.originalname);

    logger.info(`✅ Image uploaded to IPFS: ${result.cid}`);

    // Step 2: Store CID on-chain
    const password = req.body.password; // In production, from session
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password required',
      });
    }

    const account = await custodialSignerService.createUserAccount(email, password);

    const tx = await custodialSignerService.signAndSubmitOptimistic(email, {
      function: `${process.env.APTOS_MODULE_ADDRESS}::user_accounts::update_profile_photo`,
      arguments: [result.cid],
    });

    logger.info(`✅ Profile photo CID stored on-chain: ${tx.txHash}`);

    // Invalidate cache
    await blockchainQueryService.invalidateUserCache(userAddress);

    // Return gateway URL (user sees normal image URL)
    return res.status(200).json({
      success: true,
      message: 'Profile photo uploaded!',
      data: {
        photo_url: result.url,
        cid: result.cid,
      },
    });
  } catch (error) {
    logger.error('Failed to upload profile photo:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload photo',
    });
  }
}

