import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/aei/catalogs')({
  server: { handlers: { GET: async ({request}) => {
    const {serveApi} = await import('@/lib/aei/api.server');
    return serveApi(request,'catalogs');
  } } },
});