import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
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
              Quisqueya usa una carpeta raíz específica de Drive como límite de acceso. El resto de
              la cuenta de Google permanece fuera del alcance de la plataforma.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading || isAuthorizing}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:border-[#BFDBFE] hover:text-[#2563EB] disabled:opacity-60"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Verificar
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {statusPill(Boolean(status?.refreshTokenConfigured), 'OAuth backend')}
        {statusPill(
          Boolean(status?.pickerApiKeyConfigured && status?.pickerAppIdConfigured),
          'Picker web',
        )}
        {statusPill(Boolean(status?.rootFolderConfigured), 'Carpeta raíz')}
        {statusPill(Boolean(rootFolder), 'Acceso drive.file')}
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
                <p className="text-sm font-black text-[#111827]">Autorización selectiva pendiente</p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                  {rootError ||
                    'Selecciona la carpeta raíz configurada para conceder acceso explícito mediante Google Picker.'}
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
