// =====================================================================
//  Camada de acesso ao Supabase.
//
//  Toda a lógica pesada mora no banco, nas cinco funções RPC. Aqui só
//  chamamos elas e devolvemos o resultado — por isso este arquivo é
//  curto, e por isso trocar de frontend um dia não exige refazer nada.
// =====================================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Erro de configuração dá uma mensagem útil em vez de falha silenciosa. */
export function configurado() {
  return !SUPABASE_URL.includes("SEUPROJETO") &&
         !SUPABASE_ANON_KEY.includes("COLE_AQUI");
}

async function rpc(nome, args) {
  const { data, error } = await db.rpc(nome, args);
  if (error) throw error;
  return data ?? [];
}

// ------------------------------ conteúdo ------------------------------

export async function listarLivros() {
  const { data, error } = await db
    .from("books")
    .select("id, pt_abbrev, name_pt, testament")
    .order("id");
  if (error) throw error;
  return data;
}

export async function listarVersoes() {
  const { data, error } = await db
    .from("versions")
    .select("code, name, language")
    .order("code");
  if (error) throw error;
  return data;
}

/** Quantos capítulos o livro tem, na versão dada. */
export async function totalCapitulos(versao, livroId) {
  const { data, error } = await db
    .from("verses")
    .select("chapter")
    .eq("version_code", versao)
    .eq("book_id", livroId)
    .order("chapter", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data.length ? data[0].chapter : 0;
}

export const lerCapitulo = (versao, livro, capitulo) =>
  rpc("ler_capitulo", {
    p_version: versao,
    p_book: Number(livro),
    p_chapter: Number(capitulo),
  });

export const palavrasDoVersiculo = (verseId) =>
  rpc("palavras_do_versiculo", { p_verse_id: Number(verseId) });

export const buscar = (versao, termo, limite = 50) =>
  rpc("buscar", { p_version: versao, p_termo: termo, p_limite: limite });

export const lugaresDoCapitulo = (livro, capitulo) =>
  rpc("lugares_do_capitulo", {
    p_book: Number(livro),
    p_chapter: Number(capitulo),
  });

export const ocorrenciasDoStrong = (strong, versao) =>
  rpc("ocorrencias_do_strong", { p_strong: strong, p_version: versao });

// -------------------------------- conta -------------------------------

export const sessao = () => db.auth.getSession().then((r) => r.data.session);
export const aoMudarSessao = (fn) => db.auth.onAuthStateChange((_e, s) => fn(s));
export const entrar = (email, password) =>
  db.auth.signInWithPassword({ email, password });
export const criarConta = (email, password) => db.auth.signUp({ email, password });
export const sair = () => db.auth.signOut();

async function usuarioId() {
  const s = await sessao();
  if (!s) throw new Error("Entre na sua conta para salvar.");
  return s.user.id;
}

// ------------------------- anotações e marcações ----------------------
// O user_id é sempre preenchido aqui. A política de RLS exige que ele
// seja igual ao usuário autenticado, e um insert sem ele é recusado
// pelo banco sem gerar erro visível na tela.

export async function notasDoVersiculo(verseId) {
  const { data, error } = await db
    .from("notes")
    .select("id, body, created_at")
    .eq("verse_id", verseId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function salvarNota(verseId, body) {
  const user_id = await usuarioId();
  const { data, error } = await db
    .from("notes")
    .insert({ user_id, verse_id: verseId, body })
    .select();
  if (error) throw error;
  return data[0];
}

export async function apagarNota(id) {
  const { error } = await db.from("notes").delete().eq("id", id);
  if (error) throw error;
}

export async function marcar(verseId, cor, versao) {
  const user_id = await usuarioId();
  await db.from("highlights").delete()
    .eq("user_id", user_id).eq("verse_id", verseId);
  if (!cor) return null;
  const { data, error } = await db
    .from("highlights")
    .insert({ user_id, verse_id: verseId, color: cor, version_code: versao })
    .select();
  if (error) throw error;
  return data[0];
}

export async function minhasNotas() {
  const { data, error } = await db
    .from("notes")
    .select("id, verse_id, body, created_at")
    .order("verse_id");
  if (error) throw error;
  return data;
}

/** Texto de versículos avulsos, para a tela de anotações. */
export async function textoDeVersiculos(ids, versao) {
  if (!ids.length) return {};
  const { data, error } = await db
    .from("verses")
    .select("verse_id, text")
    .eq("version_code", versao)
    .in("verse_id", ids);
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.verse_id, r.text]));
}
