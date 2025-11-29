/**
 * IPFS Service
 * 
 * Handles decentralized storage for:
 * - Profile pictures
 * - Portfolio images
 * - Review text (long reviews)
 * - Chat messages (encrypted)
 * 
 * Uses Pinata for reliable pinning + IPFS network for distribution
 */

import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';
import { logger } from '../utils/logger';

interface IPFSUploadResult {
  cid: string;
  url: string;
  size: number;
}

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

class IPFSService {
  private pinataApiKey: string;
  private pinataSecretApiKey: string;
  private pinataJWT: string;
  private gatewayUrl: string;

  constructor() {
    this.pinataApiKey = process.env.PINATA_API_KEY || '';
    this.pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY || '';
    this.pinataJWT = process.env.PINATA_JWT || '';
    this.gatewayUrl = process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs';

    if (!this.pinataJWT && (!this.pinataApiKey || !this.pinataSecretApiKey)) {
      logger.warn('⚠️  IPFS service not fully configured - using public gateways only');
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  IMAGE UPLOAD & OPTIMIZATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Upload and optimize a profile picture
   * Resizes to 500x500, optimizes quality, uploads to IPFS
   */
  async uploadProfilePicture(imageBuffer: Buffer, filename: string): Promise<IPFSUploadResult> {
    try {
      logger.info(`📸 Optimizing profile picture: ${filename}`);

      // Optimize image
      const optimized = await sharp(imageBuffer)
        .resize(500, 500, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toBuffer();

      logger.info(`✅ Image optimized: ${imageBuffer.length} → ${optimized.length} bytes (${Math.round((1 - optimized.length / imageBuffer.length) * 100)}% reduction)`);

      // Upload to IPFS
      return await this.uploadBuffer(optimized, `profile-${filename}`);
    } catch (error) {
      logger.error('Failed to upload profile picture:', error);
      throw new Error('Failed to upload profile picture to IPFS');
    }
  }

  /**
   * Upload portfolio image (barber showcase)
   * Larger size (1200x1200), high quality
   */
  async uploadPortfolioImage(imageBuffer: Buffer, filename: string): Promise<IPFSUploadResult> {
    try {
      logger.info(`🖼️  Optimizing portfolio image: ${filename}`);

      // Optimize image (higher quality for portfolio)
      const optimized = await sharp(imageBuffer)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 90,
          progressive: true,
        })
        .toBuffer();

      logger.info(`✅ Portfolio image optimized: ${imageBuffer.length} → ${optimized.length} bytes`);

      // Upload to IPFS
      return await this.uploadBuffer(optimized, `portfolio-${filename}`);
    } catch (error) {
      logger.error('Failed to upload portfolio image:', error);
      throw new Error('Failed to upload portfolio image to IPFS');
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TEXT/DATA UPLOAD
  // ═══════════════════════════════════════════════════════════

  /**
   * Upload text data (e.g., review text, bio)
   * Useful for reviews longer than smart contract storage allows
   */
  async uploadText(text: string, filename?: string): Promise<IPFSUploadResult> {
    try {
      const buffer = Buffer.from(text, 'utf-8');
      return await this.uploadBuffer(buffer, filename || 'text-content.txt');
    } catch (error) {
      logger.error('Failed to upload text to IPFS:', error);
      throw new Error('Failed to upload text to IPFS');
    }
  }

  /**
   * Upload JSON data (e.g., encrypted chat logs, metadata)
   */
  async uploadJSON(data: object, filename?: string): Promise<IPFSUploadResult> {
    try {
      const json = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(json, 'utf-8');
      return await this.uploadBuffer(buffer, filename || 'data.json');
    } catch (error) {
      logger.error('Failed to upload JSON to IPFS:', error);
      throw new Error('Failed to upload JSON to IPFS');
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  CORE UPLOAD FUNCTION (Pinata)
  // ═══════════════════════════════════════════════════════════

  /**
   * Upload a buffer to IPFS via Pinata
   * Returns CID and gateway URL
   */
  private async uploadBuffer(buffer: Buffer, filename: string): Promise<IPFSUploadResult> {
    try {
      const formData = new FormData();
      formData.append('file', buffer, filename);

      // Optional: Add metadata
      const metadata = JSON.stringify({
        name: filename,
        keyvalues: {
          platform: 'CampusCuts',
          uploadedAt: new Date().toISOString(),
        },
      });
      formData.append('pinataMetadata', metadata);

      // Optional: Pin options
      const options = JSON.stringify({
        cidVersion: 1, // Use CIDv1 (more modern)
      });
      formData.append('pinataOptions', options);

      // Upload to Pinata
      const response = await axios.post<PinataResponse>(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${this.pinataJWT}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      const cid = response.data.IpfsHash;
      const url = `${this.gatewayUrl}/${cid}`;
      const size = response.data.PinSize;

      logger.info(`✅ Uploaded to IPFS: ${cid} (${size} bytes)`);

      return { cid, url, size };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Pinata API error:', error.response?.data || error.message);
      } else {
        logger.error('Failed to upload to Pinata:', error);
      }
      throw new Error('Failed to upload to IPFS');
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  RETRIEVAL & UTILITIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Get gateway URL for a CID
   * Users access IPFS content via gateways (like regular URLs)
   */
  getGatewayUrl(cid: string): string {
    return `${this.gatewayUrl}/${cid}`;
  }

  /**
   * Fetch content from IPFS
   * Useful for verifying uploads or retrieving text data
   */
  async fetchContent(cid: string): Promise<Buffer> {
    try {
      const url = this.getGatewayUrl(cid);
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      logger.error(`Failed to fetch IPFS content (${cid}):`, error);
      throw new Error('Failed to fetch IPFS content');
    }
  }

  /**
   * Fetch and parse JSON from IPFS
   */
  async fetchJSON<T = any>(cid: string): Promise<T> {
    try {
      const buffer = await this.fetchContent(cid);
      return JSON.parse(buffer.toString('utf-8'));
    } catch (error) {
      logger.error(`Failed to parse JSON from IPFS (${cid}):`, error);
      throw new Error('Failed to parse JSON from IPFS');
    }
  }

  /**
   * Fetch text from IPFS
   */
  async fetchText(cid: string): Promise<string> {
    try {
      const buffer = await this.fetchContent(cid);
      return buffer.toString('utf-8');
    } catch (error) {
      logger.error(`Failed to fetch text from IPFS (${cid}):`, error);
      throw new Error('Failed to fetch text from IPFS');
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  PIN MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  /**
   * Check if a CID is pinned
   * Ensures content availability
   */
  async isPinned(cid: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `https://api.pinata.cloud/data/pinList?hashContains=${cid}`,
        {
          headers: {
            Authorization: `Bearer ${this.pinataJWT}`,
          },
        }
      );
      return response.data.count > 0;
    } catch (error) {
      logger.error(`Failed to check pin status for ${cid}:`, error);
      return false;
    }
  }

  /**
   * Unpin content (admin only, for content moderation)
   * Note: Content may still exist on IPFS network, just not guaranteed by Pinata
   */
  async unpin(cid: string): Promise<void> {
    try {
      await axios.delete(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
        headers: {
          Authorization: `Bearer ${this.pinataJWT}`,
        },
      });
      logger.info(`📌 Unpinned from IPFS: ${cid}`);
    } catch (error) {
      logger.error(`Failed to unpin ${cid}:`, error);
      throw new Error('Failed to unpin from IPFS');
    }
  }

  /**
   * Get list of all pinned files
   * Useful for admin dashboard
   */
  async listPinnedFiles(limit: number = 100): Promise<any[]> {
    try {
      const response = await axios.get(
        `https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.pinataJWT}`,
          },
        }
      );
      return response.data.rows || [];
    } catch (error) {
      logger.error('Failed to list pinned files:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  COST ESTIMATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Get total storage used (in bytes)
   * Pinata free tier: 1GB storage
   * Paid tier: $20/month for 100GB
   */
  async getTotalStorageUsed(): Promise<number> {
    try {
      const pins = await this.listPinnedFiles(1000);
      return pins.reduce((total, pin) => total + (pin.size || 0), 0);
    } catch (error) {
      logger.error('Failed to calculate storage:', error);
      return 0;
    }
  }

  /**
   * Estimate monthly cost based on usage
   */
  async estimateMonthlyCost(): Promise<number> {
    try {
      const totalBytes = await this.getTotalStorageUsed();
      const totalGB = totalBytes / (1024 ** 3);

      // Pinata pricing (as of 2024):
      // Free: 1GB
      // Paid: $20/month for 100GB
      if (totalGB <= 1) {
        return 0; // Free tier
      } else {
        return 20; // Paid tier
      }
    } catch (error) {
      logger.error('Failed to estimate cost:', error);
      return 0;
    }
  }
}

// Export singleton instance
export default new IPFSService();

