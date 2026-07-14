import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Edit2,
  Eye,
  Filter,
  Image as ImageIcon,
  Lock,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  ShieldCheck,
  TrendingUp,
  Upload,
  Users2,
  Wallet,
  X,
} from 'lucide-react';
import {
  canCreateResource,
  checkCompanyAccess,
  createClient,
  getCompanyById,
  getSaaSPlans,
  upsertClientsInLocalStorage,
} from '../services/dataService';
import { getBranchScope, getScopedClients, getScopedLoans, getScopedUsers } from '../services/viewScope';
import { Branch, Client, Company, LoanStatus, Role, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiClient, ApiRequestError, ApiUnavailableError } from '../services/apiClient';
import { emitPlatformToast } from '../services/platformEvents';
import { formatDate } from '../utils';
import { Badge } from '../components/ui/Badge';
import { ClientAvatar } from '../components/ui/ClientAvatar';
import { platformMotionButtonClass as motionButtonClass } from '../components/ui/platformStyles';
import { optimizeImageFile } from '../services/imageOptimizer';

const scoreMap = {
  BUENA: 88,
  REGULAR: 74,
  MALA: 53,
};

const pageSize = 10;

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const cleanTextInput = (value: string) => value.replace(/\s+/g, ' ').trimStart();

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const formatCedulaInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
};

const escapeCsvValue = (value: string | number | undefined | null) => {
  const safeValue = `${value ?? ''}`.replace(/"/g, '""');
  return /[",\n]/.test(safeValue) ? `"${safeValue}"` : safeValue;
};

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const csvHeaderAliases: Record<string, string[]> = {
  firstName: ['nombre', 'firstname', 'first_name'],
  lastName: ['apellido', 'lastname', 'last_name'],
  nickname: ['apodo', 'nickname', 'alias'],
  cedula: ['cedula', 'documento', 'id'],
  phone: ['telefono', 'phone', 'celular'],
  address: ['direccion', 'address', 'direccion_de_cobro'],
  branch: ['sucursal', 'branch', 'branch_name'],
  assignee: ['oficial_responsable', 'oficial', 'cobrador', 'assigned_user', 'responsable'],
};

export const Clients: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, selectedBranchId, setSelectedBranchId } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [collectors, setCollectors] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedCollectorId, setSelectedCollectorId] = useState(() =>
    currentUser?.role === Role.COBRADOR ? currentUser.id : ''
  );
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [access, setAccess] = useState({ restricted: false, suspended: false });
  const [canAddClient, setCanAddClient] = useState(true);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [openCreateFilter, setOpenCreateFilter] = useState<'branch' | 'assignee' | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nickname: '',
    cedula: '',
    phone: '',
    address: '',
    branchId: currentUser.branchId,
    assignedUserId: '',
    photo: '',
  });

  const branchScope = useMemo(() => getBranchScope(currentUser), [currentUser]);
  const canSeeAllCompanyUsers = branchScope.canSeeAllCompanyUsers;
  const loans = useMemo(() => getScopedLoans(currentUser), [currentUser]);
  const currentPlan = useMemo(() => getSaaSPlans().find(plan => plan.id === company?.planId), [company?.planId]);

  const reloadClients = useCallback(async () => {
    try {
      const response = await apiClient.listClients();
      upsertClientsInLocalStorage(response.data);
      setClients(response.data);
      return response.data;
    } catch {
      const fallbackClients = getScopedClients(currentUser);
      setClients(fallbackClients);
      return fallbackClients;
    }
  }, [currentUser]);

  const resetForm = () => {
    setFormError('');
    setOpenCreateFilter(null);
    setFormData({
      firstName: '',
      lastName: '',
      nickname: '',
      cedula: '',
      phone: '',
      address: '',
      branchId: currentUser.branchId,
      assignedUserId: '',
      photo: '',
    });
  };

  useEffect(() => {
    let cancelled = false;

    const loadClients = async () => {
      const nextClients = await reloadClients();
      if (cancelled) return;
      setClients(nextClients);
    };

    loadClients();
    setCompany(getCompanyById(currentUser.companyId));
    setCollectors(getScopedUsers(currentUser));
    setBranches(branchScope.branches);
    setAccess(checkCompanyAccess(currentUser.companyId));
    setCanAddClient(canCreateResource(currentUser.companyId, 'CLIENT'));

    return () => {
      cancelled = true;
    };
  }, [currentUser, reloadClients, branchScope]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === 'true') {
      setIsModalOpen(true);
      navigate('/clients', { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranchId, selectedCollectorId, selectedStatus]);

  const clientsWithStats = useMemo(() => {
    return clients.map(client => {
      const clientLoans = loans.filter(loan => loan.clientId === client.id);
      const activeLoans = clientLoans.filter(loan => loan.status === LoanStatus.ACTIVO);
      const overdueLoans = clientLoans.filter(loan => loan.status === LoanStatus.MORA);
      const balance = clientLoans.reduce((acc, loan) => acc + loan.balance, 0);
      const score = scoreMap[client.creditRating || 'BUENA'] || 70;
      const segment =
        client.isBlocked ? 'Bloqueados' : overdueLoans.length > 0 ? 'Atrasados' : activeLoans.length > 0 ? 'Activos' : 'En seguimiento';

      return {
        client,
        activeLoansCount: activeLoans.length,
        overdueLoansCount: overdueLoans.length,
        balance,
        score,
        segment,
      };
    });
  }, [clients, loans]);

  const branchMap = useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches]);
  const collectorMap = useMemo(() => new Map(collectors.map(user => [user.id, user])), [collectors]);

  const filteredAndSortedClients = useMemo(() => {
    let result = [...clientsWithStats];

    if (selectedBranchId) result = result.filter(entry => entry.client.branchId === selectedBranchId);
    if (currentUser.role === Role.COBRADOR) result = result.filter(entry => entry.client.assignedUserId === currentUser.id);
    if (selectedCollectorId) result = result.filter(entry => entry.client.assignedUserId === selectedCollectorId);
    if (selectedStatus) result = result.filter(entry => entry.segment === selectedStatus);

    if (searchTerm) {
      const query = normalizeText(searchTerm);
      result = result.filter(entry => {
        const branch = branchMap.get(entry.client.branchId);
        const officer = collectorMap.get(entry.client.assignedUserId);
        const searchable = normalizeText(
          [
            entry.client.firstName,
            entry.client.lastName,
            `${entry.client.firstName} ${entry.client.lastName}`,
            entry.client.nickname || '',
            entry.client.phone,
            entry.client.cedula,
            branch?.name || '',
            officer?.name || '',
          ].join(' '),
        );
        return searchable.includes(query);
      });
    }

    return result.sort((a, b) => new Date(b.client.createdAt).getTime() - new Date(a.client.createdAt).getTime());
  }, [branchMap, clientsWithStats, collectorMap, currentUser, searchTerm, selectedBranchId, selectedCollectorId, selectedStatus]);

  const metrics = useMemo(() => {
    const total = clientsWithStats.length;
    const active = clientsWithStats.filter(entry => entry.activeLoansCount > 0 && !entry.client.isBlocked).length;
    const withLoans = clientsWithStats.filter(entry => entry.activeLoansCount > 0).length;
    const blocked = clientsWithStats.filter(entry => entry.client.isBlocked).length;
    const followed = clientsWithStats.filter(entry => entry.segment === 'En seguimiento').length;
    const overdue = clientsWithStats.filter(entry => entry.segment === 'Atrasados').length;
    return { total, active, withLoans, blocked, followed, overdue };
  }, [clientsWithStats]);

  const metricCards = useMemo(() => {
    const total = Math.max(metrics.total, 1);
    return [
      {
        label: 'Total clientes',
        value: metrics.total,
        share: 100,
        helper: 'Base general de cartera',
        icon: Users2,
        iconWrap: 'bg-[#DBEAFE] text-[#2563EB]',
        trend: '+8%',
        trendTone: 'text-[#16A34A]',
      },
      {
        label: 'Activos',
        value: metrics.active,
        share: (metrics.active / total) * 100,
        helper: 'Con cartera en curso',
        icon: ShieldCheck,
        iconWrap: 'bg-[#DCFCE7] text-[#16A34A]',
        trend: `${metrics.active - metrics.followed >= 0 ? '+' : ''}${metrics.active - metrics.followed}`,
        trendTone: 'text-[#16A34A]',
      },
      {
        label: 'Con prestamos activos',
        value: metrics.withLoans,
        share: (metrics.withLoans / total) * 100,
        helper: 'Listos para seguimiento',
        icon: TrendingUp,
        iconWrap: 'bg-[#EFF6FF] text-[#2563EB]',
        trend: `${((metrics.withLoans / total) * 100).toFixed(1)}%`,
        trendTone: 'text-[#2563EB]',
      },
      {
        label: 'Bloqueados',
        value: metrics.blocked,
        share: (metrics.blocked / total) * 100,
        helper: 'Requieren revision',
        icon: Lock,
        iconWrap: 'bg-[#FEE2E2] text-[#DC2626]',
        trend: metrics.blocked > 0 ? `${metrics.blocked}` : '0',
        trendTone: 'text-[#DC2626]',
      },
      {
        label: 'En seguimiento',
        value: metrics.followed,
        share: (metrics.followed / total) * 100,
        helper: 'Sin prestamo o inactivos',
        icon: CircleHelp,
        iconWrap: 'bg-[#FEF3C7] text-[#D97706]',
        trend: `${metrics.overdue} alertas`,
        trendTone: 'text-[#D97706]',
      },
    ];
  }, [metrics]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedClients.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const clientLimit = currentPlan?.maxClients || Math.max(metrics.total, 1);
  const clientUsageRatio = Math.min(metrics.total / clientLimit, 1);
  const paginatedClients = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredAndSortedClients.slice(start, start + pageSize);
  }, [filteredAndSortedClients, safeCurrentPage]);

  const visiblePages = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (safeCurrentPage <= 3) return [1, 2, 3, 4, totalPages];
    if (safeCurrentPage >= totalPages - 2) return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, totalPages];
  }, [safeCurrentPage, totalPages]);

  useEffect(() => {
    if (!pageRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo('[data-clients-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
      gsap.fromTo(
        '[data-clients-kpi]',
        { opacity: 0, y: 24, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.48, ease: 'power3.out', stagger: 0.07, delay: 0.08 },
      );
      gsap.fromTo('[data-clients-filters]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.16 });
      gsap.fromTo('[data-clients-list]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.22 });
      gsap.fromTo(
        '[data-client-row]',
        { opacity: 0, x: -16 },
        { opacity: 1, x: 0, duration: 0.36, ease: 'power2.out', stagger: 0.035, delay: 0.28 },
      );
    }, pageRef);

    return () => ctx.revert();
  }, []);

  const availableAssignees = useMemo(() => {
    if (currentUser.role === Role.COBRADOR) return [currentUser];
    return collectors.filter(user => {
      if (![Role.COBRADOR, Role.SUPERVISOR, Role.ADMIN].includes(user.role)) return false;
      return !formData.branchId || user.branchId === formData.branchId;
    });
  }, [collectors, currentUser, formData.branchId]);

  const resetFilters = () => {
    setSelectedBranchId(canSeeAllCompanyUsers ? '' : currentUser.branchId);
    setSelectedCollectorId(currentUser?.role === Role.COBRADOR ? currentUser.id : '');
    setSelectedStatus('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleExportClients = () => {
    if (!filteredAndSortedClients.length) {
      emitPlatformToast({
        title: 'No hay clientes para exportar',
        message: 'Ajusta los filtros o registra clientes antes de descargar el archivo.',
        tone: 'warning',
        durationMs: 4200,
      });
      return;
    }

    const headers = ['nombre', 'apellido', 'apodo', 'cedula', 'telefono', 'direccion', 'sucursal', 'oficial_responsable'];
    const rows = filteredAndSortedClients.map(({ client }) => {
      const branchName = branchMap.get(client.branchId)?.name || '';
      const officerName = collectorMap.get(client.assignedUserId)?.name || '';
      return [
        escapeCsvValue(client.firstName),
        escapeCsvValue(client.lastName),
        escapeCsvValue(client.nickname || ''),
        escapeCsvValue(client.cedula),
        escapeCsvValue(client.phone),
        escapeCsvValue(client.address),
        escapeCsvValue(branchName),
        escapeCsvValue(officerName),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    emitPlatformToast({
      title: 'Clientes exportados',
      message: `Se descargaron ${filteredAndSortedClients.length} registros en formato CSV.`,
      tone: 'success',
      durationMs: 3600,
    });
  };

  const handleImportTrigger = () => {
    if (isImporting) return;
    importInputRef.current?.click();
  };

  const handleImportClients = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const rawText = await file.text();
      const lines = rawText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        throw new Error('El archivo CSV no contiene filas suficientes para importar.');
      }

      const headerKeys = parseCsvLine(lines[0]).map(header => normalizeText(header).replace(/\s+/g, '_'));
      const getColumnIndex = (aliases: string[]) => headerKeys.findIndex(header => aliases.includes(header));

      const firstNameIndex = getColumnIndex(csvHeaderAliases.firstName);
      const lastNameIndex = getColumnIndex(csvHeaderAliases.lastName);
      const cedulaIndex = getColumnIndex(csvHeaderAliases.cedula);
      const phoneIndex = getColumnIndex(csvHeaderAliases.phone);
      const addressIndex = getColumnIndex(csvHeaderAliases.address);

      if ([firstNameIndex, lastNameIndex, cedulaIndex, phoneIndex, addressIndex].some(index => index === -1)) {
        throw new Error('El CSV debe incluir como minimo nombre, apellido, cedula, telefono y direccion.');
      }

      const nicknameIndex = getColumnIndex(csvHeaderAliases.nickname);
      const branchIndex = getColumnIndex(csvHeaderAliases.branch);
      const assigneeIndex = getColumnIndex(csvHeaderAliases.assignee);

      let importedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const [rowOffset, line] of lines.slice(1).entries()) {
        const columns = parseCsvLine(line);
        const firstName = cleanTextInput(columns[firstNameIndex] || '').trim();
        const lastName = cleanTextInput(columns[lastNameIndex] || '').trim();
        const cedula = formatCedulaInput(columns[cedulaIndex] || '');
        const phone = formatPhoneInput(columns[phoneIndex] || '');
        const address = cleanTextInput(columns[addressIndex] || '').trim();
        const nickname = nicknameIndex >= 0 ? cleanTextInput(columns[nicknameIndex] || '').trim() : '';
        const branchValue = branchIndex >= 0 ? normalizeText(columns[branchIndex] || '') : '';
        const assigneeValue = assigneeIndex >= 0 ? normalizeText(columns[assigneeIndex] || '') : '';

        if (!firstName || !lastName || !cedula || !phone || !address) {
          skippedCount += 1;
          errors.push(`Fila ${rowOffset + 2}: faltan datos obligatorios.`);
          continue;
        }

        const matchedBranch =
          branches.find(branch => normalizeText(branch.id) === branchValue || normalizeText(branch.name) === branchValue) ||
          branches.find(branch => branch.id === currentUser.branchId);

        const matchedAssignee =
          collectors.find(
            user =>
              normalizeText(user.id) === assigneeValue ||
              normalizeText(user.name) === assigneeValue ||
              normalizeText(user.username) === assigneeValue,
          ) ||
          (currentUser.role === Role.COBRADOR ? currentUser : undefined);

        const submissionData = {
          firstName,
          lastName,
          nickname,
          cedula,
          phone,
          address,
          branchId: matchedBranch?.id || currentUser.branchId,
          assignedUserId: matchedAssignee?.id || '',
          photo: '',
        };

        try {
          const response = await apiClient.createClient(submissionData);
          upsertClientsInLocalStorage([response.data]);
          importedCount += 1;
        } catch (error) {
          if (error instanceof ApiUnavailableError) {
            try {
              createClient(submissionData, currentUser);
              importedCount += 1;
            } catch (localError) {
              skippedCount += 1;
              errors.push(`Fila ${rowOffset + 2}: ${localError instanceof Error ? localError.message : 'no se pudo crear el cliente.'}`);
            }
          } else {
            skippedCount += 1;
            errors.push(`Fila ${rowOffset + 2}: ${error instanceof Error ? error.message : 'no se pudo crear el cliente.'}`);
          }
        }
      }

      await reloadClients();
      setCanAddClient(canCreateResource(currentUser.companyId, 'CLIENT'));

      if (importedCount > 0) {
        emitPlatformToast({
          title: 'Importacion completada',
          message: skippedCount
            ? `Se importaron ${importedCount} clientes y ${skippedCount} filas quedaron pendientes por revisar.`
            : `Se importaron ${importedCount} clientes correctamente.`,
          tone: skippedCount ? 'warning' : 'success',
          durationMs: 5200,
        });
      } else {
        throw new Error(errors[0] || 'No se pudo importar ninguna fila valida.');
      }
    } catch (error) {
      emitPlatformToast({
        title: 'No se pudo importar el archivo',
        message: error instanceof Error ? error.message : 'Revisa el CSV e intenta nuevamente.',
        tone: 'error',
        durationMs: 5200,
      });
    } finally {
      event.target.value = '';
      setIsImporting(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFormError('');
    void optimizeImageFile(file)
      .then(photo => setFormData(current => ({ ...current, photo })))
      .catch(() => setFormError('No pudimos procesar la foto. Intenta con una imagen mas ligera.'));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (access.restricted || !canAddClient) return;
    setFormError('');

    if (!formData.assignedUserId && currentUser.role !== Role.COBRADOR) {
      setFormError('Debe asignar un oficial responsable.');
      return;
    }
    if (!formData.branchId && currentUser.role !== Role.COBRADOR) {
      setFormError('Debe asignar una sucursal al expediente.');
      return;
    }

    const submissionData = {
      ...formData,
      branchId: currentUser.role === Role.COBRADOR ? currentUser.branchId : formData.branchId,
      assignedUserId: currentUser.role === Role.COBRADOR ? currentUser.id : formData.assignedUserId,
    };

    setIsSaving(true);
    try {
      const response = await apiClient.createClient(submissionData);
      upsertClientsInLocalStorage([response.data]);
      setClients(previous => [response.data, ...previous.filter(client => client.id !== response.data.id)]);
      setCanAddClient(canCreateResource(currentUser.companyId, 'CLIENT'));
      setIsModalOpen(false);
      resetForm();
      emitPlatformToast({
        title: 'Expediente registrado',
        message: `${response.data.firstName} ${response.data.lastName} ya esta disponible en la cartera de clientes.`,
        tone: 'success',
        durationMs: 3600,
      });
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        try {
          const createdClient = createClient(submissionData, currentUser);
          setClients(getScopedClients(currentUser));
          setCanAddClient(canCreateResource(currentUser.companyId, 'CLIENT'));
          setIsModalOpen(false);
          resetForm();
          emitPlatformToast({
            title: 'Expediente registrado',
            message: `${createdClient.firstName} ${createdClient.lastName} se guardo en modo local correctamente.`,
            tone: 'success',
            durationMs: 4200,
          });
        } catch (localError) {
          setFormError(localError instanceof Error ? localError.message : 'No se pudo crear el cliente.');
        }
      } else if (error instanceof ApiRequestError) {
        setFormError(error.message);
      } else {
        setFormError(error instanceof Error ? error.message : 'No se pudo crear el cliente.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div ref={pageRef} className="space-y-6 pb-24 lg:pb-0">
      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportClients}
      />

      <section data-clients-hero>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-[32px] font-semibold leading-[1.1] tracking-tight text-[#111827]">Clientes</h1>
            <p className="mt-3 text-xl font-medium text-[#6B7280]">
              Administra tu cartera de clientes, seguimiento, scoring y prestamos activos.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportClients}
              className={`flex h-[54px] cursor-pointer items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[18px] font-medium text-[#111827] shadow-sm ${motionButtonClass}`}
            >
              <Download size={20} />
              Exportar
            </button>
            <button
              type="button"
              onClick={handleImportTrigger}
              disabled={isImporting}
              className={`flex h-[54px] cursor-pointer items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[18px] font-medium text-[#111827] shadow-sm ${motionButtonClass} disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0`}
            >
              <Upload size={20} />
              {isImporting ? 'Importando...' : 'Importar'}
            </button>
            {currentUser.role !== Role.COBRADOR && (
              <button
                onClick={() => {
                  if (!access.restricted && canAddClient) {
                    resetForm();
                    setIsModalOpen(true);
                  }
                }}
                className="flex h-[54px] items-center justify-center gap-3 rounded-2xl bg-[#2563EB] px-6 text-[18px] font-medium text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)]"
              >
                <Plus size={20} />
                Crear cliente
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {metricCards.map(item => (
          <div key={item.label} data-clients-kpi className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${item.iconWrap}`}>
                <item.icon size={24} />
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold ${item.trendTone}`}>
                  {item.share >= 50 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {item.trend}
                </div>
                <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Participacion</p>
                  <p className="mt-1 text-[16px] font-semibold leading-none text-[#111827]">{item.share.toFixed(1)}%</p>
              </div>
            </div>
            <div className="mt-8 space-y-3">
              <p className="text-[17px] font-semibold text-[#111827]">{item.label}</p>
              <p className="text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{item.value.toLocaleString()}</p>
              <p className="max-w-[180px] text-[15px] font-medium leading-6 text-[#6B7280]">{item.helper}</p>
            </div>
            <div className="pointer-events-none absolute bottom-4 right-4 opacity-[0.08]">
              <item.icon size={88} className={item.iconWrap.split(' ').find(token => token.startsWith('text-')) || 'text-[#2563EB]'} />
            </div>
          </div>
        ))}
      </section>

      <section data-clients-filters className="relative z-30 rounded-[26px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[190px_190px_180px_1fr_auto]">
          <FilterDropdown
            value={selectedBranchId}
            onChange={setSelectedBranchId}
            disabled={!canSeeAllCompanyUsers}
            placeholder={canSeeAllCompanyUsers ? 'Todas las sucursales' : 'Sucursal actual'}
            options={branches.map(branch => ({ value: branch.id, label: branch.name }))}
          />
          <FilterDropdown
            value={selectedCollectorId}
            onChange={setSelectedCollectorId}
            placeholder={currentUser?.role === Role.COBRADOR ? currentUser.name : "Todos los cobradores"}
            disabled={currentUser?.role === Role.COBRADOR}
            options={collectors.map(user => ({ value: user.id, label: user.name }))}
          />
          <FilterDropdown
            value={selectedStatus}
            onChange={setSelectedStatus}
            placeholder="Todos los estados"
            options={[
              { value: 'Activos', label: 'Activos' },
              { value: 'En seguimiento', label: 'En seguimiento' },
              { value: 'Bloqueados', label: 'Bloqueados' },
              { value: 'Atrasados', label: 'Atrasados' },
            ]}
          />
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente, apodo, telefono o cedula"
              className="h-[54px] w-full rounded-2xl border border-[#E5E7EB] bg-white pl-12 pr-4 text-[16px] font-medium text-[#111827] outline-none placeholder:text-[#9CA3AF] transition-all duration-200 focus:border-[#93C5FD] focus:shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
            />
          </div>

          <button
            onClick={resetFilters}
            className="flex h-[54px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[16px] font-medium text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
          >
            <Filter size={18} />
            Limpiar filtros
          </button>
        </div>
      </section>

      <section data-clients-list className="relative z-10">
        <div className="overflow-visible rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-8 py-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[22px] font-semibold text-[#111827]">Listado de clientes</h2>
              {currentUser.role === Role.ADMIN && (
                <div className="flex items-center gap-3 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
                  <span className="text-[13px] font-semibold text-[#475569]">{filteredAndSortedClients.length} registros</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${clientUsageRatio * 100}%` }} />
                  </div>
                  <span className="text-[12px] font-semibold text-[#94A3B8]">{clientLimit}</span>
                </div>
              )}
              {currentUser.role !== Role.ADMIN && (
                <span className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5 text-[13px] font-semibold text-[#475569]">
                  {filteredAndSortedClients.length} {filteredAndSortedClients.length === 1 ? 'cliente asignado' : 'clientes asignados'}
                </span>
              )}
            </div>
            {currentUser.role === Role.ADMIN && currentPlan && (
              <p className="text-[14px] font-medium text-[#94A3B8]">
                Plan {currentPlan.name}
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[2.4fr_1.1fr_1fr_1.35fr_0.72fr_0.9fr_0.92fr_0.52fr] px-8 py-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                <span>Cliente</span>
                <span className="text-center">Telefono</span>
                <span className="text-center">Sector</span>
                <span className="text-center">Cobrador</span>
                <span className="text-center">Prest. act.</span>
                <span className="text-center">Ultimo pago</span>
                <span className="text-center">Estado</span>
                <span className="text-center">Acciones</span>
              </div>

              {paginatedClients.map(entry => {
                const branch = branchMap.get(entry.client.branchId);
                const officer = collectorMap.get(entry.client.assignedUserId);
                const lastPaymentDate = entry.client.createdAt;

                return (
                  <div
                    key={entry.client.id}
                    data-client-row
                    className="grid grid-cols-[2.4fr_1.1fr_1fr_1.35fr_0.72fr_0.9fr_0.92fr_0.52fr] items-center border-t border-[#F3F4F6] px-8 py-5 text-[15px] transition-colors duration-200 hover:bg-[#FCFDFE]"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/clients/${entry.client.id}`)}
                      className="group flex min-w-0 cursor-pointer items-center gap-4 text-left transition-all duration-200 hover:translate-x-1"
                    >
                      <ClientAvatar
                        client={entry.client}
                        className="h-12 w-12 rounded-full shadow-[0_10px_22px_rgba(37,99,235,0.18)]"
                        textClassName="text-sm font-black text-[#2563EB]"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[16px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">
                          {entry.client.firstName} {entry.client.lastName}
                        </p>
                        <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{entry.client.nickname || entry.client.cedula}</p>
                      </div>
                    </button>
                    <span className="text-center font-medium text-[#374151]">{entry.client.phone}</span>
                    <span className="text-center font-medium text-[#374151]">{branch?.name || 'Zona'}</span>
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFF6FF] text-[10px] font-black text-[#2563EB]">
                        {officer?.avatar || 'OF'}
                      </div>
                      <span className="font-medium text-[#374151]">{officer?.name || 'Sin asignar'}</span>
                    </div>
                    <span className="text-center font-medium text-[#374151]">{entry.activeLoansCount}</span>
                    <span className="text-center font-medium text-[#374151]">{formatDate(lastPaymentDate)}</span>
                    <div className="flex justify-center">
                      <Badge status={entry.segment === 'Atrasados' ? 'Atrasado' : entry.segment} className="min-w-[124px] justify-center" />
                    </div>
                    <div className="flex justify-center">
                      <ClientRowActions
                        clientId={entry.client.id}
                        onEdit={() => navigate(`/clients/${entry.client.id}`)}
                        onCreateLoan={() => navigate('/loans/new', { state: { clientId: entry.client.id } })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#E5E7EB] px-8 py-6">
            <p className="text-[15px] font-medium text-[#6B7280]">
              {filteredAndSortedClients.length === 0
                ? 'No hay registros para mostrar'
                : `Mostrando ${(safeCurrentPage - 1) * pageSize + 1} a ${Math.min(safeCurrentPage * pageSize, filteredAndSortedClients.length)} de ${filteredAndSortedClients.length} registros`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              {visiblePages.map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-[15px] font-medium ${
                    page === safeCurrentPage
                      ? 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                      : 'border border-transparent text-[#374151] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage === totalPages}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-[platform-fade-in_220ms_ease-out]">
          <div className="platform-modal-panel relative max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[40px] border border-white/60 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)] animate-[platform-modal-fade-up_220ms_ease-out]">
            <button
              onClick={() => setIsModalOpen(false)}
              className="platform-modal-close absolute right-6 top-6 z-10 flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#94A3B8] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
            >
              <X size={20} />
            </button>
            <div className="border-b border-[#E5E7EB] bg-white px-8 pb-7 pt-9">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2563EB]">Nuevo expediente</p>
              <h3 className="mt-2 text-[32px] font-black tracking-tight text-[#111827]">Registrar cliente</h3>
              <p className="mt-3 max-w-[56ch] text-[15px] font-medium leading-7 text-[#64748B]">
                Prepara el alta del expediente con datos limpios, sucursal y oficial responsable.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6 px-8 pb-8 pt-7">
              {formError && <div className="rounded-2xl border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#DC2626]">{formError}</div>}
              <div className="flex justify-center">
                <div className="relative">
                  <div className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-[24px] border ${formData.photo ? 'border-[#2563EB]' : 'border-dashed border-[#D1D5DB] bg-[#F9FAFB]'}`}>
                    {formData.photo ? <img src={formData.photo} alt="Cliente" className="h-full w-full object-cover" /> : <ImageIcon size={28} className="text-[#9CA3AF]" />}
                  </div>
                  <label className="absolute -bottom-2 -right-2 cursor-pointer rounded-2xl bg-[#111827] p-2.5 text-white transition-all duration-200 hover:bg-black hover:shadow-[0_14px_34px_rgba(15,23,42,0.28)]">
                    <Camera size={16} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Nombre" helper="Nombre legal del titular del expediente.">
                  <input
                    required
                    className="h-[56px] w-full rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 text-[16px] font-semibold tracking-[-0.01em] text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD] focus:bg-white focus:shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
                    value={formData.firstName}
                    onChange={event => setFormData({ ...formData, firstName: cleanTextInput(event.target.value) })}
                    placeholder="Nombre"
                  />
                </Field>
                <Field label="Apellido" helper="Apellido principal o familiar del cliente.">
                  <input
                    required
                    className="h-[56px] w-full rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 text-[16px] font-semibold tracking-[-0.01em] text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD] focus:bg-white focus:shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
                    value={formData.lastName}
                    onChange={event => setFormData({ ...formData, lastName: cleanTextInput(event.target.value) })}
                    placeholder="Apellido"
                  />
                </Field>
              </div>
              <Field label="Apodo" helper="Alias o referencia corta para ubicarlo mas rapido.">
                <input
                  className="h-[56px] w-full rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 text-[16px] font-semibold tracking-[-0.01em] text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD] focus:bg-white focus:shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
                  value={formData.nickname}
                  onChange={event => setFormData({ ...formData, nickname: cleanTextInput(event.target.value) })}
                  placeholder="Apodo (opcional)"
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Cedula" helper="Se formatea automaticamente en patron local.">
                  <input
                    required
                    inputMode="numeric"
                    className="h-[56px] w-full rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 text-[16px] font-semibold tracking-[-0.01em] text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD] focus:bg-white focus:shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
                    value={formData.cedula}
                    onChange={event => setFormData({ ...formData, cedula: formatCedulaInput(event.target.value) })}
                    placeholder="000-0000000-0"
                  />
                </Field>
                <Field label="Telefono" helper="Numero principal de contacto del cliente.">
                  <input
                    required
                    inputMode="numeric"
                    className="h-[56px] w-full rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 text-[16px] font-semibold tracking-[-0.01em] text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD] focus:bg-white focus:shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
                    value={formData.phone}
                    onChange={event => setFormData({ ...formData, phone: formatPhoneInput(event.target.value) })}
                    placeholder="809-000-0000"
                  />
                </Field>
              </div>
              <Field label="Direccion de cobro" helper="Sector, referencia y detalles utiles para el recorrido.">
                <div className="space-y-2">
                  <textarea
                    required
                    className="h-[116px] w-full rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3.5 text-[15px] font-medium leading-7 text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD] focus:bg-white focus:shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
                    value={formData.address}
                    onChange={event => setFormData({ ...formData, address: cleanTextInput(event.target.value).slice(0, 180) })}
                    placeholder="Direccion de cobro"
                  />
                  <div className="flex items-center justify-between gap-3 text-[12px] font-medium text-[#94A3B8]">
                    <span>Incluye calle, sector, referencia y punto de visita.</span>
                    <span>{formData.address.length}/180</span>
                  </div>
                </div>
              </Field>
              {currentUser.role !== Role.COBRADOR && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Sucursal" helper="Determina la cobertura operativa del expediente.">
                    <FormDropdown
                      value={formData.branchId}
                      onChange={value => setFormData({ ...formData, branchId: value, assignedUserId: '' })}
                      options={branches.map(branch => ({ value: branch.id, label: branch.name }))}
                      placeholder="Asignar sucursal"
                      isOpen={openCreateFilter === 'branch'}
                      onToggle={() => setOpenCreateFilter(current => (current === 'branch' ? null : 'branch'))}
                      onRequestClose={() => setOpenCreateFilter(null)}
                    />
                  </Field>
                  <Field label="Oficial responsable" helper="Usuario que dara seguimiento y cobro al cliente.">
                    <FormDropdown
                      value={formData.assignedUserId}
                      onChange={value => setFormData({ ...formData, assignedUserId: value })}
                      options={availableAssignees.map(user => ({ value: user.id, label: user.name }))}
                      placeholder="Asignar oficial responsable"
                      isOpen={openCreateFilter === 'assignee'}
                      onToggle={() => setOpenCreateFilter(current => (current === 'assignee' ? null : 'assignee'))}
                      onRequestClose={() => setOpenCreateFilter(null)}
                    />
                  </Field>
                </div>
              )}
              <button type="submit" disabled={isSaving || access.restricted || !canAddClient} className="mt-2 flex h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-[#2563EB] text-[17px] font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_22px_44px_rgba(37,99,235,0.34)] disabled:cursor-not-allowed disabled:bg-[#93C5FD] disabled:shadow-none disabled:hover:translate-x-0">
                {access.restricted ? <Lock size={17} /> : isSaving ? <Save size={18} /> : <Plus size={18} />}
                {isSaving ? 'Guardando...' : 'Registrar expediente'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ClientRowActions = ({
  clientId,
  onEdit,
  onCreateLoan,
}: {
  clientId: string;
  onEdit: () => void;
  onCreateLoan: () => void;
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, placement: 'bottom' as 'bottom' | 'top' });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 220;
      const menuHeight = 172;
      const spacing = 10;
      const shouldOpenUp = window.innerHeight - rect.bottom < menuHeight + spacing && rect.top > menuHeight + spacing;
      setMenuPosition({
        top: shouldOpenUp ? rect.top - menuHeight - spacing : rect.bottom + spacing,
        left: Math.min(Math.max(16, rect.right - menuWidth), window.innerWidth - menuWidth - 16),
        placement: shouldOpenUp ? 'top' : 'bottom',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const itemClassName =
    'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]';

  const handleNavigate = (to: string, state?: unknown) => {
    setIsOpen(false);
    navigate(to, state ? { state } : undefined);
  };

  return (
    <div ref={containerRef} className="relative z-20">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(open => !open)}
        className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-[14px] font-semibold transition-all duration-200 ${
          isOpen
            ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_30px_rgba(37,99,235,0.12)]'
            : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:translate-x-1 hover:border-[#DBEAFE] hover:text-[#2563EB]'
        }`}
        aria-label="Acciones del cliente"
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed z-[220] w-[220px] rounded-[24px] border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
            style={{ top: menuPosition.top, left: menuPosition.left }}
            ref={menuRef}
          >
            <button
              type="button"
              onClick={() => handleNavigate(`/clients/${clientId}`)}
              className={itemClassName}
            >
              <Eye size={17} className="text-[#2563EB]" />
              Ver perfil
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(`/clients/${clientId}`, { initialTab: 'EDITAR' })}
              className={itemClassName}
            >
              <Edit2 size={17} className="text-[#2563EB]" />
              Editar expediente
            </button>
            <button
              type="button"
              onClick={() => {
                handleNavigate('/loans/new', { clientId });
              }}
              className={itemClassName}
            >
              <Wallet size={17} className="text-[#2563EB]" />
              Crear prestamo
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
};

const FilterDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${isOpen ? 'z-[70]' : 'z-20'}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(open => !open)}
        className={`flex h-[54px] w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left transition-all duration-200 ${
          disabled
            ? 'border-[#E5E7EB] opacity-60'
            : isOpen
              ? 'border-[#93C5FD] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
              : 'border-[#E5E7EB] hover:border-[#DBEAFE] hover:shadow-sm'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[16px] font-medium text-[#111827]">{selected?.label || placeholder}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-[calc(100%+10px)] z-[80] w-max min-w-[260px] max-w-[340px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
              !value ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
            }`}
          >
            <span>{placeholder}</span>
            {!value && <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />}
          </button>
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
                  isSelected ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const FormDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  isOpen,
  onToggle,
  onRequestClose,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onRequestClose: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    placement: 'bottom' as 'bottom' | 'top',
  });
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideTrigger = containerRef.current?.contains(target);
      const isInsideMenu = menuRef.current?.contains(target);
      if (!isInsideTrigger && !isInsideMenu) {
        onRequestClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onRequestClose]);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const estimatedHeight = Math.min(options.length + 1, 6) * 58 + 18;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placement = spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? 'top' : 'bottom';

      setMenuPosition({
        top: placement === 'bottom' ? rect.bottom + 10 : rect.top - 10,
        left: rect.left,
        width: rect.width,
        placement,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, options.length]);

  return (
    <div className={`relative ${isOpen ? 'z-[90]' : 'z-10'}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-14 w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left transition-all duration-200 ${
          disabled
            ? 'border-[#E5E7EB] opacity-60'
            : isOpen
              ? 'border-[#93C5FD] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
              : 'border-[#E5E7EB] hover:border-[#DBEAFE] hover:shadow-sm'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[#111827]">{selected?.label || placeholder}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && createPortal(
        <div
          ref={menuRef}
          onMouseDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
          className="fixed z-[260] w-max max-w-[340px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            minWidth: Math.max(menuPosition.width, 260),
            transform: menuPosition.placement === 'top' ? 'translateY(-100%)' : undefined,
          }}
        >
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              onChange('');
              onRequestClose();
            }}
            className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
              !value ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
            }`}
          >
            <span>{placeholder}</span>
            {!value && <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />}
          </button>
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={event => {
                  event.stopPropagation();
                  onChange(option.value);
                  onRequestClose();
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
                  isSelected ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
};

const Field = ({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) => (
  <div className="block">
    <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">{label}</span>
    {children}
    {helper ? <span className="mt-2 block text-[12px] font-medium leading-5 text-[#94A3B8]">{helper}</span> : null}
  </div>
);
