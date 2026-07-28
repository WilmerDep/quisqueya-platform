import { apiClient } from './apiClient';
import type { ReportExport, ReportSchedule, ReportTemplate } from '../types';

export type ReportingOverview = {
  exports: ReportExport[];
  schedules: ReportSchedule[];
  templates: ReportTemplate[];
};

export const reportingService = {
  async load(): Promise<ReportingOverview> {
    const [exportsResponse, schedulesResponse, templatesResponse] = await Promise.all([
      apiClient.listReportExports(),
      apiClient.listReportSchedules(),
      apiClient.listReportTemplates(),
    ]);

    return {
      exports: exportsResponse.data,
      schedules: schedulesResponse.data,
      templates: templatesResponse.data,
    };
  },
};
