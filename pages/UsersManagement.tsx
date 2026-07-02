import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Filter,
  Image as ImageIcon,
  MoreHorizontal,
  Search,
  Shield,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import gsap from 'gsap';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  canCreateResource,
  createUser,
  getCompanyById,
  getGlobalActivity,
  getSaaSPlans,
  getUsers,
  updateUser,
  upsertBranchesInLocalStorage,
  upsertUsersInLocalStorage,
} from '../services/dataService';
import { getBranchScope, getScopedClients, getScopedUsers } from '../services/viewScope';
import { Branch, Role, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiClient, ApiUnavailableError, AuditLogItem } from '../services/apiClient';
import { optimizeImageFile } from '../services/imageOptimizer';
import { emitPlatformToast, openPlatformCriticalModal, setPlatformLoading } from '../services/platformEvents';

const PAGE_SIZE = 8;
const SUBVIEW_PAGE_SIZE = 10;
const pieColors = ['#16A34A', '#2563EB', '#7C3AED', '#F97316', '#0EA5E9', '#94A3B8'];
const horizontalMotionClass =
  'transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]';
const tableRowMotionClass =
  'transition-colors duration-200 hover:bg-[#FCFDFF]';

const buildInviteMailTo = (payload: { email: string; fullName: string; username: string; role: Role; branchName: string; note?: string }) => {
  const subject = encodeURIComponent('Invitacion a PrestaFacil RD');
  const body = encodeURIComponent(
    [
      `Hola ${payload.fullName || 'equipo'},`,
      '',
      'Te hemos preparado un acceso a PrestaFacil RD.',
      `Usuario: ${payload.username}`,
      `Rol: ${payload.role}`,
      `Sucursal: ${payload.branchName}`,
      '',
      'Cuando inicies sesion por primera vez, el sistema te pedira definir tu propia clave.',
      payload.note ? '' : undefined,
      payload.note ? `Nota operativa: ${payload.note}` : undefined,
      '',
      'Equipo PrestaFacil RD',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  return `mailto:${payload.email}?subject=${subject}&body=${body}`;
};

const roleToneMap: Record<string, { chip: string }> = {
  [Role.SUPER_ADMIN]: { chip: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]' },
  [Role.ADMIN]: { chip: 'border-[#DDD6FE] bg-[#F5F3FF] text-[#7C3AED]' },
  [Role.SUPERVISOR]: { chip: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]' },
  [Role.COBRADOR]: { chip: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]' },
};

const statusToneMap: Record<string, string> = {
  Activo: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]',
  Suspendido: 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]',
};

export const UsersManagement: React.FC = () => {
  const { currentUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const branchScope = useMemo(() => getBranchScope(currentUser), [currentUser]);
  const canSeeAllCompanyUsers = branchScope.canSeeAllCompanyUsers;
  const canManageTeam = [Role.SUPER_ADMIN, Role.ADMIN, Role.SUPERVISOR].includes(currentUser.role);
  const company = useMemo(() => getCompanyById(currentUser.companyId), [currentUser.companyId]);
  const currentPlan = useMemo(() => getSaaSPlans().find(plan => plan.id === company?.planId), [company?.planId]);

  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [openFilter, setOpenFilter] = useState<'role' | 'branch' | 'status' | null>(null);
  const [rolesInfoOpen, setRolesInfoOpen] = useState(false);
  const userLimitToastShownRef = useRef(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formError, setFormError] = useState('');
  const [canAddUser, setCanAddUser] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    role: Role.COBRADOR,
    phone: '',
    branchId: '',
    isActive: true,
    photo: '',
  });

  const allowedRoles = useMemo(() => {
    if (currentUser.role === Role.SUPER_ADMIN) return [Role.SUPER_ADMIN, Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR];
    if (currentUser.role === Role.ADMIN) return [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR];
    if (currentUser.role === Role.SUPERVISOR) return [Role.COBRADOR];
    return [];
  }, [currentUser.role]);

  useEffect(() => {
    gsap.fromTo('[data-users-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
    gsap.fromTo('[data-users-insights]', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.1 });
    gsap.fromTo('[data-users-filters]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.16 });
    gsap.fromTo('[data-users-list]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.22 });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setUsers(getScopedUsers(currentUser));
      setClients(getScopedClients(currentUser));
      setBranches(branchScope.branches);
      setCanAddUser(canCreateResource(currentUser.companyId, 'USER'));

      try {
        const [apiUsers, apiClients, apiBranches] = await Promise.all([
          apiClient.listUsers(),
          apiClient.listClients(),
          apiClient.listBranches(),
        ]);
        if (!isMounted) return;

        upsertUsersInLocalStorage(apiUsers.data);
        upsertBranchesInLocalStorage(apiBranches.data);

        const visibleBranchIds = new Set(branchScope.visibleBranchIds);
        setUsers(apiUsers.data.filter(user => currentUser.role === Role.SUPER_ADMIN || visibleBranchIds.has(user.branchId)));
        setClients(apiClients.data);
        setBranches(apiBranches.data.filter(branch => currentUser.role === Role.SUPER_ADMIN || visibleBranchIds.has(branch.id)));
      } catch (error) {
        if (!(error instanceof ApiUnavailableError) && isMounted) {
          emitPlatformToast({
            title: 'No se pudo cargar el equipo',
            message: error instanceof Error ? error.message : 'No se pudo cargar el equipo desde la API.',
            tone: 'error',
            durationMs: 5200,
          });
        }
      }
    };

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [branchScope, currentUser]);

  useEffect(() => {
    setSelectedBranchId(currentUser.branchId);
  }, [currentUser.branchId]);

  useEffect(() => {
    setUsersPage(1);
  }, [searchTerm, selectedBranchId, selectedRole, selectedStatus]);

  useEffect(() => {
    if (canManageTeam && !canAddUser && !userLimitToastShownRef.current) {
      emitPlatformToast({
        title: 'Limite de usuarios alcanzado',
        message: 'Tu plan actual ya alcanzo el maximo de usuarios disponibles. Puedes editar los existentes o ampliar el plan.',
        tone: 'warning',
        durationMs: 5200,
      });
      userLimitToastShownRef.current = true;
      return;
    }

    if (canAddUser) {
      userLimitToastShownRef.current = false;
    }
  }, [canAddUser, canManageTeam]);

  const getBranchName = (branchId: string) => branches.find(branch => branch.id === branchId)?.name || 'Sin sucursal';
  const getCollectorStats = (userId: string) => clients.filter(client => client.assignedUserId === userId).length;

  const canManageUser = (targetUser: User) => {
    if (!canManageTeam) return false;
    if (targetUser.id === currentUser.id) return false;
    if (currentUser.role === Role.SUPER_ADMIN) return true;
    if (targetUser.role === Role.SUPER_ADMIN) return false;
    if (!branchScope.visibleBranchIds.includes(targetUser.branchId)) return false;
    if (currentUser.role === Role.ADMIN) return targetUser.companyId === currentUser.companyId;
    if (currentUser.role === Role.SUPERVISOR) return targetUser.role === Role.COBRADOR && targetUser.branchId === currentUser.branchId;
    return false;
  };

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return users.filter(user => {
      const matchesBranch = !selectedBranchId || user.branchId === selectedBranchId;
      const matchesRole = selectedRole === 'ALL' || user.role === selectedRole;
      const statusLabel = user.isActive ? 'Activo' : 'Suspendido';
      const matchesStatus = selectedStatus === 'ALL' || statusLabel === selectedStatus;
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        (user.phone || '').toLowerCase().includes(query);
      return matchesBranch && matchesRole && matchesStatus && matchesSearch;
    });
  }, [users, selectedBranchId, selectedRole, selectedStatus, searchTerm]);

  const paginatedUsers = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    const safePage = Math.min(usersPage, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return {
      page: safePage,
      totalPages,
      items: filteredUsers.slice(start, start + PAGE_SIZE),
      start: filteredUsers.length ? start + 1 : 0,
      end: Math.min(start + PAGE_SIZE, filteredUsers.length),
    };
  }, [filteredUsers, usersPage]);
  const companyUserCount = useMemo(() => getUsers(currentUser.companyId).length, [currentUser.companyId, users]);
  const userLimit = currentPlan?.maxUsers || Math.max(companyUserCount, 1);
  const userUsageRatio = Math.min(companyUserCount / userLimit, 1);

  const roleDistribution = useMemo(() => {
    const counts = filteredUsers.reduce<Record<string, number>>((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([role, value], index) => ({
      name: role,
      value,
      color: pieColors[index % pieColors.length],
      share: filteredUsers.length ? Math.round((value / filteredUsers.length) * 1000) / 10 : 0,
    }));
  }, [filteredUsers]);

  const recentActivity = useMemo(() => {
    return filteredUsers
      .map(user => ({
        id: user.id,
        name: user.name,
        detail: `${user.isActive ? 'Cuenta activa' : 'Cuenta suspendida'} · ${getBranchName(user.branchId)}`,
        time: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('es-DO') : 'Sin acceso reciente',
        tone: user.isActive ? 'green' : 'red',
      }))
      .slice(0, 5);
  }, [filteredUsers, branches]);

  const accessByBranch = useMemo(() => {
    const rows = branches
      .map(branch => ({
        id: branch.id,
        name: branch.name,
        total: filteredUsers.filter(user => user.branchId === branch.id).length,
      }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total);
    const max = rows[0]?.total || 1;
    return rows.map(item => ({ ...item, share: Math.round((item.total / max) * 100) }));
  }, [branches, filteredUsers]);

  const kpis = useMemo(() => {
    const activeUsers = filteredUsers.filter(user => user.isActive).length;
    const supervisors = filteredUsers.filter(user => user.role === Role.SUPERVISOR).length;
    const collectors = filteredUsers.filter(user => user.role === Role.COBRADOR).length;
    const branchCount = new Set(filteredUsers.map(user => user.branchId)).size;
    return [
      { label: 'Usuarios activos', value: String(activeUsers), helper: `${filteredUsers.length} usuarios visibles`, share: filteredUsers.length ? Math.round((activeUsers / filteredUsers.length) * 1000) / 10 : 0, tone: 'emerald', icon: Users },
      { label: 'Supervisores', value: String(supervisors), helper: 'Supervision operativa', share: filteredUsers.length ? Math.round((supervisors / filteredUsers.length) * 1000) / 10 : 0, tone: 'blue', icon: Shield },
      { label: 'Cobradores', value: String(collectors), helper: 'Equipo de campo activo', share: filteredUsers.length ? Math.round((collectors / filteredUsers.length) * 1000) / 10 : 0, tone: 'violet', icon: Briefcase },
      { label: 'Sucursales con acceso', value: String(branchCount), helper: `${branches.length} sucursales visibles`, share: branches.length ? Math.round((branchCount / branches.length) * 1000) / 10 : 0, tone: 'amber', icon: Building2 },
    ] as const;
  }, [filteredUsers, branches.length]);

  const refreshTeamFromApi = async () => {
    const [apiUsers, apiBranches] = await Promise.all([apiClient.listUsers(), apiClient.listBranches()]);
    upsertUsersInLocalStorage(apiUsers.data);
    upsertBranchesInLocalStorage(apiBranches.data);
    const visibleBranchIds = new Set(branchScope.visibleBranchIds);
    setUsers(apiUsers.data.filter(user => currentUser.role === Role.SUPER_ADMIN || visibleBranchIds.has(user.branchId)));
    setBranches(apiBranches.data.filter(branch => currentUser.role === Role.SUPER_ADMIN || visibleBranchIds.has(branch.id)));
  };

  const refreshTeamFromLocal = () => {
    const visibleBranchIds = new Set(branchScope.visibleBranchIds);
    setUsers(getUsers(currentUser.companyId).filter(user => visibleBranchIds.has(user.branchId)));
    setBranches(branchScope.branches);
  };

  const resetForm = () => {
    setFormError('');
    setFormData({
      name: '',
      username: '',
      role: Role.COBRADOR,
      phone: '',
      branchId: currentUser.branchId,
      isActive: true,
      photo: '',
    });
    setEditingUser(null);
  };

  const openEditor = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        username: user.username,
        role: user.role,
        phone: user.phone || '',
        branchId: user.branchId,
        isActive: user.isActive,
        photo: user.photo || '',
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
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
    setFormError('');
    try {
      const payload = {
        ...formData,
        branchId: canSeeAllCompanyUsers ? formData.branchId : currentUser.branchId,
        avatar: formData.name
          .split(' ')
          .filter(Boolean)
          .map(item => item[0])
          .join('')
          .toUpperCase(),
      };
      if (!allowedRoles.includes(payload.role)) throw new Error('Tu rol no permite asignar ese nivel de acceso.');
      if (editingUser && !canManageUser(editingUser)) throw new Error('No tienes permiso para modificar este usuario.');

      if (editingUser) {
        try {
          const response = await apiClient.updateUser(editingUser.id, payload);
          upsertUsersInLocalStorage([response.data]);
          await refreshTeamFromApi();
        } catch (error) {
          if (!(error instanceof ApiUnavailableError)) throw error;
          updateUser(editingUser.id, payload);
          refreshTeamFromLocal();
        }
      } else {
        try {
          const response = await apiClient.createUser(payload);
          upsertUsersInLocalStorage([response.data]);
          await refreshTeamFromApi();
        } catch (error) {
          if (!(error instanceof ApiUnavailableError)) throw error;
          createUser(payload, currentUser.id);
          refreshTeamFromLocal();
        }
      }

      refreshUser();
      setCanAddUser(canCreateResource(currentUser.companyId, 'USER'));
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar el usuario.');
    }
  };

  const toggleStatus = async (user: User) => {
    try {
      if (!canManageUser(user)) throw new Error('No tienes permiso para cambiar el estado de este usuario.');
      const payload = { isActive: !user.isActive };
      try {
        const response = await apiClient.updateUser(user.id, payload);
        upsertUsersInLocalStorage([response.data]);
        await refreshTeamFromApi();
      } catch (error) {
        if (!(error instanceof ApiUnavailableError)) throw error;
        updateUser(user.id, payload);
        refreshTeamFromLocal();
      }
      refreshUser();
    } catch (error) {
      emitPlatformToast({
        title: 'No se pudo actualizar el estado',
        message: error instanceof Error ? error.message : 'No se pudo actualizar el estado.',
        tone: 'error',
        durationMs: 5200,
      });
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedRole('ALL');
    setSelectedStatus('ALL');
    setSelectedBranchId(canSeeAllCompanyUsers ? '' : currentUser.branchId);
    setOpenFilter(null);
  };

  const exportCsv = () => {
    const rows = [
      ['Usuario', 'Username', 'Telefono', 'Rol', 'Sucursal', 'Estado', 'Clientes asignados'],
      ...filteredUsers.map(user => [
        user.name,
        user.username,
        user.phone || '',
        user.role,
        getBranchName(user.branchId),
        user.isActive ? 'Activo' : 'Suspendido',
        String(getCollectorStats(user.id)),
      ]),
    ];
    const blob = new Blob([rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'usuarios.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <section data-users-hero>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-[52px] font-black leading-none tracking-tight text-[#111827]">Usuarios</h1>
            <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">
              Administra usuarios, roles, accesos y estado operativo del equipo con una lectura premium del modulo.
            </p>
            {!canSeeAllCompanyUsers ? <p className="mt-4 text-[12px] font-black uppercase tracking-[0.22em] text-[#F97316]">Vista limitada a tu sucursal</p> : null}
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">
            <button type="button" onClick={exportCsv} className={`inline-flex h-[56px] min-w-[172px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
              <ArrowDownToLine size={18} />
              Exportar CSV
            </button>
            <button type="button" onClick={() => navigate('/users/roles')} className={`inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
              <Shield size={18} />
              Roles y permisos
            </button>
            <button type="button" onClick={() => navigate('/users/invite')} className={`inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
              <UserPlus size={18} />
              Invitar usuario
            </button>
            <button
              type="button"
              onClick={() => {
                if (canAddUser && canManageTeam) navigate('/users/new');
              }}
              disabled={!canAddUser || !canManageTeam}
              className="inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus size={18} />
              Crear usuario
            </button>
          </div>
        </div>
      </section>

      {!canManageTeam ? (
        <div className="rounded-[24px] border border-[#DBEAFE] bg-[#EFF6FF] px-5 py-4 text-[13px] font-semibold text-[#2563EB]">
          Tu rol actual permite consulta del equipo, pero no crear o modificar usuarios.
        </div>
      ) : null}

      {rolesInfoOpen ? (
        <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[22px] font-black tracking-tight text-[#111827]">Roles y permisos visibles</h2>
              <p className="mt-2 text-[14px] font-medium text-[#64748B]">Referencia rapida para administrar el equipo sin salir del modulo.</p>
            </div>
            <button type="button" onClick={() => setRolesInfoOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]">
              <X size={18} />
            </button>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-4">
            {[
              [Role.SUPER_ADMIN, 'Control total del tenant, usuarios y configuracion.'],
              [Role.ADMIN, 'Gestiona operacion, equipos y modulos de la empresa.'],
              [Role.SUPERVISOR, 'Audita y coordina cobradores de su alcance visible.'],
              [Role.COBRADOR, 'Opera rutas, cobros y seguimiento de clientes.'],
            ].map(([role, detail]) => (
              <div key={role} className="rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFF] p-4">
                <span className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-semibold ${roleToneMap[role].chip}`}>{role}</span>
                <p className="mt-3 text-[14px] font-medium text-[#64748B]">{detail}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section data-users-insights className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {kpis.map(card => {
          const tone =
            card.tone === 'emerald'
              ? { icon: 'bg-[#DCFCE7] text-[#16A34A]', watermark: 'text-[#86EFAC]', helper: 'text-[#16A34A]' }
              : card.tone === 'amber'
                ? { icon: 'bg-[#FEF3C7] text-[#D97706]', watermark: 'text-[#FCD34D]', helper: 'text-[#D97706]' }
                : card.tone === 'violet'
                  ? { icon: 'bg-[#EDE9FE] text-[#7C3AED]', watermark: 'text-[#C4B5FD]', helper: 'text-[#7C3AED]' }
                  : { icon: 'bg-[#DBEAFE] text-[#2563EB]', watermark: 'text-[#93C5FD]', helper: 'text-[#2563EB]' };
          const Icon = card.icon;
          return (
            <article key={card.label} className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${tone.icon}`}>
                  <Icon size={24} />
                </div>
                <div className="text-right">
                  <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Participacion</p>
                  <p className="mt-1 text-[16px] font-semibold leading-none text-[#111827]">{card.share}%</p>
                </div>
              </div>
              <div className="mt-8 space-y-3">
                <p className="text-[17px] font-semibold tracking-tight text-[#111827]">{card.label}</p>
                <p className="text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{card.value}</p>
                <p className={`max-w-[180px] text-[15px] font-medium leading-6 ${tone.helper}`}>{card.helper}</p>
              </div>
              <Icon size={88} className={`pointer-events-none absolute bottom-4 right-4 ${tone.watermark} opacity-[0.08]`} strokeWidth={1.7} />
            </article>
          );
        })}
      </section>

      <section data-users-filters className="relative z-20 rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1.1fr)_220px_220px_220px_176px]">
          <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 transition-all duration-200 hover:border-[#DBEAFE] focus-within:border-[#93C5FD] focus-within:shadow-[0_10px_24px_rgba(37,99,235,0.10)]">
            <Search size={18} className="pointer-events-none text-[#6B7280]" />
            <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Buscar usuario, telefono o username" className="w-full bg-transparent text-[15px] font-semibold text-[#111827] outline-none placeholder:text-[#94A3B8]" />
          </div>
          <FilterDropdown value={selectedRole} onChange={setSelectedRole} options={[{ value: 'ALL', label: 'Todos los roles' }, ...allowedRoles.map(role => ({ value: role, label: role }))]} isOpen={openFilter === 'role'} onToggle={() => setOpenFilter(current => (current === 'role' ? null : 'role'))} onRequestClose={() => setOpenFilter(null)} />
          <FilterDropdown value={selectedBranchId} onChange={setSelectedBranchId} options={[...(canSeeAllCompanyUsers ? [{ value: '', label: 'Todas las sucursales' }] : []), ...branches.map(branch => ({ value: branch.id, label: branch.name }))]} disabled={!canSeeAllCompanyUsers} isOpen={openFilter === 'branch'} onToggle={() => setOpenFilter(current => (current === 'branch' ? null : 'branch'))} onRequestClose={() => setOpenFilter(null)} />
          <FilterDropdown value={selectedStatus} onChange={setSelectedStatus} options={[{ value: 'ALL', label: 'Todos los estados' }, { value: 'Activo', label: 'Activos' }, { value: 'Suspendido', label: 'Suspendidos' }]} isOpen={openFilter === 'status'} onToggle={() => setOpenFilter(current => (current === 'status' ? null : 'status'))} onRequestClose={() => setOpenFilter(null)} />
          <button type="button" onClick={resetFilters} className={`inline-flex h-[56px] min-w-0 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#374151] ${horizontalMotionClass}`}>
            <Filter size={18} />
            Limpiar filtros
          </button>
        </div>
      </section>

      <section data-users-list className="space-y-6">
        <section className="rounded-[32px] border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[32px] font-black tracking-tight text-[#111827]">Listado de usuarios</h2>
              <p className="mt-2 text-[15px] font-medium text-[#64748B]">Mostrando {filteredUsers.length} usuario(s) de {selectedBranchId ? getBranchName(selectedBranchId) : 'todas las sucursales'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-right">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5">
                <span className="text-[13px] font-semibold text-[#475569]">{filteredUsers.length} usuarios</span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${userUsageRatio * 100}%` }} />
                </div>
                <span className="text-[12px] font-semibold text-[#94A3B8]">{userLimit}</span>
              </div>
              <span className="text-[13px] font-medium text-[#94A3B8]">{currentPlan ? `Plan ${currentPlan.name}` : 'Equipo operativo'}</span>
            </div>
          </div>

          <div className="p-6">
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[2.2fr_1fr_0.9fr_1fr_0.82fr_0.58fr_0.42fr] gap-4 border-b border-[#EEF2F7] px-4 pb-4 text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">
                  <span>Usuario</span>
                  <span className="text-center">Telefono</span>
                  <span className="text-center">Rol</span>
                  <span className="text-center">Sucursal</span>
                  <span className="text-center">Estado</span>
                  <span className="text-center">Clientes</span>
                  <span className="text-center">Acciones</span>
                </div>
                <div className="divide-y divide-[#EEF2F7]">
                  {paginatedUsers.items.map(user => {
                    const statusLabel = user.isActive ? 'Activo' : 'Suspendido';
                    return (
                      <div
                        key={user.id}
                        onClick={() => navigate(`/users/${user.id}`)}
                        className="grid grid-cols-[2.2fr_1fr_0.9fr_1fr_0.82fr_0.58fr_0.42fr] gap-4 px-4 py-4 cursor-pointer group transition-all duration-200 hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                      >
                        <div className="flex items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
                          {user.photo ? (
                            <img src={user.photo} alt={user.name} className="h-12 w-12 rounded-full border border-[#E5E7EB] object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[16px] font-black text-[#2563EB]">
                              {user.avatar || user.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-[15px] font-bold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{user.name}</p>
                            <p className="mt-1 text-[12px] font-medium text-[#64748B]">@{user.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-center text-center text-[14px] font-medium text-[#64748B]">{user.phone || 'Sin telefono'}</div>
                        <div className="flex items-center justify-center">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-semibold ${roleToneMap[user.role].chip}`}>{user.role}</span>
                        </div>
                        <div className="flex items-center justify-center text-center text-[14px] font-medium text-[#64748B]">{getBranchName(user.branchId)}</div>
                        <div className="flex items-center justify-center">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-semibold ${statusToneMap[statusLabel]}`}>{statusLabel}</span>
                        </div>
                        <div className="flex items-center justify-center text-center text-[15px] font-bold text-[#111827]">{getCollectorStats(user.id)}</div>
                        <div className="flex items-center justify-center">
                          <UserRowActions
                            user={user}
                            canManage={canManageUser(user)}
                            onView={() => navigate(`/users/${user.id}`)}
                            onEdit={() => navigate(`/users/${user.id}?tab=edit`)}
                            onToggle={() => void toggleStatus(user)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#EEF2F7] pt-4">
              <p className="text-[13px] font-medium text-[#64748B]">{`Mostrando ${paginatedUsers.start} a ${paginatedUsers.end} de ${filteredUsers.length} usuarios`}</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setUsersPage(current => Math.max(1, current - 1))} disabled={paginatedUsers.page === 1} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <span className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-[14px] font-semibold text-[#2563EB]">{paginatedUsers.page}</span>
                <button type="button" onClick={() => setUsersPage(current => Math.min(paginatedUsers.totalPages, current + 1))} disabled={paginatedUsers.page === paginatedUsers.totalPages} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_320px]">
          <SidebarPanel title="Distribucion por rol" actionLabel="Equipo visible">
            <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
              <div className="relative h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={roleDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={3}>
                      {roleDistribution.map((item, index) => (
                        <Cell key={item.name} fill={item.color || pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<RolePieTooltip />} wrapperStyle={{ zIndex: 80, pointerEvents: 'none' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[34px] font-black leading-none tracking-tight text-[#111827]">{filteredUsers.length}</span>
                  <span className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Total</span>
                </div>
              </div>
              <div className="space-y-3">
                {roleDistribution.length ? roleDistribution.map(item => (
                  <div key={item.name} className="flex items-center justify-between gap-3 rounded-[18px] border border-[#F1F5F9] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[14px] font-semibold text-[#111827]">{item.name}</span>
                    </div>
                    <span className="text-[13px] font-semibold text-[#64748B]">{item.value} ({item.share}%)</span>
                  </div>
                )) : <EmptyState label="Aun no hay distribucion visible." compact />}
              </div>
            </div>
          </SidebarPanel>

          <SidebarPanel title="Actividad reciente" actionLabel="Ver estado">
            {recentActivity.length ? recentActivity.map(activity => (
              <div key={activity.id} className="flex items-start justify-between gap-3 rounded-[22px] border border-[#F1F5F9] px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl ${activity.tone === 'green' ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
                    {activity.tone === 'green' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#111827]">{activity.name}</p>
                    <p className="mt-1 text-[13px] font-medium text-[#64748B]">{activity.detail}</p>
                  </div>
                </div>
                <span className="text-[12px] font-semibold text-[#94A3B8]">{activity.time}</span>
              </div>
            )) : <EmptyState label="Aun no hay actividad visible." compact />}
          </SidebarPanel>

          <SidebarPanel title="Accesos por sucursal" actionLabel="Ver reporte">
            {accessByBranch.length ? (
              <div className="space-y-4">
                {accessByBranch.map(item => (
                  <div key={item.id}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-[14px] font-semibold text-[#111827]">{item.name}</span>
                      <span className="text-[14px] font-bold text-[#111827]">{item.total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                      <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${item.share}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState label="Sin sucursales con acceso visible." compact />}
          </SidebarPanel>
        </section>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[36px] border border-white/60 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]">
            <button type="button" onClick={() => setIsModalOpen(false)} className="absolute right-6 top-6 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]">
              <X size={20} />
            </button>

            <div className="border-b border-[#E5E7EB] px-8 py-7">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563EB]">Usuarios</p>
              <h3 className="mt-2 text-[28px] font-black tracking-tight text-[#111827]">{editingUser ? 'Actualizar usuario' : 'Crear nuevo usuario'}</h3>
              <p className="mt-2 text-[15px] font-medium text-[#64748B]">Gestiona perfil, rol, sucursal y estado del miembro del equipo.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-8 py-7">
              {formError ? <div className="rounded-[22px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#DC2626]">{formError}</div> : null}

              <div className="flex justify-center">
                <div className="relative">
                  <div className={`flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border-4 ${formData.photo ? 'border-[#2563EB]' : 'border-[#E5E7EB] bg-[#F8FAFC]'}`}>
                    {formData.photo ? <img src={formData.photo} alt="Vista previa" className="h-full w-full object-cover" /> : <ImageIcon size={34} className="text-[#94A3B8]" />}
                  </div>
                  <label className="absolute bottom-0 right-0 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl bg-[#111827] text-white shadow-lg transition-all duration-200 hover:translate-x-1">
                    <Camera size={16} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Nombre completo">
                  <input required value={formData.name} onChange={event => setFormData(current => ({ ...current, name: event.target.value }))} placeholder="Ej: Roberto Sanchez" className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]" />
                </Field>
                <Field label="Usuario de acceso">
                  <input required value={formData.username} onChange={event => setFormData(current => ({ ...current, username: event.target.value }))} placeholder="roberto_rd" className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]" />
                </Field>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Telefono">
                  <input value={formData.phone} onChange={event => setFormData(current => ({ ...current, phone: event.target.value }))} placeholder="809-000-0000" className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]" />
                </Field>
                <Field label="Rol del sistema">
                  <select value={formData.role} onChange={event => setFormData(current => ({ ...current, role: event.target.value as Role }))} className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]">
                    {allowedRoles.includes(Role.SUPER_ADMIN) ? <option value={Role.SUPER_ADMIN}>Super Admin</option> : null}
                    {allowedRoles.includes(Role.ADMIN) ? <option value={Role.ADMIN}>Administrador</option> : null}
                    {allowedRoles.includes(Role.SUPERVISOR) ? <option value={Role.SUPERVISOR}>Supervisor</option> : null}
                    {allowedRoles.includes(Role.COBRADOR) ? <option value={Role.COBRADOR}>Cobrador</option> : null}
                  </select>
                </Field>
              </div>

              {canSeeAllCompanyUsers ? (
                <Field label="Sucursal asignada">
                  <select value={formData.branchId} onChange={event => setFormData(current => ({ ...current, branchId: event.target.value }))} className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]">
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <div className="flex gap-4 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="inline-flex h-[56px] flex-1 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[15px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]">
                  Cancelar
                </button>
                <button type="submit" className="inline-flex h-[56px] flex-[1.4] items-center justify-center rounded-2xl bg-[#2563EB] px-6 text-[15px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]">
                  {editingUser ? 'Guardar cambios' : 'Registrar usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const FilterDropdown = ({
  value,
  onChange,
  options,
  disabled,
  isOpen,
  onToggle,
  onRequestClose,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onRequestClose: () => void;
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) onRequestClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onRequestClose]);

  return (
    <div className={`relative ${isOpen ? 'z-[70]' : 'z-20'}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-[56px] w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left transition-all duration-200 ${
          disabled
            ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F8FAFC] text-[#94A3B8]'
            : isOpen
              ? 'border-[#111827] text-[#111827] shadow-[0_16px_36px_rgba(15,23,42,0.08)]'
              : 'border-[#E5E7EB] text-[#111827] hover:border-[#DBEAFE] hover:text-[#2563EB]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{selected?.label || options[0]?.label || 'Seleccionar'}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#111827]' : ''}`} />
      </button>
      {isOpen && !disabled ? (
        <div className="absolute left-0 top-[calc(100%+10px)] z-[80] w-max min-w-[240px] max-w-[320px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          {options.map(option => {
            const active = option.value === value;
            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  onRequestClose();
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
                  active ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                }`}
              >
                <span>{option.label}</span>
                {active ? <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const UserRowActions = ({
  user,
  canManage,
  onView,
  onEdit,
  onToggle,
}: {
  user: User;
  canManage: boolean;
  onView: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

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
      const menuWidth = 224;
      const menuHeight = canManage ? 176 : 120;
      const spacing = 10;
      const shouldOpenUp = window.innerHeight - rect.bottom < menuHeight + spacing && rect.top > menuHeight + spacing;
      setMenuPosition({
        top: shouldOpenUp ? rect.top - menuHeight - spacing : rect.bottom + spacing,
        left: Math.min(Math.max(16, rect.right - menuWidth), window.innerWidth - menuWidth - 16),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [canManage, isOpen]);

  const itemClassName =
    'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]';

  const handleAction = (callback: () => void) => {
    setIsOpen(false);
    callback();
  };

  return (
    <div ref={containerRef} className="relative z-20">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen(open => !open); }}
        className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-[14px] font-semibold transition-all duration-200 ${
          isOpen
            ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_30px_rgba(37,99,235,0.12)]'
            : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:translate-x-1 hover:border-[#DBEAFE] hover:text-[#2563EB]'
        }`}
        aria-label="Acciones del usuario"
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed z-[220] w-[224px] rounded-[24px] border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
            style={{ top: menuPosition.top, left: menuPosition.left }}
            ref={menuRef}
          >
            <button type="button" onClick={() => handleAction(onView)} className={itemClassName}>
              <Eye size={17} className="text-[#2563EB]" />
              Ver perfil
            </button>
            <button
              type="button"
              onClick={() => handleAction(onEdit)}
              disabled={!canManage}
              className={`${itemClassName} disabled:cursor-not-allowed disabled:text-[#CBD5E1] disabled:hover:translate-x-0 disabled:hover:bg-transparent`}
            >
              <Edit3 size={17} className={canManage ? 'text-[#2563EB]' : 'text-[#CBD5E1]'} />
              Editar usuario
            </button>
            <button
              type="button"
              onClick={() => handleAction(onToggle)}
              disabled={!canManage}
              className={`${itemClassName} disabled:cursor-not-allowed disabled:text-[#CBD5E1] disabled:hover:translate-x-0 disabled:hover:bg-transparent ${
                user.isActive ? 'text-[#DC2626] hover:text-[#DC2626]' : 'text-[#16A34A] hover:text-[#16A34A]'
              }`}
            >
              {user.isActive ? <ToggleRight size={17} className="text-[#DC2626]" /> : <ToggleLeft size={17} className="text-[#16A34A]" />}
              {user.isActive ? 'Suspender usuario' : 'Activar usuario'}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
};

const SidebarPanel = ({ title, actionLabel, children }: { title: string; actionLabel?: string; children: React.ReactNode }) => (
  <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-[24px] font-black tracking-tight text-[#111827]">{title}</h3>
      {actionLabel ? <span className="text-[12px] font-semibold text-[#2563EB]">{actionLabel}</span> : null}
    </div>
    <div className="mt-5 space-y-3">{children}</div>
  </section>
);

const EmptyState = ({ label, compact = false }: { label: string; compact?: boolean }) => (
  <div className={`rounded-[22px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-center text-[#64748B] ${compact ? 'px-4 py-5 text-[13px] font-semibold' : 'px-5 py-10 text-[14px] font-medium'}`}>
    {label}
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="space-y-2">
    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">{label}</span>
    {children}
  </label>
);

const RolePieTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: { share?: number } }>;
}) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="min-w-[180px] rounded-[20px] border border-[#E5E7EB] bg-white/96 px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color || '#2563EB' }} />
          <div>
            <p className="text-[13px] font-bold text-[#111827]">{item.name}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#94A3B8]">{item.payload?.share || 0}% del equipo</p>
          </div>
        </div>
        <p className="text-[13px] font-black text-[#111827]">{item.value}</p>
      </div>
    </div>
  );
};

const getAllowedRolesFor = (role: Role) => {
  if (role === Role.SUPER_ADMIN) return [Role.SUPER_ADMIN, Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR];
  if (role === Role.ADMIN) return [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR];
  if (role === Role.SUPERVISOR) return [Role.COBRADOR];
  return [];
};

const toSmartUsername = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 24);

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const roleLabelMap: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'Super Admin',
  [Role.ADMIN]: 'Administrador',
  [Role.SUPERVISOR]: 'Supervisor',
  [Role.COBRADOR]: 'Cobrador',
};

const rolePermissionMatrix: Record<Role, Array<{ module: string; access: string; detail: string }>> = {
  [Role.SUPER_ADMIN]: [
    { module: 'Escritorio', access: 'Completo', detail: 'Vista global, analitica y controles maestros.' },
    { module: 'Clientes y prestamos', access: 'Completo', detail: 'Gestion total de cartera, renovaciones y ajustes.' },
    { module: 'Rutas y caja', access: 'Completo', detail: 'Supervisa cierres, liquidaciones y control operativo.' },
    { module: 'Reportes y configuracion', access: 'Completo', detail: 'Define plantillas, exportaciones y parametros.' },
  ],
  [Role.ADMIN]: [
    { module: 'Escritorio', access: 'Completo', detail: 'Monitorea el negocio y equipos visibles.' },
    { module: 'Clientes y prestamos', access: 'Completo', detail: 'Crea, aprueba y da seguimiento operativo.' },
    { module: 'Rutas y caja', access: 'Controlado', detail: 'Opera sucursales y valida cierres.' },
    { module: 'Reportes', access: 'Completo', detail: 'Genera exportaciones y cortes del periodo.' },
  ],
  [Role.SUPERVISOR]: [
    { module: 'Escritorio', access: 'Supervision', detail: 'Monitorea desempeno del equipo asignado.' },
    { module: 'Clientes y prestamos', access: 'Lectura + seguimiento', detail: 'Consulta cartera y da seguimiento a incidencias.' },
    { module: 'Rutas', access: 'Despacho', detail: 'Controla cobradores, rutas y productividad.' },
    { module: 'Reportes', access: 'Operativo', detail: 'Consulta cortes y resultados de su alcance.' },
  ],
  [Role.COBRADOR]: [
    { module: 'Cobrar hoy', access: 'Operativo', detail: 'Registra cobros, visitas y no pagos.' },
    { module: 'Clientes', access: 'Lectura guiada', detail: 'Consulta datos necesarios para la visita.' },
    { module: 'Rutas', access: 'Asignado', detail: 'Ejecuta y liquida su recorrido.' },
    { module: 'Reportes', access: 'Limitado', detail: 'Solo consulta documentos asignados.' },
  ],
};

const userTabOptions = [
  { value: 'summary', label: 'Resumen', icon: Users },
  { value: 'edit', label: 'Editar', icon: Edit3 },
  { value: 'permissions', label: 'Permisos', icon: Shield },
  { value: 'activity', label: 'Actividad', icon: Eye },
  { value: 'sessions', label: 'Sesiones', icon: ToggleLeft },
] as const;

export const UserCreateView: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, refreshUser } = useAuth();
  const branchScope = useMemo(() => getBranchScope(currentUser), [currentUser]);
  const canSeeAllCompanyUsers = branchScope.canSeeAllCompanyUsers;
  const allowedRoles = useMemo(() => getAllowedRolesFor(currentUser.role), [currentUser.role]);
  const [branches, setBranches] = useState<Branch[]>(branchScope.branches);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    role: allowedRoles[allowedRoles.length - 1] || Role.COBRADOR,
    phone: '',
    branchId: currentUser.branchId,
    isActive: true,
    photo: '',
  });

  useEffect(() => {
    let isMounted = true;
    const draft = localStorage.getItem('users_create_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setFormData(current => ({ ...current, ...parsed }));
      } catch {
        // ignore bad draft
      }
    }
    const loadBranches = async () => {
      try {
        const apiBranches = await apiClient.listBranches();
        if (!isMounted) return;
        const visibleBranchIds = new Set(branchScope.visibleBranchIds);
        const scopedBranches = apiBranches.data.filter(branch => currentUser.role === Role.SUPER_ADMIN || visibleBranchIds.has(branch.id));
        setBranches(scopedBranches);
        upsertBranchesInLocalStorage(scopedBranches);
      } catch {
        setBranches(branchScope.branches);
      }
    };
    void loadBranches();
    return () => {
      isMounted = false;
    };
  }, [branchScope, currentUser.role]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFormError('');
    void optimizeImageFile(file)
      .then(photo => setFormData(current => ({ ...current, photo })))
      .catch(() => setFormError('No pudimos procesar la foto. Intenta con una imagen mas ligera.'));
  };

  const saveDraft = () => {
    localStorage.setItem('users_create_draft', JSON.stringify(formData));
    emitPlatformToast({
      title: 'Borrador guardado',
      message: 'El usuario en preparacion se guardo localmente para continuar luego.',
      tone: 'success',
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    try {
      const payload = {
        ...formData,
        branchId: canSeeAllCompanyUsers ? formData.branchId : currentUser.branchId,
        avatar: formData.name
          .split(' ')
          .filter(Boolean)
          .map(item => item[0])
          .join('')
          .toUpperCase(),
      };
      if (!allowedRoles.includes(payload.role)) throw new Error('Tu rol no permite asignar ese nivel de acceso.');
      try {
        const response = await apiClient.createUser(payload);
        upsertUsersInLocalStorage([response.data]);
      } catch (error) {
        if (!(error instanceof ApiUnavailableError)) throw error;
        createUser(payload, currentUser.id);
      }
      localStorage.removeItem('users_create_draft');
      refreshUser();
      navigate('/users');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo registrar el usuario.');
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <section>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#2563EB]">Usuarios</p>
            <h1 className="mt-3 text-[44px] font-black leading-none tracking-tight text-[#111827]">Crear usuario</h1>
            <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">Da de alta nuevos usuarios con una vista completa de perfil, acceso, sucursal y alcance operativo.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">
            <button type="button" onClick={() => navigate('/users')} className={`inline-flex h-[56px] min-w-[176px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
              <ChevronLeft size={18} />
              Cancelar
            </button>
            <button type="button" onClick={saveDraft} className={`inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
              <Edit3 size={18} />
              Guardar borrador
            </button>
            <button type="submit" form="user-create-form" className="inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]">
              <UserPlus size={18} />
              Crear usuario
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form id="user-create-form" onSubmit={handleSubmit} className="space-y-6">
          {formError ? <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-[13px] font-semibold text-[#DC2626]">{formError}</div> : null}

          <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Datos personales</h2>
            <div className="mt-6 flex flex-col gap-5 xl:flex-row xl:items-start">
              <div className="flex justify-center xl:w-[160px]">
                <div className="relative">
                  <div className={`flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] border-4 ${formData.photo ? 'border-[#2563EB]' : 'border-[#E5E7EB] bg-[#F8FAFC]'}`}>
                    {formData.photo ? <img src={formData.photo} alt="Vista previa" className="h-full w-full object-cover" /> : <ImageIcon size={34} className="text-[#94A3B8]" />}
                  </div>
                  <label className="absolute bottom-0 right-0 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl bg-[#111827] text-white shadow-lg transition-all duration-200 hover:translate-x-1">
                    <Camera size={16} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
              <div className="grid flex-1 gap-5 md:grid-cols-2">
                <Field label="Nombre completo">
                  <input required value={formData.name} onChange={event => setFormData(current => ({ ...current, name: event.target.value }))} placeholder="Ej: Roberto Sanchez" className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]" />
                </Field>
                <Field label="Usuario de acceso">
                  <input required value={formData.username} onChange={event => setFormData(current => ({ ...current, username: event.target.value }))} placeholder="roberto_rd" className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]" />
                </Field>
                <Field label="Telefono">
                  <input value={formData.phone} onChange={event => setFormData(current => ({ ...current, phone: event.target.value }))} placeholder="809-000-0000" className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]" />
                </Field>
                <Field label="Estado inicial">
                  <button type="button" onClick={() => setFormData(current => ({ ...current, isActive: !current.isActive }))} className="flex h-14 w-full items-center justify-between rounded-2xl border border-[#E5E7EB] px-4 text-left text-[15px] font-semibold text-[#111827] transition hover:border-[#DBEAFE]">
                    <span>{formData.isActive ? 'Activo al crear' : 'Crear suspendido'}</span>
                    {formData.isActive ? <ToggleRight size={18} className="text-[#16A34A]" /> : <ToggleLeft size={18} className="text-[#DC2626]" />}
                  </button>
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Acceso y asignacion</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Field label="Rol del sistema">
                <select value={formData.role} onChange={event => setFormData(current => ({ ...current, role: event.target.value as Role }))} className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]">
                  {allowedRoles.includes(Role.SUPER_ADMIN) ? <option value={Role.SUPER_ADMIN}>Super Admin</option> : null}
                  {allowedRoles.includes(Role.ADMIN) ? <option value={Role.ADMIN}>Administrador</option> : null}
                  {allowedRoles.includes(Role.SUPERVISOR) ? <option value={Role.SUPERVISOR}>Supervisor</option> : null}
                  {allowedRoles.includes(Role.COBRADOR) ? <option value={Role.COBRADOR}>Cobrador</option> : null}
                </select>
              </Field>
              <Field label="Sucursal asignada">
                <select value={formData.branchId} onChange={event => setFormData(current => ({ ...current, branchId: event.target.value }))} disabled={!canSeeAllCompanyUsers} className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]">
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
        </form>

        <section className="space-y-6">
          <SidebarPanel title="Resumen del alta" actionLabel="Vista previa">
            <InfoPill label="Nombre" value={formData.name || 'Pendiente'} />
            <InfoPill label="Rol" value={formData.role} />
            <InfoPill label="Sucursal" value={branches.find(branch => branch.id === formData.branchId)?.name || 'Sin sucursal'} />
            <InfoPill label="Estado" value={formData.isActive ? 'Activo' : 'Suspendido'} />
          </SidebarPanel>
          <SidebarPanel title="Permisos del rol" actionLabel="Lectura">
            {rolePermissionMatrix[formData.role]?.map(item => (
              <div key={item.module} className="rounded-[22px] border border-[#F1F5F9] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-bold text-[#111827]">{item.module}</p>
                  <span className="text-[12px] font-semibold text-[#2563EB]">{item.access}</span>
                </div>
                <p className="mt-2 text-[13px] font-medium text-[#64748B]">{item.detail}</p>
              </div>
            ))}
          </SidebarPanel>
        </section>
      </section>
    </div>
  );
};

export const UserPermissionsView: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const roleTabs = useMemo(() => getAllowedRolesFor(currentUser.role), [currentUser.role]);
  const [activeRole, setActiveRole] = useState<Role>(roleTabs[0] || Role.COBRADOR);

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <section>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#2563EB]">Usuarios</p>
            <h1 className="mt-3 text-[44px] font-black leading-none tracking-tight text-[#111827]">Roles y permisos</h1>
            <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">Consulta el alcance de cada rol en el panel, con lectura operativa por modulo y responsabilidad.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">
            <button type="button" onClick={() => navigate('/users')} className={`inline-flex h-[56px] min-w-[176px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
              <ChevronLeft size={18} />
              Volver a usuarios
            </button>
            <button type="button" onClick={() => navigate('/users/new')} className="inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]">
              <UserPlus size={18} />
              Crear usuario
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {roleTabs.map(role => (
            <button key={role} type="button" onClick={() => setActiveRole(role)} className={`inline-flex h-[44px] items-center justify-center rounded-[18px] border px-4 text-[14px] font-semibold transition-all duration-200 ${activeRole === role ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]' : 'border-[#E5E7EB] bg-white text-[#111827] hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'}`}>
              {role}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[32px] font-black tracking-tight text-[#111827]">Matriz del rol</h2>
              <p className="mt-2 text-[15px] font-medium text-[#64748B]">Lectura estructurada de accesos y alcances del rol seleccionado.</p>
            </div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-semibold ${roleToneMap[activeRole].chip}`}>{activeRole}</span>
          </div>
          <div className="mt-6 space-y-4">
            {rolePermissionMatrix[activeRole].map(item => (
              <div key={item.module} className="rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFF] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-[20px] font-black tracking-tight text-[#111827]">{item.module}</h3>
                    <p className="mt-2 text-[14px] font-medium text-[#64748B]">{item.detail}</p>
                  </div>
                  <span className="inline-flex rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#2563EB]">{item.access}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SidebarPanel title="Resumen del rol" actionLabel="Actual">
            <InfoPill label="Rol" value={activeRole} />
            <InfoPill label="Modulos visibles" value={String(rolePermissionMatrix[activeRole].length)} />
            <InfoPill label="Tipo de acceso" value={activeRole === Role.COBRADOR ? 'Operativo' : 'Supervision'} />
          </SidebarPanel>
          <SidebarPanel title="Impacto operativo" actionLabel="Guia">
            <div className="rounded-[22px] border border-[#F1F5F9] px-4 py-4">
              <p className="text-[14px] font-bold text-[#111827]">Rol enfocado en {activeRole === Role.COBRADOR ? 'ejecucion diaria' : 'coordinacion y control'}.</p>
              <p className="mt-2 text-[13px] font-medium text-[#64748B]">Usa esta lectura como referencia para crear usuarios y validar alcance antes del alta.</p>
            </div>
          </SidebarPanel>
        </section>
      </section>
    </div>
  );
};

export const UserInviteView: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const branchScope = useMemo(() => getBranchScope(currentUser), [currentUser]);
  const allowedRoles = useMemo(() => getAllowedRolesFor(currentUser.role), [currentUser.role]);
  const [inviteData, setInviteData] = useState({
    fullName: '',
    username: '',
    email: '',
    role: allowedRoles[allowedRoles.length - 1] || Role.COBRADOR,
    branchId: currentUser.branchId,
    note: '',
  });
  const [inviteError, setInviteError] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [openInviteFilter, setOpenInviteFilter] = useState<'role' | 'branch' | null>(null);

  useEffect(() => {
    const draft = localStorage.getItem('user_invite_draft');
    if (!draft) return;
    try {
      const parsed = JSON.parse(draft);
      setInviteData(current => ({ ...current, ...parsed }));
      if (parsed.username) setUsernameTouched(true);
    } catch {
      // ignore invalid draft
    }
  }, []);

  useEffect(() => {
    if (usernameTouched) return;
    const nextUsername = toSmartUsername(inviteData.fullName);
    setInviteData(current => (current.username === nextUsername ? current : { ...current, username: nextUsername }));
  }, [inviteData.fullName, usernameTouched]);

  const submitInvitation = () => {
    setInviteError('');
    setPlatformLoading({ active: true, label: 'Preparando invitacion' });
    try {
      if (!inviteData.fullName.trim() || !inviteData.username.trim()) {
        throw new Error('Nombre y usuario son obligatorios para el preregistro.');
      }
      createUser(
        {
          name: inviteData.fullName,
          username: inviteData.username,
          email: inviteData.email,
          invitationEmail: inviteData.email,
          branchId: inviteData.branchId,
          role: inviteData.role,
          isActive: true,
          invitationStatus: 'PENDIENTE',
          firstAccessRequired: true,
        },
        currentUser.id,
      );
      localStorage.removeItem('user_invite_draft');
      const branchName = branchScope.branches.find(branch => branch.id === inviteData.branchId)?.name || 'Sin sucursal';
      if (inviteData.email.trim()) {
        window.location.href = buildInviteMailTo({
          email: inviteData.email.trim().toLowerCase(),
          fullName: inviteData.fullName.trim(),
          username: inviteData.username.trim().toLowerCase(),
          role: inviteData.role,
          branchName,
          note: inviteData.note.trim(),
        });
      }
      emitPlatformToast({
        title: 'Invitacion en espera',
        message: inviteData.email.trim()
          ? 'Se genero el preregistro y se abrio el correo para completar el envio.'
          : 'Se genero el preregistro. Falta compartir el acceso con el usuario.',
        tone: 'info',
      });
      window.setTimeout(() => navigate('/users'), 1400);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'No se pudo generar la invitacion.');
      emitPlatformToast({
        title: 'No se pudo preparar la invitacion',
        message: error instanceof Error ? error.message : 'Intenta nuevamente.',
        tone: 'error',
      });
    } finally {
      setPlatformLoading({ active: false });
    }
  };

  const handleInviteConfirmation = () => {
    if (!inviteData.fullName.trim() || !inviteData.username.trim()) {
      setInviteError('Nombre y usuario son obligatorios para el preregistro.');
      return;
    }

    const branchName = branchScope.branches.find(branch => branch.id === inviteData.branchId)?.name || 'Sin sucursal';

    openPlatformCriticalModal({
      id: 'invite-user-confirmation',
      title: '¿Enviar esta invitacion?',
      description: 'Se creara el preregistro del usuario en estado En espera para que defina su propia clave al entrar por primera vez.',
      tone: 'info',
      confirmLabel: 'Crear invitacion',
      cancelLabel: 'Seguir editando',
      highlights: [
        { label: 'Invitado', value: inviteData.fullName.trim() },
        { label: 'Rol y sucursal', value: `${inviteData.role} · ${branchName}` },
        { label: 'Correo', value: inviteData.email.trim() || 'Sin correo, se compartira manualmente', tone: inviteData.email.trim() ? 'neutral' : 'warning' },
      ],
      onConfirm: submitInvitation,
    });
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <section>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#2563EB]">Usuarios</p>
            <h1 className="mt-3 text-[44px] font-black leading-none tracking-tight text-[#111827]">Invitar usuario</h1>
            <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">Prepara el acceso inicial de un miembro del equipo con rol, sucursal y contexto operativo.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">
            <button type="button" onClick={() => navigate('/users')} className={`inline-flex h-[56px] min-w-[176px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
              <ChevronLeft size={18} />
              Volver a usuarios
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('user_invite_draft', JSON.stringify(inviteData));
                emitPlatformToast({
                  title: 'Borrador guardado',
                  message: 'La invitacion se guardo localmente para continuar luego.',
                  tone: 'success',
                });
              }}
              className={`inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}
            >
              <Edit3 size={18} />
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={handleInviteConfirmation}
              className="inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]"
            >
              <UserPlus size={18} />
              Enviar invitacion
            </button>
          </div>
        </div>
      </section>

      {inviteError ? <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-[13px] font-semibold text-[#DC2626]">{inviteError}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Datos de la invitacion</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="Nombre del usuario">
              <div className="space-y-2">
                <input
                  value={inviteData.fullName}
                  onChange={event => setInviteData(current => ({ ...current, fullName: event.target.value }))}
                  className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                  placeholder="Nombre completo"
                />
                <p className="text-[12px] font-medium text-[#94A3B8]">El username puede autogenerarse a partir del nombre.</p>
              </div>
            </Field>
            <Field label="Correo de invitacion">
              <div className="space-y-2">
                <input
                  value={inviteData.email}
                  onChange={event => setInviteData(current => ({ ...current, email: event.target.value.toLowerCase() }))}
                  className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                  placeholder="correo@empresa.com"
                />
                <p className="text-[12px] font-medium text-[#94A3B8]">El invitado activara su clave con este acceso o con su username.</p>
              </div>
            </Field>
            <Field label="Usuario de acceso">
              <div className="space-y-2">
                <input
                  value={inviteData.username}
                  onChange={event => {
                    setUsernameTouched(true);
                    setInviteData(current => ({ ...current, username: toSmartUsername(event.target.value) }));
                  }}
                  className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                  placeholder="usuario_operativo"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] font-medium text-[#94A3B8]">{usernameTouched ? 'Editado manualmente.' : 'Autogenerado desde el nombre.'}</p>
                  {inviteData.username ? <button type="button" onClick={() => setUsernameTouched(false)} className="text-[12px] font-semibold text-[#2563EB] transition-all duration-200 hover:translate-x-1">Auto</button> : null}
                </div>
              </div>
            </Field>
            <Field label="Rol">
              <FilterDropdown
                value={inviteData.role}
                onChange={value => setInviteData(current => ({ ...current, role: value as Role }))}
                options={allowedRoles.map(role => ({ value: role, label: role }))}
                isOpen={openInviteFilter === 'role'}
                onToggle={() => setOpenInviteFilter(current => (current === 'role' ? null : 'role'))}
                onRequestClose={() => setOpenInviteFilter(null)}
              />
            </Field>
            <Field label="Sucursal">
              <FilterDropdown
                value={inviteData.branchId}
                onChange={value => setInviteData(current => ({ ...current, branchId: value }))}
                options={branchScope.branches.map(branch => ({ value: branch.id, label: branch.name }))}
                isOpen={openInviteFilter === 'branch'}
                onToggle={() => setOpenInviteFilter(current => (current === 'branch' ? null : 'branch'))}
                onRequestClose={() => setOpenInviteFilter(null)}
              />
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Nota operativa">
              <div className="space-y-2">
                <textarea
                  value={inviteData.note}
                  onChange={event => setInviteData(current => ({ ...current, note: event.target.value }))}
                  className="h-28 w-full rounded-2xl border border-[#E5E7EB] px-4 py-3 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                  placeholder="Instrucciones, bienvenida o contexto del puesto."
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] font-medium text-[#94A3B8]">Puedes usar esta nota como guion inicial del onboarding.</p>
                  <span className="text-[12px] font-semibold text-[#94A3B8]">{inviteData.note.length}/280</span>
                </div>
              </div>
            </Field>
          </div>
        </section>

        <section className="space-y-6">
          <SidebarPanel title="Resumen de acceso" actionLabel="Vista previa">
            <div className="mb-4 flex items-center justify-between rounded-[22px] border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Estado de invitacion</p>
                <p className="mt-2 text-[15px] font-bold text-[#111827]">En espera</p>
              </div>
              <span className="inline-flex rounded-full border border-[#DBEAFE] bg-white px-3 py-1 text-[12px] font-semibold text-[#2563EB]">
                Pendiente
              </span>
            </div>
            <InfoPill label="Invitado" value={inviteData.fullName || 'Pendiente'} />
            <InfoPill label="Correo" value={inviteData.email || 'Pendiente'} />
            <InfoPill label="Rol" value={inviteData.role} />
            <InfoPill label="Sucursal" value={branchScope.branches.find(branch => branch.id === inviteData.branchId)?.name || 'Sin sucursal'} />
            {inviteData.email.trim() ? (
              <button
                type="button"
                onClick={() => {
                  const branchName = branchScope.branches.find(branch => branch.id === inviteData.branchId)?.name || 'Sin sucursal';
                  window.location.href = buildInviteMailTo({
                    email: inviteData.email.trim().toLowerCase(),
                    fullName: inviteData.fullName.trim() || 'Usuario',
                    username: inviteData.username.trim().toLowerCase(),
                    role: inviteData.role,
                    branchName,
                    note: inviteData.note.trim(),
                  });
                  emitPlatformToast({
                    title: 'Correo listo para enviar',
                    message: 'Se abrio tu cliente de correo con la invitacion preparada.',
                    tone: 'info',
                  });
                }}
                className={`mt-4 inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}
              >
                <UserPlus size={16} />
                Abrir correo de invitacion
              </button>
            ) : null}
          </SidebarPanel>
        </section>
      </section>
    </div>
  );
};

export const UserProfileView: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [formError, setFormError] = useState('');
  const [assignedClientsPage, setAssignedClientsPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [editUsernameTouched, setEditUsernameTouched] = useState(true);
  const [openEditFilter, setOpenEditFilter] = useState<'role' | 'branch' | null>(null);
  const [userAuditActivity, setUserAuditActivity] = useState<Array<{ id: string; title: string; detail: string; date: string; type: string }>>([]);
  const [userSessionActivity, setUserSessionActivity] = useState<Array<{ id: string; title: string; detail: string; date: string; type: string }>>([]);
  const branchScope = useMemo(() => getBranchScope(currentUser), [currentUser]);
  const allowedRoles = useMemo(() => getAllowedRolesFor(currentUser.role), [currentUser.role]);
  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab') || 'summary';
    return userTabOptions.some(item => item.value === tab) ? tab : 'summary';
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setUsers(getScopedUsers(currentUser));
      setClients(getScopedClients(currentUser));
      setBranches(branchScope.branches);
      try {
        const [apiUsers, apiClients, apiBranches] = await Promise.all([
          apiClient.listUsers(),
          apiClient.listClients(),
          apiClient.listBranches(),
        ]);
        if (!isMounted) return;
        const visibleBranchIds = new Set(branchScope.visibleBranchIds);
        setUsers(apiUsers.data.filter(user => currentUser.role === Role.SUPER_ADMIN || visibleBranchIds.has(user.branchId)));
        setClients(apiClients.data);
        setBranches(apiBranches.data.filter(branch => currentUser.role === Role.SUPER_ADMIN || visibleBranchIds.has(branch.id)));
      } catch {
        // keep local fallback
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [branchScope, currentUser]);

  const user = users.find(item => item.id === id) || null;
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    role: Role.COBRADOR,
    phone: '',
    branchId: '',
    isActive: true,
    photo: '',
  });
  const [permissionOverrides, setPermissionOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    setFormData({
      name: user.name,
      username: user.username,
      role: user.role,
      phone: user.phone || '',
      branchId: user.branchId,
      isActive: user.isActive,
      photo: user.photo || '',
    });
    setEditUsernameTouched(Boolean(user.username));
  }, [user]);

  useEffect(() => {
    if (editUsernameTouched) return;
    const nextUsername = toSmartUsername(formData.name);
    setFormData(current => (current.username === nextUsername ? current : { ...current, username: nextUsername }));
  }, [editUsernameTouched, formData.name]);

  useEffect(() => {
    if (!user) return;
    const base = Object.fromEntries(rolePermissionMatrix[user.role].map(item => [item.module, true]));
    if (user.permissions && Object.keys(user.permissions).length) {
      setPermissionOverrides({ ...base, ...user.permissions });
      return;
    }
    const stored = localStorage.getItem(`user_permission_overrides_${user.id}`);
    if (stored) {
      try {
        setPermissionOverrides({ ...base, ...JSON.parse(stored) });
        return;
      } catch {
        // ignore invalid store
      }
    }
    setPermissionOverrides(base);
  }, [user]);

  useEffect(() => {
    setAssignedClientsPage(1);
  }, [user?.id]);

  useEffect(() => {
    setActivityPage(1);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const localEvents = getGlobalActivity(currentUser.companyId)
      .filter(event => event.userId === user.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .map(event => ({
        id: event.id,
        title: event.title,
        detail: event.description,
        date: new Date(event.timestamp).toLocaleDateString('es-DO'),
        type: event.type,
      }));

    setUserAuditActivity(localEvents);
    setUserSessionActivity(
      user.lastLoginAt
        ? [
            {
              id: `login-${user.id}`,
              title: 'Inicio de sesion web',
              detail: `${branchName} · Acceso confirmado`,
              date: new Date(user.lastLoginAt).toLocaleDateString('es-DO'),
              type: 'SECURITY',
            },
          ]
        : [],
    );

    Promise.allSettled([
      apiClient.listAuditLogs({ entityId: user.id, entityType: 'user' }),
      apiClient.listAuditLogs({ userId: user.id, action: 'LOGIN' }),
    ])
      .then(([entityResult, loginResult]) => {
        if (!isMounted) return;
        if (entityResult.status === 'fulfilled') {
          setUserAuditActivity(entityResult.value.data.map(mapAuditToUserActivity));
        }
        if (loginResult.status === 'fulfilled') {
          setUserSessionActivity(loginResult.value.data.map(mapAuditToUserActivity));
        }
      })
      .catch(() => {
        // keep local fallback
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser.companyId, user]);

  if (!user) {
    return (
      <div className="space-y-6 pb-24 lg:pb-0">
        <section className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[44px] font-black tracking-tight text-[#111827]">Perfil de usuario</h1>
            <p className="mt-3 text-[16px] font-medium text-[#64748B]">No se encontro el usuario solicitado dentro del alcance visible.</p>
          </div>
          <button type="button" onClick={() => navigate('/users')} className={`inline-flex h-[56px] min-w-[188px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
            <ChevronLeft size={18} />
            Volver a usuarios
          </button>
        </section>
      </div>
    );
  }

  const branchName = branches.find(branch => branch.id === user.branchId)?.name || 'Sin sucursal';
  const assignedClients = clients.filter(client => client.assignedUserId === user.id);
  const canManageViewedUser =
    currentUser.id !== user.id &&
    currentUser.role !== Role.COBRADOR &&
    (currentUser.role === Role.SUPER_ADMIN ||
      (currentUser.role === Role.ADMIN && user.role !== Role.SUPER_ADMIN) ||
      (currentUser.role === Role.SUPERVISOR && user.role === Role.COBRADOR && user.branchId === currentUser.branchId));
  const userActivity = userAuditActivity.length
    ? userAuditActivity
    : [
        { id: 'fallback-status', title: user.isActive ? 'Cuenta activa' : 'Cuenta suspendida', detail: `${branchName} · ${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('es-DO') : 'Sin acceso reciente'}`, date: new Date().toLocaleDateString('es-DO'), type: 'SECURITY' },
        { id: 'fallback-clients', title: `${assignedClients.length} clientes asignados`, detail: 'Cartera visible desde el perfil del usuario.', date: new Date().toLocaleDateString('es-DO'), type: 'USER_MGMT' },
        { id: 'fallback-role', title: `Rol ${user.role}`, detail: 'Alcance operativo derivado del perfil actual.', date: new Date().toLocaleDateString('es-DO'), type: 'USER_MGMT' },
      ];
  const userSessions = (userSessionActivity.length ? userSessionActivity : userActivity.filter(item => item.type === 'SECURITY'))
    .slice(0, 6)
    .map(item => ({
      device: item.title,
      detail: item.detail,
      date: item.date,
      status: item.type === 'SECURITY' ? 'Auditada' : 'Gestion',
    }));

  const updateActiveTab = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', value);
    setSearchParams(nextParams);
  };

  const assignedClientsTotalPages = Math.max(1, Math.ceil(assignedClients.length / SUBVIEW_PAGE_SIZE));
  const safeAssignedClientsPage = Math.min(assignedClientsPage, assignedClientsTotalPages);
  const visibleAssignedClients = assignedClients.slice((safeAssignedClientsPage - 1) * SUBVIEW_PAGE_SIZE, safeAssignedClientsPage * SUBVIEW_PAGE_SIZE);
  const activityTotalPages = Math.max(1, Math.ceil(userActivity.length / SUBVIEW_PAGE_SIZE));
  const safeActivityPage = Math.min(activityPage, activityTotalPages);
  const visibleUserActivity = userActivity.slice((safeActivityPage - 1) * SUBVIEW_PAGE_SIZE, safeActivityPage * SUBVIEW_PAGE_SIZE);

  const handleProfileImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFormError('');
    void optimizeImageFile(file)
      .then(photo => setFormData(current => ({ ...current, photo })))
      .catch(() => setFormError('No pudimos procesar la foto. Intenta con una imagen mas ligera.'));
  };

  const handleSaveUser = async () => {
    setFormError('');
    try {
      const payload = {
        ...formData,
        permissions: permissionOverrides,
        avatar: formData.name
          .split(' ')
          .filter(Boolean)
          .map(item => item[0])
          .join('')
          .toUpperCase(),
      };
      try {
        const response = await apiClient.updateUser(user.id, payload);
        upsertUsersInLocalStorage([response.data]);
        setUsers(current => current.map(item => (item.id === user.id ? response.data : item)));
      } catch (error) {
        if (!(error instanceof ApiUnavailableError)) throw error;
        updateUser(user.id, payload);
        setUsers(getScopedUsers(currentUser));
      }
      refreshUser();
      localStorage.setItem(`user_permission_overrides_${user.id}`, JSON.stringify(permissionOverrides));
      updateActiveTab('summary');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo actualizar el usuario.');
    }
  };

  const handleToggleStatus = async () => {
    if (!canManageViewedUser) return;
    setFormError('');
    try {
      const payload = { isActive: !user.isActive };
      try {
        const response = await apiClient.updateUser(user.id, payload);
        upsertUsersInLocalStorage([response.data]);
        setUsers(current => current.map(item => (item.id === user.id ? response.data : item)));
      } catch (error) {
        if (!(error instanceof ApiUnavailableError)) throw error;
        updateUser(user.id, payload);
        setUsers(getScopedUsers(currentUser));
      }
      refreshUser();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo actualizar el estado del usuario.');
    }
  };

  const handleToggleStatusConfirmation = () => {
    if (!canManageViewedUser) return;

    const branchName = branches.find(branch => branch.id === user.branchId)?.name || 'Sin sucursal';
    const nextLabel = user.isActive ? 'Suspender usuario' : 'Reactivar usuario';

    openPlatformCriticalModal({
      id: 'toggle-user-status-confirmation',
      title: `¿${nextLabel}?`,
      description: user.isActive
        ? 'El usuario perdera acceso inmediato al panel hasta que sea reactivado nuevamente.'
        : 'El usuario recuperara acceso al panel con el rol y alcance actualmente configurados.',
      tone: user.isActive ? 'danger' : 'success',
      confirmLabel: nextLabel,
      cancelLabel: 'Cancelar',
      highlights: [
        { label: 'Usuario', value: user.name },
        { label: 'Rol y sucursal', value: `${user.role} · ${branchName}` },
        { label: 'Estado actual', value: user.isActive ? 'Activo' : 'Suspendido', tone: user.isActive ? 'success' : 'warning' },
      ],
      onConfirm: handleToggleStatus,
    });
  };

  const handlePermissionToggle = (module: string) => {
    setPermissionOverrides(current => ({ ...current, [module]: !current[module] }));
  };

  const handleSavePermissions = async () => {
    try {
      localStorage.setItem(`user_permission_overrides_${user.id}`, JSON.stringify(permissionOverrides));
      try {
        const response = await apiClient.updateUser(user.id, { permissions: permissionOverrides });
        upsertUsersInLocalStorage([response.data]);
        setUsers(current => current.map(item => (item.id === user.id ? response.data : item)));
      } catch (error) {
        if (!(error instanceof ApiUnavailableError)) throw error;
        updateUser(user.id, { permissions: permissionOverrides });
        setUsers(getScopedUsers(currentUser));
      }
      emitPlatformToast({
        title: 'Permisos guardados',
        message: 'Los accesos del usuario quedaron actualizados.',
        tone: 'success',
      });
    } catch (error) {
      emitPlatformToast({
        title: 'No se pudieron guardar los permisos',
        message: error instanceof Error ? error.message : 'No se pudieron guardar los permisos.',
        tone: 'error',
        durationMs: 5200,
      });
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <section>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#2563EB]">Usuarios</p>
            <h1 className="mt-3 text-[44px] font-black leading-none tracking-tight text-[#111827]">Editar usuario</h1>
            <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">Consulta perfil, edita acceso, revisa sesiones y visualiza el impacto operativo del miembro del equipo.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">
            <button type="button" onClick={() => navigate('/users')} className={`inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
              <ChevronLeft size={18} />
              Volver a usuarios
            </button>
            <button type="button" onClick={() => updateActiveTab('sessions')} className={`inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
              <Shield size={18} />
              Restablecer acceso
            </button>
            <button type="button" onClick={handleToggleStatusConfirmation} disabled={!canManageViewedUser} className={`inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border px-6 text-[16px] font-semibold ${user.isActive ? 'border-[#FECACA] bg-white text-[#DC2626]' : 'border-[#BBF7D0] bg-white text-[#16A34A]'} ${horizontalMotionClass} disabled:cursor-not-allowed disabled:opacity-50`}>
              {user.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {user.isActive ? 'Suspender usuario' : 'Reactivar usuario'}
            </button>
            <button type="button" onClick={() => void handleSaveUser()} disabled={!canManageViewedUser} className="inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60">
              <Edit3 size={18} />
              Guardar cambios
            </button>
          </div>
        </div>
      </section>

      {formError ? <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-[13px] font-semibold text-[#DC2626]">{formError}</div> : null}

      <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-4">
            {formData.photo || user.photo ? (
              <img src={(formData.photo || user.photo) as string} alt={user.name} className="h-24 w-24 rounded-2xl border border-[#E5E7EB] object-cover" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[28px] font-black text-[#2563EB]">
                {user.avatar || user.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-[40px] font-black tracking-tight text-[#111827]">{user.name}</h2>
              <p className="mt-2 text-[16px] font-medium text-[#64748B]">@{user.username}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <span className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-semibold ${roleToneMap[user.role].chip}`}>{user.role}</span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-semibold ${statusToneMap[user.isActive ? 'Activo' : 'Suspendido']}`}>{user.isActive ? 'Activo' : 'Suspendido'}</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <InfoPill label="Sucursal" value={branchName} />
            <InfoPill label="Telefono" value={user.phone || 'Sin telefono'} />
            <InfoPill label="Clientes" value={String(assignedClients.length)} />
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {userTabOptions.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => updateActiveTab(tab.value)}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-semibold transition-all duration-200 ${
                  active
                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          {activeTab === 'summary' ? (
            <>
              <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Resumen del usuario</h3>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <InfoPill label="Rol" value={user.role} />
                  <InfoPill label="Ultimo acceso" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('es-DO') : 'Sin acceso reciente'} />
                  <InfoPill label="Estado operativo" value={user.isActive ? 'Operativo' : 'Suspendido'} />
                </div>
              </section>
              <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Clientes asignados</h3>
                <div className="mt-5 space-y-3">
                  {assignedClients.length ? visibleAssignedClients.map(client => (
                    <div key={client.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-[#EEF2F7] px-4 py-3">
                      <div>
                        <p className="text-[14px] font-bold text-[#111827]">{client.firstName} {client.lastName}</p>
                        <p className="mt-1 text-[12px] font-medium text-[#64748B]">{client.phone || client.cedula}</p>
                      </div>
                      <span className="text-[12px] font-semibold text-[#94A3B8]">{branchName}</span>
                    </div>
                  )) : <EmptyState label="Aun no tiene clientes asignados." compact />}
                </div>
                {assignedClients.length > SUBVIEW_PAGE_SIZE ? (
                  <PaginationControls
                    page={safeAssignedClientsPage}
                    totalPages={assignedClientsTotalPages}
                    onPrevious={() => setAssignedClientsPage(current => Math.max(1, current - 1))}
                    onNext={() => setAssignedClientsPage(current => Math.min(assignedClientsTotalPages, current + 1))}
                    summary={`Mostrando ${(safeAssignedClientsPage - 1) * SUBVIEW_PAGE_SIZE + 1} a ${Math.min(safeAssignedClientsPage * SUBVIEW_PAGE_SIZE, assignedClients.length)} de ${assignedClients.length} clientes`}
                  />
                ) : null}
              </section>
            </>
          ) : null}

          {activeTab === 'edit' ? (
            <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Editar perfil y acceso</h3>
              <div className="mt-6 space-y-6">
                <div className="flex flex-col gap-5 rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFF] p-5 md:flex-row md:items-center">
                  <div className="relative w-fit">
                    <div className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 ${formData.photo || user.photo ? 'border-[#2563EB]' : 'border-[#E5E7EB] bg-white'}`}>
                      {formData.photo || user.photo ? <img src={(formData.photo || user.photo) as string} alt={user.name} className="h-full w-full object-cover" /> : <ImageIcon size={30} className="text-[#94A3B8]" />}
                    </div>
                    <label className="absolute bottom-0 right-0 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-[#111827] text-white shadow-lg transition-all duration-200 hover:translate-x-1">
                      <Camera size={15} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
                    </label>
                  </div>
                  <div>
                    <p className="text-[18px] font-bold text-[#111827]">Foto del usuario</p>
                    <p className="mt-2 text-[14px] font-medium text-[#64748B]">Usa el mismo patron visual que manejamos en perfiles para mantener consistencia en usuarios y clientes.</p>
                  </div>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                <Field label="Nombre completo">
                  <div className="space-y-2">
                    <input
                      value={formData.name}
                      onChange={event => setFormData(current => ({ ...current, name: event.target.value }))}
                      placeholder="Ej: Roberto Sanchez"
                      className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                    />
                    <p className="text-[12px] font-medium text-[#94A3B8]">Se usa para el perfil, firma visible y sugerencia de acceso.</p>
                  </div>
                </Field>
                <Field label="Usuario de acceso">
                  <div className="space-y-2">
                    <input
                      value={formData.username}
                      onChange={event => {
                        setEditUsernameTouched(true);
                        setFormData(current => ({ ...current, username: toSmartUsername(event.target.value) }));
                      }}
                      placeholder="usuario_operativo"
                      className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] font-medium text-[#94A3B8]">{editUsernameTouched ? 'Editado manualmente.' : 'Autogenerado desde el nombre.'}</p>
                      {formData.username ? (
                        <button
                          type="button"
                          onClick={() => setEditUsernameTouched(false)}
                          className="text-[12px] font-semibold text-[#2563EB] transition-all duration-200 hover:translate-x-1"
                        >
                          Auto
                        </button>
                      ) : null}
                    </div>
                  </div>
                </Field>
                <Field label="Telefono">
                  <div className="space-y-2">
                    <input
                      value={formData.phone}
                      onChange={event => setFormData(current => ({ ...current, phone: formatPhoneInput(event.target.value) }))}
                      placeholder="809-000-0000"
                      inputMode="numeric"
                      className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                    />
                    <p className="text-[12px] font-medium text-[#94A3B8]">Se formatea automaticamente en patron local de 10 digitos.</p>
                  </div>
                </Field>
                <Field label="Rol del sistema">
                  <FilterDropdown
                    value={formData.role}
                    onChange={value => setFormData(current => ({ ...current, role: value as Role }))}
                    options={allowedRoles.map(role => ({ value: role, label: roleLabelMap[role] }))}
                    disabled={!canManageViewedUser}
                    isOpen={openEditFilter === 'role'}
                    onToggle={() => setOpenEditFilter(current => (current === 'role' ? null : 'role'))}
                    onRequestClose={() => setOpenEditFilter(null)}
                  />
                </Field>
                <Field label="Sucursal asignada">
                  <FilterDropdown
                    value={formData.branchId}
                    onChange={value => setFormData(current => ({ ...current, branchId: value }))}
                    options={branches.map(branch => ({ value: branch.id, label: branch.name }))}
                    disabled={!canManageViewedUser}
                    isOpen={openEditFilter === 'branch'}
                    onToggle={() => setOpenEditFilter(current => (current === 'branch' ? null : 'branch'))}
                    onRequestClose={() => setOpenEditFilter(null)}
                  />
                </Field>
                <Field label="Estado">
                  <button type="button" onClick={() => setFormData(current => ({ ...current, isActive: !current.isActive }))} disabled={!canManageViewedUser} className="flex h-14 w-full items-center justify-between rounded-2xl border border-[#E5E7EB] px-4 text-left text-[15px] font-semibold text-[#111827] transition hover:border-[#DBEAFE] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]">
                    <span>{formData.isActive ? 'Activo' : 'Suspendido'}</span>
                    {formData.isActive ? <ToggleRight size={18} className="text-[#16A34A]" /> : <ToggleLeft size={18} className="text-[#DC2626]" />}
                  </button>
                </Field>
              </div>
              </div>
            </section>
          ) : null}

          {activeTab === 'permissions' ? (
            <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Permisos por modulo</h3>
                  <p className="mt-2 text-[14px] font-medium text-[#64748B]">Activa o pausa accesos de referencia por modulo. Se guardan localmente para esta ficha.</p>
                </div>
                <button type="button" onClick={handleSavePermissions} className={`inline-flex h-[48px] min-w-[188px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                  <Shield size={16} />
                  Guardar permisos
                </button>
              </div>
              <div className="mt-5 space-y-4">
                {rolePermissionMatrix[formData.role].map(item => (
                  <div key={item.module} className="rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFF] p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="text-[18px] font-black text-[#111827]">{item.module}</h4>
                        <p className="mt-2 text-[14px] font-medium text-[#64748B]">{item.detail}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#2563EB]">{item.access}</span>
                        <button type="button" onClick={() => handlePermissionToggle(item.module)} className={`inline-flex h-10 min-w-[118px] items-center justify-center gap-2 rounded-2xl border px-3 text-[12px] font-semibold ${permissionOverrides[item.module] ? 'border-[#BBF7D0] bg-white text-[#16A34A]' : 'border-[#FECACA] bg-white text-[#DC2626]'} ${horizontalMotionClass}`}>
                          {permissionOverrides[item.module] ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          {permissionOverrides[item.module] ? 'Visible' : 'Oculto'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === 'activity' ? (
            <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Actividad reciente</h3>
              <div className="mt-5 space-y-3">
                {visibleUserActivity.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="rounded-[22px] border border-[#F1F5F9] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[14px] font-bold text-[#111827]">{item.title}</p>
                      <span className="text-[12px] font-semibold text-[#94A3B8]">{item.date}</span>
                    </div>
                    <p className="mt-2 text-[13px] font-medium text-[#64748B]">{item.detail}</p>
                  </div>
                ))}
              </div>
              {userActivity.length > SUBVIEW_PAGE_SIZE ? (
                <PaginationControls
                  page={safeActivityPage}
                  totalPages={activityTotalPages}
                  onPrevious={() => setActivityPage(current => Math.max(1, current - 1))}
                  onNext={() => setActivityPage(current => Math.min(activityTotalPages, current + 1))}
                  summary={`Mostrando ${(safeActivityPage - 1) * SUBVIEW_PAGE_SIZE + 1} a ${Math.min(safeActivityPage * SUBVIEW_PAGE_SIZE, userActivity.length)} de ${userActivity.length} actividades`}
                />
              ) : null}
            </section>
          ) : null}

          {activeTab === 'sessions' ? (
            <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Sesiones recientes</h3>
              <div className="mt-5 space-y-3">
                {userSessions.map((item, index) => (
                  <div key={`${item.device}-${index}`} className="rounded-[22px] border border-[#F1F5F9] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[14px] font-bold text-[#111827]">{item.device}</p>
                      <span className="text-[12px] font-semibold text-[#94A3B8]">{item.date}</span>
                    </div>
                    <p className="mt-2 text-[13px] font-medium text-[#64748B]">{item.detail}</p>
                    <p className="mt-2 text-[12px] font-semibold text-[#2563EB]">{item.status}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </section>

        <section className="space-y-6">
          <SidebarPanel title="Resumen del acceso" actionLabel="Vigente">
            <InfoPill label="Usuario" value={user.username} />
            <InfoPill label="Rol" value={formData.role} />
            <InfoPill label="Sucursal" value={branches.find(branch => branch.id === formData.branchId)?.name || branchName} />
            <InfoPill label="Estado" value={formData.isActive ? 'Activo' : 'Suspendido'} />
          </SidebarPanel>
          <SidebarPanel title="Permisos por modulo" actionLabel="Rol">
            {rolePermissionMatrix[formData.role].slice(0, 3).map(item => (
              <div key={item.module} className="rounded-[22px] border border-[#F1F5F9] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-bold text-[#111827]">{item.module}</p>
                  <span className={`text-[12px] font-semibold ${permissionOverrides[item.module] ? 'text-[#2563EB]' : 'text-[#DC2626]'}`}>{permissionOverrides[item.module] ? item.access : 'Oculto'}</span>
                </div>
              </div>
            ))}
          </SidebarPanel>
          <SidebarPanel title="Sesiones recientes" actionLabel="Control">
            {userSessions.map((item, index) => (
              <div key={`${item.device}-sidebar-${index}`} className="rounded-[22px] border border-[#F1F5F9] px-4 py-4">
                <p className="text-[14px] font-bold text-[#111827]">{item.device}</p>
                <p className="mt-1 text-[13px] font-medium text-[#64748B]">{item.detail}</p>
                <p className="mt-2 text-[12px] font-semibold text-[#94A3B8]">{item.date}</p>
              </div>
            ))}
          </SidebarPanel>
        </section>
      </section>
    </div>
  );
};

const InfoPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[18px] border border-[#E5E7EB] bg-white px-4 py-3">
    <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{label}</p>
    <p className="mt-2 text-[14px] font-semibold text-[#111827]">{value}</p>
  </div>
);

const PaginationControls = ({
  page,
  totalPages,
  onPrevious,
  onNext,
  summary,
}: {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  summary: string;
}) => (
  <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#EEF2F7] pt-4">
    <p className="text-[13px] font-medium text-[#64748B]">{summary}</p>
    <div className="flex items-center gap-2">
      <button type="button" onClick={onPrevious} disabled={page === 1} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40">
        <ChevronLeft size={16} />
      </button>
      <span className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-[14px] font-semibold text-[#2563EB]">{page}</span>
      <button type="button" onClick={onNext} disabled={page === totalPages} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40">
        <ChevronRight size={16} />
      </button>
    </div>
  </div>
);

const mapAuditToUserActivity = (item: AuditLogItem) => ({
  id: item.id,
  title: item.title,
  detail: item.description,
  date: new Date(item.createdAt).toLocaleDateString('es-DO'),
  type: item.activityType,
});
