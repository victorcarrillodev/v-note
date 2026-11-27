import { err, ok } from "../result";
import type { BackupDestination, DestResult } from "./destination";
import { DropboxDestination } from "./dropboxDestination";
import { GitHubDestination } from "./githubDestination";
import { GoogleDriveDestination } from "./googleDriveDestination";
import type { FetchLike } from "./githubClient";
import { LocalFolderDestination, type FolderSyncPort } from "./localFolderDestination";
import { OAuthTokenStore } from "./oauthPkce";
import type { Keychain } from "./tokenStore";

/** Configuración serializable del destino elegido (sin secretos: los tokens van al llavero). */
export type DestinationConfig =
  | { kind: "local-folder" }
  | { kind: "google-drive"; clientId: string; folderId: string }
  | { kind: "dropbox"; clientId: string; basePath?: string }
  | { kind: "github"; owner: string; repo: string; branch?: string };

export const GITHUB_BACKUP_ACCOUNT = "github:backup";

export type DestinationDeps = {
  fetch: FetchLike;
  keychain: Keychain;
  /** Carpeta elegida por la persona (la aporta la plataforma). */
  folderPort: () => FolderSyncPort | null;
};

const bad = (message: string): DestResult<BackupDestination> => err({ kind: "INVALID", message, retryable: false });
const NAME = /^[A-Za-z0-9_.-]+$/;

export async function createDestination(cfg: DestinationConfig, d: DestinationDeps): Promise<DestResult<BackupDestination>> {
  switch (cfg.kind) {
    case "local-folder": {
      const port = d.folderPort();
      return port ? ok(new LocalFolderDestination(port)) : bad("Elige primero una carpeta de destino");
    }
    case "google-drive": {
      if (!cfg.clientId.trim() || !cfg.folderId.trim()) return bad("Faltan el client ID o la carpeta de Google Drive");
      const tokens = new OAuthTokenStore({ keychain: d.keychain, fetch: d.fetch, provider: "google-drive", clientId: cfg.clientId.trim() });
      return ok(new GoogleDriveDestination({ fetch: d.fetch, getAccessToken: () => tokens.getAccessToken(), folderId: cfg.folderId.trim() }));
    }
    case "dropbox": {
      if (!cfg.clientId.trim()) return bad("Falta el client ID de Dropbox");
      const tokens = new OAuthTokenStore({ keychain: d.keychain, fetch: d.fetch, provider: "dropbox", clientId: cfg.clientId.trim() });
      return ok(new DropboxDestination({ fetch: d.fetch, getAccessToken: () => tokens.getAccessToken(), ...(cfg.basePath ? { basePath: cfg.basePath } : {}) }));
    }
    case "github": {
      if (!NAME.test(cfg.owner.trim()) || !NAME.test(cfg.repo.trim())) return bad("El propietario o el repositorio de GitHub no son válidos");
      const token = await d.keychain.get(GITHUB_BACKUP_ACCOUNT);
      if (!token) return err({ kind: "AUTH", message: "Falta el token de GitHub", retryable: false });
      return ok(new GitHubDestination({ fetch: d.fetch, token, owner: cfg.owner.trim(), repo: cfg.repo.trim(), ...(cfg.branch ? { branch: cfg.branch } : {}) }));
    }
  }
}
