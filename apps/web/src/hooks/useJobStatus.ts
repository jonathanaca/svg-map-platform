import { useQuery } from '@tanstack/react-query';
import type { JobStatusResponse } from '@svg-map/types';
import { getJobStatus } from '../lib/api.js';

export function useJobStatus(jobId: string) {
  return useQuery<JobStatusResponse, Error>({
    queryKey: ['jobStatus', jobId],
    queryFn: () => getJobStatus(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'complete' || status === 'failed') {
        return false;
      }
      return 2000;
    },
    enabled: Boolean(jobId),
  });
}
