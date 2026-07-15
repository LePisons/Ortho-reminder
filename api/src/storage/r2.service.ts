import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Thin wrapper around Cloudflare R2 (S3-compatible) for private object storage.
 * Objects are stored under opaque keys and read through short-lived signed URLs
 * so patient images are never publicly addressable.
 */
@Injectable()
export class R2Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID || '';
    this.bucket = process.env.R2_BUCKET_NAME || '';
    this.client = new S3Client({
      region: 'auto',
      endpoint:
        process.env.R2_ENDPOINT ||
        `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }

  /** Upload a buffer and return the stored object key. */
  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  /**
   * Fetch an object for server-side streaming to the client. Used when the
   * browser needs the bytes via fetch() (e.g. STL models for the 3D viewer):
   * signed R2 URLs would require CORS configuration on the bucket, while
   * proxying through the API stays inside the existing CORS allowlist.
   */
  getObject(key: string) {
    return this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** Generate a short-lived signed GET URL for a stored object key. */
  getSignedReadUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
