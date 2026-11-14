import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  apiClient,
  GoogleDriveFileMetadata,
  GoogleDriveStatus,
} from '../services/apiClient';
import { pickGoogleDriveRootFolder } from '../services/googleDrivePicker';
import { emitPlatformToast } from '../services/platformEvents';

const statusPill = (ready: boolean, label: string) => (
  <span
    className={
      ready
        ? 'inline-flex items-center gap-1.5 rounded-full bg-[#F0FDF4] px-3 py-1.5 text-xs font-bold text-[#15803D]'
        : 'inline-flex items-center gap-1.5 rounded-full bg-[#FFF7ED] px-3 py-1.5 text-xs font-bold text-[#C2410C]'
    }
  >
    {ready ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
    {label}
  </span>
);

export const GoogleDriveStorageCard: React.FC = () => {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<GoogleDriveStatus | null>(null);
  const [rootFolder, setRootFolder] = useState<GoogleDriveFileMetadata | null>(null);
  const [rootError, setRootError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);

  const canManage = currentUser?.role === 'Super Admin' || currentUser?.role === 'Administrador';

  const pickerReady = useMemo(
    () =>
      Boolean(
        status?.clientIdConfigured &&
          status?.clientSecretConfigured &&
          status?.refreshTokenConfigured &&
          status?.rootFolderConfigured &&
          status?.pickerApiKeyConfigured &&
          status?.pickerAppIdConfigured,
      ),
    [status],
  );

  const load = async () => {
    if (!canManage) return;
    setIsLoading(true);

    try {
      const statusResponse = await apiClient.getGoogleDriveStatus();
      setStatus(statusResponse.data);

      if (statusResponse.data.refreshTokenConfigured && statusResponse.data.rootFolderConfigured) {
        try {
          const rootResponse = await apiClient.getGoogleDriveRoot();
          setRootFolder(rootResponse.data);
          setRootError('');
        } catch (error) {
          setRootFolder(null);
          setRootError(
            error instanceof Error
              ? error.message
              : 'La carpeta raíz todavía no está autorizada para Quisqueya.',
          );
        }
      } else {
        setRootFolder(null);
        setRootError('');
      }
    } catch (error) {
      setStatus(null);
      setRootFolder(null);
      setRootError(error instanceof Error ? error.message : 'No se pudo consultar Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [canManage]);

  const authorizeRoot = async () => {
    if (!pickerReady) {
      emitPlatformToast({
        title: 'Google Picker no está listo',
        message:
          'Completa la API key, el App ID, el refresh token y la carpeta raíz antes de autorizar.',
        tone: 'error',
        durationMs: 5200,
      });
      return;
    }

    setIsAuthorizing(true);
    try {
      const pickerConfig = await apiClient.getGoogleDrivePickerConfig();
      const selectedFolderId = await pickGoogleDriveRootFolder(pickerConfig.data);
      if (!selectedFolderId) return;

      const confirmed = await apiClient.confirmGoogleDriveRoot(selectedFolderId);
      setRootFolder(confirmed.data);
      setRootError('');

      emitPlatformToast({
        title: 'Google Drive autorizado',
        message: `La carpeta ${confirmed.data.name} quedó validada como raíz multimedia.`,
        tone: 'success',
        durationMs: 4200,
      });
    } catch (error) {
      setRootFolder(null);
      setRootError(error instanceof Error ? error.message : 'No se pudo autorizar la carpeta raíz.');
      emitPlatformToast({
        title: 'No se pudo autorizar Google Drive',
        message: error instanceof Error ? error.message : 'Google Picker no completó la autorización.',
        tone: 'error',
        durationMs: 6200,
      });
    } finally {
      setIsAuthorizing(false);
    }
  };

  const exportMediaInventory = async () => {
    setIsAuditing(true);
    try {
      const response = await apiClient.getExperienceMediaInventory();
      const inventory = response.data;
      if (inventory.mode !== 'read-only') {
        throw new Error('La API no devolvió un inventario de solo lectura.');
      }
      // Use the existing authorized storage/objects endpoint; no Google access token
      // or browser Picker credentials are exported.
      const driveAudit: {
        provider: string;
        rootFolder: { id: string; name: string } | null;
        path: string;
        complete: boolean;
        objects: Array<{ path: string; key: string; name: string; mimeType?: string; sizeBytes?: number; checksum?: string }>;
        issues: string[];
      } = {
        provider: 'google-drive',
        rootFolder: rootFolder ? { id: rootFolder.id, name: rootFolder.name } : null,
        path: 'PAGINA WEB/Experiencias',
        complete: false,
        objects: [],
        issues: [],
      };

      if (!rootFolder?.id) {
        driveAudit.issues.push('No se ha validado la carpeta raíz en esta sesión.');
      } else {
        try {
          const rootListing = await apiClient.getMediaStorageObjects(rootFolder.id);
          const experiencesFolder = rootListing.data.objects.find(
            item => item.mimeType === 'application/vnd.google-apps.folder' &&
              item.name.trim().toLocaleLowerCase() === 'experiencias',
          );
          if (!experiencesFolder) {
            driveAudit.issues.push('No se encontró la carpeta Experiencias dentro de PAGINA WEB.');
          } else {
            const queue = [{ key: experiencesFolder.key, path: 'Experiencias' }];
            const visited = new Set<string>();
            const maxFolders = 100;
            while (queue.length > 0 && visited.size < maxFolders) {
              const folder = queue.shift();
              if (!folder || visited.has(folder.key)) continue;
              visited.add(folder.key);
              try {
                const listing = await apiClient.getMediaStorageObjects(folder.key);
                for (const item of listing.data.objects) {
                  const itemPath = `${folder.path}/${item.name}`;
                  if (item.mimeType === 'application/vnd.google-apps.folder') {
                    if (!visited.has(item.key)) queue.push({ key: item.key, path: itemPath });
                  } else {
                    driveAudit.objects.push({
                      path: itemPath,
                      key: item.key,
                      name: item.name,
                      mimeType: item.mimeType,
                      sizeBytes: item.sizeBytes,
                      checksum: item.checksum,
                    });
                  }
                }
              } catch (error) {
                driveAudit.issues.push(`Error al listar ${folder.path}: ${error instanceof Error ? error.message : 'API error'}`);
              }
            }
            if (queue.length > 0) driveAudit.issues.push('Se alcanzó el límite de 100 carpetas; el inventario está incompleto.');
            driveAudit.complete = driveAudit.issues.length === 0;
          }
        } catch (error) {
          driveAudit.issues.push(`No se pudo listar PAGINA WEB: ${error instanceof Error ? error.message : 'API error'}`);
        }
      }

      driveAudit.objects.sort((a, b) => a.path.localeCompare(b.path));
      const json = JSON.stringify({
        exportedAt: new Date().toISOString(),
        source: 'Quisqueya CRM - authenticated API read-only inventory',
        ...inventory,
        driveAudit,
      }, null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `quisqueya-media-inventory-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      emitPlatformToast({
        title: 'Auditoría descargada',
        message: `${inventory.summary.publishedExperiences} publicadas y ${inventory.summary.draftExperiences} borradores. No se modificaron datos.`,
        tone: 'success',
        durationMs: 5200,
      });
    } catch (error) {
      emitPlatformToast({
        title: 'No se pudo exportar el inventario',
        message: error instanceof Error ? error.message : 'La API no respondió.',
        tone: 'error',
        durationMs: 6200,
      });
    } finally {
      setIsAuditing(false);
    }
  };

  if (!canManage) return null;

  return (
    <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            <HardDrive size={22} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563EB]">
              Almacenamiento multimedia
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[#111827]">Google Drive</h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#64748B]">
              Quisqueya usa una carpeta raíz específica de Drive como límite operativo. El backend
              valida que toda lectura, carga o eliminación permanezca dentro de ese árbol.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportMediaInventory()}
            disabled={isAuditing || isLoading || isAuthorizing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:border-[#BFDBFE] hover:text-[#2563EB] disabled:opacity-60"
            title="Descarga el inventario actual de MySQL sin modificar experiencias ni archivos"
          >
            {isAuditing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Exportar auditoría
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={isLoading || isAuthorizing || isAuditing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:border-[#BFDBFE] hover:text-[#2563EB] disabled:opacity-60"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Verificar
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {statusPill(Boolean(status?.refreshTokenConfigured), 'OAuth backend')}
        {statusPill(
          Boolean(status?.pickerApiKeyConfigured && status?.pickerAppIdConfigured),
          'Picker web',
        )}
        {statusPill(Boolean(status?.rootFolderConfigured), 'Carpeta raíz')}
        {statusPill(Boolean(rootFolder), 'Límite raíz validado')}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-4">
          {rootFolder ? (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-[#16A34A]">
                <FolderOpen size={20} />
              </div>
              <div>
                <p className="text-sm font-black text-[#111827]">{rootFolder.name}</p>
                <p className="mt-1 text-xs font-medium text-[#64748B]">
                  Carpeta raíz autorizada · {rootFolder.mimeType || 'Google Drive folder'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-[#D97706]">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-sm font-black text-[#111827]">Validación de raíz pendiente</p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                  {rootError ||
                    'Selecciona la carpeta raíz configurada para confirmar que coincide con el límite multimedia de Quisqueya.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void authorizeRoot()}
          disabled={!pickerReady || isAuthorizing}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(37,99,235,0.22)] transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAuthorizing ? <Loader2 size={17} className="animate-spin" /> : <FolderOpen size={17} />}
          {rootFolder ? 'Reautorizar carpeta raíz' : 'Autorizar carpeta raíz'}
        </button>
      </div>

      {status && !pickerReady ? (
        <div className="mt-4 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] px-4 py-3 text-xs font-semibold leading-5 text-[#9A3412]">
          Falta completar alguna variable de Google Picker. La plataforma no intentará abrir el
          selector hasta que OAuth, API key, App ID y carpeta raíz estén configurados.
        </div>
      ) : null}
    </section>
  );
};
