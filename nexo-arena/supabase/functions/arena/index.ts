import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { createArenaHandler, type Repository } from "./core.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const repository: Repository = {
  async snapshot(id, user) {
    const { data, error } = await service
      .from("online_matches")
      .select("owner_id,guest_id")
      .eq("id", id)
      .single();
    if (error || !data || ![data.owner_id, data.guest_id].includes(user))
      throw new Error("not_participant");
    return this.rpc("arena_snapshot", { p_match_id: id });
  },
  async receipt(user, request, action, fingerprint) {
    return this.rpc("arena_receipt", {
      p_player: user,
      p_request: request,
      p_action: action,
      p_fingerprint: fingerprint,
    });
  },
  async rpc(name, args) {
    const { data, error } = await service.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  },
  async history(user, active = false) {
    const { data, error } = await service
      .from("online_matches")
      .select("id")
      .or(`owner_id.eq.${user},guest_id.eq.${user}`)
      .in(
        "phase",
        active
          ? ["waiting", "active"]
          : ["completed", "forfeited", "abandoned"],
      )
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return Promise.all(
      data.map(({ id }) => this.rpc("arena_snapshot", { p_match_id: id })),
    );
  },
  async deleteAuthUser(user) {
    const { error } = await service.auth.admin.deleteUser(user);
    if (error) throw error;
  },
};
Deno.serve(
  createArenaHandler({
    repository,
    inviteSecret: Deno.env.get("INVITE_SIGNING_SECRET") || serviceKey,
    async authenticate(token) {
      const { data, error } = await service.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
  }),
);
