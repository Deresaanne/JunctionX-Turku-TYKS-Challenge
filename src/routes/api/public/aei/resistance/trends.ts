import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/aei/resistance/trends')({
  server: { handlers: { GET: async ({request}) => {
    const {serveApi} = await import('@/lib/aei/api.server');
    return serveApi(request,'trends');
  } } },
});