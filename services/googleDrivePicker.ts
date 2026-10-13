import type { GoogleDrivePickerConfig } from './apiClient';

type PickerWindow = Window & {
  gapi?: {
    load: (
      api: string,
      options:
        | (() => void)
        | {
            callback: () => void;
            onerror?: () => void;
            timeout?: number;
            ontimeout?: () => void;
          },
    ) => void;
  };
  google?: {
    picker: {
      Action: { PICKED: string; CANCEL: string };
      Response: { ACTION: string; DOCUMENTS: string };
      Document: { ID: string };
      DocsViewMode: { LIST: string };
      DocsView: new (viewId?: string) => {
        setIncludeFolders: (enabled: boolean) => unknown;
        setSelectFolderEnabled: (enabled: boolean) => unknown;
        setFileIds: (fileIds: string) => unknown;
        setMode: (mode: string) => unknown;
      };
      PickerBuilder: new () => {
        addView: (view: unknown) => unknown;
        setOAuthToken: (token: string) => unknown;
        setDeveloperKey: (key: string) => unknown;
        setAppId: (appId: string) => unknown;
        setOrigin: (origin: string) => unknown;
        setMaxItems: (max: number) => unknown;
        setTitle: (title: string) => unknown;
        setCallback: (callback: (data: PickerCallbackData) => void) => unknown;
        build: () => { setVisible: (visible: boolean) => void };
      };
      ViewId: { FOLDERS: string };
    };
  };
};

type PickerCallbackData = Record<string, unknown>;

const SCRIPT_ID = 'quisqueya-google-picker-api';
let pickerApiPromise: Promise<void> | null = null;

const loadGoogleApiScript = async () => {
  const pickerWindow = window as PickerWindow;
  if (pickerWindow.gapi) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');

    const cleanup = () => {
      window.clearTimeout(timeout);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
    const onLoad = () => {
      cleanup();
      if (!pickerWindow.gapi) {
        script.remove();
        reject(new Error('Google API cargó, pero no quedó disponible en el navegador.'));
        return;
      }
      resolve();
    };
    const onError = () => {
      cleanup();
      script.remove();
      reject(new Error('No se pudo cargar Google Picker.'));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      script.remove();
      reject(new Error('Google Picker tardó demasiado en cargar. Revisa bloqueadores o acceso a apis.google.com.'));
    }, 15000);

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
};

const loadPickerApi = async () => {
  if (pickerApiPromise) return pickerApiPromise;

  pickerApiPromise = (async () => {
    await loadGoogleApiScript();
    const pickerWindow = window as PickerWindow;
    if (!pickerWindow.gapi) throw new Error('Google API no quedó disponible en el navegador.');

    await new Promise<void>((resolve, reject) => {
      pickerWindow.gapi?.load('picker', {
        callback: resolve,
        onerror: () => reject(new Error('Google Picker no pudo inicializarse.')),
        timeout: 10000,
        ontimeout: () => reject(new Error('Google Picker tardó demasiado en inicializarse.')),
      });
    });

    if (!pickerWindow.google?.picker) {
      throw new Error('Google Picker no quedó disponible después de cargar la API.');
    }
  })().catch(error => {
    pickerApiPromise = null;
    throw error;
  });

  return pickerApiPromise;
};

export const pickGoogleDriveRootFolder = async (
  config: GoogleDrivePickerConfig,
): Promise<string | null> => {
  await loadPickerApi();

  const pickerWindow = window as PickerWindow;
  const pickerApi = pickerWindow.google?.picker;
  if (!pickerApi) throw new Error('Google Picker no está disponible.');

  return new Promise<string | null>((resolve, reject) => {
    let settled = false;
    let activePicker: { setVisible: (visible: boolean) => void } | null = null;
    const finish = (folderId: string | null, error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      try { activePicker?.setVisible(false); } catch { /* Picker may already be closed. */ }
      if (error) reject(error);
      else resolve(folderId);
    };
    const timeout = window.setTimeout(() => {
      finish(null, new Error('Google Picker no respondió. Comprueba las ventanas bloqueadas y vuelve a intentar.'));
    }, 90000);

    try {
      const view = new pickerApi.DocsView(pickerApi.ViewId.FOLDERS);

      // The configured root is the only selectable entry. Picker is the admin
      // confirmation UX; the backend root-boundary guard is the security control.
      (view.setIncludeFolders(true) as typeof view)
        .setSelectFolderEnabled(true);
      view.setFileIds(config.rootFolderId);
      view.setMode(pickerApi.DocsViewMode.LIST);

      const builder = new pickerApi.PickerBuilder();
      const picker = (builder.addView(view) as typeof builder)
        .setOAuthToken(config.accessToken) as typeof builder;

      const configuredPicker = (picker.setDeveloperKey(config.developerKey) as typeof builder);
      (configuredPicker.setAppId(config.appId) as typeof builder);
      (configuredPicker.setOrigin(window.location.origin) as typeof builder);
      (configuredPicker.setMaxItems(1) as typeof builder);
      (configuredPicker.setTitle('Autorizar carpeta raíz de Quisqueya') as typeof builder);
      configuredPicker.setCallback((data: PickerCallbackData) => {
        const action = data[pickerApi.Response.ACTION];

        if (action === pickerApi.Action.CANCEL) {
          finish(null);
          return;
        }

        if (action === 'error' || action === 'ERROR') {
          finish(null, new Error('Google Picker reportó un error al abrir o validar la carpeta.'));
          return;
        }

        if (action !== pickerApi.Action.PICKED) return;

        const documents = data[pickerApi.Response.DOCUMENTS];
        const firstDocument = Array.isArray(documents)
          ? (documents[0] as Record<string, unknown> | undefined)
          : undefined;
        const rawFolderId = firstDocument?.[pickerApi.Document.ID];
        const folderId = typeof rawFolderId === 'string' ? rawFolderId.trim() : '';

        if (!folderId) {
          finish(null, new Error('Google Picker no devolvió el ID de la carpeta seleccionada.'));
          return;
        }

        finish(folderId);
      });

      activePicker = configuredPicker.build();
      activePicker.setVisible(true);
    } catch (error) {
      finish(null, error instanceof Error ? error : new Error('Google Picker no pudo abrirse.'));
    }
  });
};
