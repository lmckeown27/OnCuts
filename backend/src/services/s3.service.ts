import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'campuscuts-media';

/**
 * Upload file to S3
 */
export const uploadToS3 = async (
  file: Express.Multer.File,
  folder: string = 'general'
): Promise<string> => {
  try {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

    const params: AWS.S3.PutObjectRequest = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    };

    const result = await s3.upload(params).promise();
    logger.info(`File uploaded to S3: ${result.Location}`);

    return result.Location;
  } catch (error) {
    logger.error('S3 upload failed:', error);
    throw new ApiError(500, 'File upload failed');
  }
};

/**
 * Delete file from S3
 */
export const deleteFromS3 = async (fileUrl: string): Promise<void> => {
  try {
    const fileName = fileUrl.split('/').pop();
    
    if (!fileName) {
      throw new Error('Invalid file URL');
    }

    const params: AWS.S3.DeleteObjectRequest = {
      Bucket: BUCKET_NAME,
      Key: fileName,
    };

    await s3.deleteObject(params).promise();
    logger.info(`File deleted from S3: ${fileName}`);
  } catch (error) {
    logger.error('S3 deletion failed:', error);
    throw new ApiError(500, 'File deletion failed');
  }
};

/**
 * Generate presigned URL for temporary access
 */
export const generatePresignedUrl = async (
  fileName: string,
  expiresIn: number = 3600
): Promise<string> => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Expires: expiresIn,
    };

    const url = await s3.getSignedUrlPromise('getObject', params);
    return url;
  } catch (error) {
    logger.error('Failed to generate presigned URL:', error);
    throw new ApiError(500, 'Failed to generate download link');
  }
};

