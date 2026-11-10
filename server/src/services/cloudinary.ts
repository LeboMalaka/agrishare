import { createHash } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';

import { HttpError } from '../lib/http-error';

const equipmentFolder = 'agrishare/equipment';
const operatorDocumentsFolder = 'agrishare/operators';

function cloudinaryCredentials() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpError('Cloudinary uploads are not configured on this server', 503);
  }

  return { cloudName, apiKey, apiSecret };
}

function cloudinaryErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof error.error === 'object' &&
    error.error !== null &&
    'message' in error.error &&
    typeof error.error.message === 'string'
  ) {
    return error.error.message;
  }
  return error instanceof Error ? error.message : 'Cloudinary returned an unknown error';
}

function isNetworkError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const isKnownNetworkCode = [
    'EAI_AGAIN',
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
  ].includes(code);
  const message = error instanceof Error ? error.message : '';
  return isKnownNetworkCode || /\b(?:EAI_AGAIN|ECONNABORTED|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT)\b|getaddrinfo/i.test(message);
}

export async function verifyCloudinaryConfiguration() {
  const { cloudName, apiKey, apiSecret } = cloudinaryCredentials();
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  try {
    await cloudinary.api.ping();
  } catch (error) {
    throw new Error(
      isNetworkError(error)
        ? `Could not reach Cloudinary to verify cloud "${cloudName}": ${cloudinaryErrorMessage(error)}`
        : `Cloudinary rejected the credentials for configured cloud "${cloudName}": ${cloudinaryErrorMessage(error)}`,
    );
  }
}

export function createEquipmentUploadSignature(ownerId: string) {
  const { cloudName, apiKey, apiSecret } = cloudinaryCredentials();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `${equipmentFolder}/${ownerId}`;
  const signatureBase = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash('sha1').update(signatureBase).digest('hex');

  return { cloudName, apiKey, timestamp, folder, signature };
}

export function createOperatorDocumentUploadSignature(operatorId: string) {
  const { cloudName, apiKey, apiSecret } = cloudinaryCredentials();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `${operatorDocumentsFolder}/${operatorId}`;
  const type = 'authenticated';
  const allowedFormats = 'pdf,jpg,jpeg,png';
  const signatureBase = `allowed_formats=${allowedFormats}&folder=${folder}&timestamp=${timestamp}&type=${type}${apiSecret}`;
  const signature = createHash('sha1').update(signatureBase).digest('hex');

  return {
    cloudName,
    apiKey,
    timestamp,
    folder,
    type,
    allowedFormats,
    resourceType: 'raw',
    signature,
  };
}
