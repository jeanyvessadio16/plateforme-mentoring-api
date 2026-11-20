import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL') || '';
    const secretKey = this.configService.get<string>('SUPABASE_SECRET_KEY') || '';
    const publishableKey =
      this.configService.get<string>('SUPABASE_PUBLISHABLE_KEY') || secretKey;

    if (!url || !secretKey) {
      this.logger.warn('Supabase URL ou clés manquantes dans les variables d’environnement.');
    }

    // Client public pour les opérations d'authentification utilisateur standard
    this.client = createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Client admin (service_role) pour la gestion avancée des utilisateurs et du stockage
    this.adminClient = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  /**
   * Retourne le client Supabase standard (avec clé publique)
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Retourne le client Supabase administrateur (avec clé secrète service_role)
   */
  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  getSupabaseUrl(): string {
    return this.configService.get<string>('SUPABASE_URL') || '';
  }

  /**
   * Upload privé dans un bucket non public (retourne le chemin relatif)
   */
  async uploadPrivateFile(
    bucket: string,
    path: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const { error } = await this.adminClient.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      this.logger.error(`Erreur d'upload privé vers Supabase Storage: ${error.message}`);
      throw error;
    }

    return path;
  }

  /**
   * Helper pour uploader un fichier vers un bucket Supabase Storage
   */
  async uploadFile(
    bucket: string,
    path: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const { error } = await this.adminClient.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Erreur d'upload vers Supabase Storage: ${error.message}`);
      throw error;
    }

    const { data } = this.adminClient.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Génère une URL signée temporaire pour un fichier stocké dans un bucket privé
   */
  async createSignedUrl(
    bucket: string,
    path: string,
    expiresInSeconds = 3600,
  ): Promise<string | null> {
    if (!path) {
      return null;
    }

    const { data, error } = await this.adminClient.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      this.logger.warn(
        `Impossible de signer le document (${bucket}/${path}): ${error?.message || 'URL vide'}`,
      );
      return null;
    }

    return data.signedUrl;
  }

  /**
   * Supprimer un fichier d'un bucket
   */
  async deleteFile(bucket: string, paths: string[]): Promise<void> {
    const { error } = await this.adminClient.storage.from(bucket).remove(paths);
    if (error) {
      this.logger.error(`Erreur de suppression dans Supabase Storage: ${error.message}`);
      throw error;
    }
  }

  /**
   * Suppression best-effort d'un fichier dans un bucket sans interrompre le flux
   */
  async removeFile(bucket: string, path: string): Promise<void> {
    if (!path) {
      return;
    }
    const { error } = await this.adminClient.storage.from(bucket).remove([path]);
    if (error) {
      this.logger.warn(`Suppression best-effort échouée (${bucket}/${path}): ${error.message}`);
    }
  }
}
