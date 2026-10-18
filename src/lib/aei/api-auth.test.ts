import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(()=>({create:vi.fn(),user:vi.fn(),roles:vi.fn(),from:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:mocks.create}));
import { serveApi } from './api.server';

describe('API bearer validation boundary',()=>{
  beforeEach(()=>{
    vi.stubEnv('SUPABASE_URL','https://example.invalid');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','sb_publishable_test');
    mocks.create.mockReset();mocks.user.mockReset();mocks.roles.mockReset();mocks.from.mockReset();
    mocks.roles.mockResolvedValue({data:[],error:null});
    mocks.from.mockReturnValue({select:()=>({eq:mocks.roles})});
    mocks.create.mockReturnValue({auth:{getUser:mocks.user},from:mocks.from});
  });
  it('anonymous public visitors cannot read import reports',async()=>{const response=await serveApi(new Request('http://localhost/api'),'imports');expect(response.status).toBe(403);expect(mocks.create).not.toHaveBeenCalled();});
  it.each(['Basic abc','Bearer sb_publishable_test','Bearer '])('rejects malformed authorization: %s',async authorization=>{const response=await serveApi(new Request('http://localhost/api',{headers:{authorization}}),'catalogs');expect(response.status).toBe(401);expect(mocks.user).not.toHaveBeenCalled();});
  it('revalidates a JWT with auth and rejects expired sessions before roles',async()=>{mocks.user.mockResolvedValue({data:{user:null},error:{message:'expired'}});const response=await serveApi(new Request('http://localhost/api',{headers:{authorization:'Bearer a.b.c'}}),'catalogs');expect(response.status).toBe(401);expect(mocks.user).toHaveBeenCalledWith('a.b.c');expect(mocks.from).not.toHaveBeenCalled();});
  it('queries protected roles only for verified identity',async()=>{mocks.user.mockResolvedValue({data:{user:{id:'verified-user'}},error:null});const response=await serveApi(new Request('http://localhost/api',{headers:{authorization:'Bearer a.b.c'}}),'catalogs');expect(response.status).toBe(403);expect(mocks.roles).toHaveBeenCalledWith('user_id','verified-user');});
  it('viewer cannot access import reports even after successful auth',async()=>{mocks.user.mockResolvedValue({data:{user:{id:'verified-user'}},error:null});mocks.roles.mockResolvedValue({data:[{role:'viewer'}],error:null});const response=await serveApi(new Request('http://localhost/api',{headers:{authorization:'Bearer a.b.c'}}),'imports');expect(response.status).toBe(403);expect(mocks.from).toHaveBeenCalledTimes(1);});
  it('keeps user bearer and uses publishable key rather than privileged client',async()=>{mocks.user.mockResolvedValue({data:{user:null},error:{}});await serveApi(new Request('http://localhost/api',{headers:{authorization:'Bearer a.b.c'}}),'catalogs');expect(mocks.create).toHaveBeenCalledWith('https://example.invalid','sb_publishable_test',expect.objectContaining({auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:expect.objectContaining({headers:{Authorization:'Bearer a.b.c'}})}));});
});