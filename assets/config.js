// =====================================================================
//  Preencha com os dados do SEU projeto Supabase.
//
//  Onde encontrar: painel do Supabase -> Settings -> API
//    SUPABASE_URL       = "Project URL"
//    SUPABASE_ANON_KEY  = a chave "anon" / "public"
//
//  A chave anon é pública por natureza — ela vai para o navegador de
//  todo visitante, e é assim que deve ser. Quem protege seus dados são
//  as políticas de RLS no banco, não o segredo da chave.
//
//  Nunca coloque aqui a chave "service_role". Essa ignora todas as
//  políticas de segurança e daria a qualquer visitante acesso total.
// =====================================================================

export const SUPABASE_URL = "https://xlzilrzmcjbbvnkrkggm.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_2c4Qpb9G-dhoblrMX31DtA_G0DkgToR";

// Versão que abre por padrão. Precisa existir na tabela `versions`.
export const VERSAO_PADRAO = "AA";
