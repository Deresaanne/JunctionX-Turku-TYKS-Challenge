import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/aei/anomalies')({
  server: { handlers: { GET: async ({request}) => {
    const {serveApi} = await import('@/lib/aei/api.server');
    return serveApi(request,'anomalies');
  } } },
});