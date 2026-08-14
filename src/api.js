import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------------- */
/* Este arquivo concentra toda a comunicação com o Supabase.               */
/* As telas do App.jsx continuam trabalhando com objetos "camelCase"       */
/* (ex: ambienteId, inspetorNome) — a conversão para as colunas do banco   */
/* (snake_case) acontece só aqui, para não precisar mexer nas telas.       */
/* ---------------------------------------------------------------------- */

const BUCKET = "evidencias";

/* ----------------------------- usuários -------------------------------- */

export async function fetchUsers() {
  const { data, error } = await supabase.from("usuarios").select("*").order("nome");
  if (error) throw error;
  return data.map(u => ({ id: u.id, nome: u.nome, email: u.email, senha: u.senha, perfil: u.perfil }));
}

export async function createUser(u) {
  const { data, error } = await supabase
    .from("usuarios")
    .insert({ nome: u.nome, email: u.email, senha: u.senha, perfil: u.perfil })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateUser(id, u) {
  const { error } = await supabase
    .from("usuarios")
    .update({ nome: u.nome, email: u.email, senha: u.senha, perfil: u.perfil })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteUser(id) {
  const { error } = await supabase.from("usuarios").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------------------- ambientes --------------------------------- */

export async function fetchAmbientes() {
  const { data, error } = await supabase.from("ambientes").select("*").order("nome");
  if (error) throw error;
  return data;
}

export async function createAmbiente(a) {
  const { data, error } = await supabase
    .from("ambientes")
    .insert({ nome: a.nome, codigo: a.codigo, bloco: a.bloco, andar: a.andar, tipo: a.tipo })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAmbiente(id, a) {
  const { error } = await supabase
    .from("ambientes")
    .update({ nome: a.nome, bloco: a.bloco, andar: a.andar, tipo: a.tipo })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAmbiente(id) {
  const { error } = await supabase.from("ambientes").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------------------- inspeções ---------------------------------- */

function rowToInspecao(row) {
  return {
    id: row.id,
    ambienteId: row.ambiente_id,
    ambienteNome: row.ambiente_nome,
    inspetorId: row.inspetor_id,
    inspetorNome: row.inspetor_nome,
    status: row.status,
    observacao: row.observacao,
    foto: row.foto_url,
    data: row.data,
    hora: row.hora,
    dataKey: row.data_key,
    criadoEm: row.criado_em,
    geo: row.geo,
  };
}

export async function fetchInspecoes() {
  const { data, error } = await supabase
    .from("inspecoes")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data.map(rowToInspecao);
}

// dataUrl (base64) -> Blob, para poder subir no Storage
async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

async function uploadFoto(dataUrl, ambienteId) {
  const blob = await dataUrlToBlob(dataUrl);
  const path = `${ambienteId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFotoInspecao(dataUrl, ambienteId) {
  return await uploadFoto(dataUrl, ambienteId);
}

export async function createInspecao(reg) {
  const fotoUrl = await uploadFoto(reg.foto, reg.ambienteId);
  const { data, error } = await supabase
    .from("inspecoes")
    .insert({
      ambiente_id: reg.ambienteId,
      ambiente_nome: reg.ambienteNome,
      inspetor_id: reg.inspetorId,
      inspetor_nome: reg.inspetorNome,
      status: reg.status,
      observacao: reg.observacao,
      foto_url: fotoUrl,
      data: reg.data,
      hora: reg.hora,
      data_key: reg.dataKey,
      criado_em: reg.criadoEm,
      geo: reg.geo,
    })
    .select()
    .single();
  if (error) throw error;
  return { row: rowToInspecao(data), fotoUrl };
}

export async function updateInspecao(id, dados) {
  const payload = {
    status: dados.status,
    observacao: dados.observacao,
  };
  if (dados.fotoUrl) payload.foto_url = dados.fotoUrl;
  const { error } = await supabase.from("inspecoes").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteInspecao(id) {
  const { error } = await supabase.from("inspecoes").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------- notificações ---------------------------------- */

function rowToNotificacao(row) {
  return {
    id: row.id,
    ambienteNome: row.ambiente_nome,
    foto: row.foto_url,
    observacao: row.observacao,
    data: row.data,
    hora: row.hora,
    inspetorNome: row.inspetor_nome,
    lida: row.lida,
    criadoEm: row.criado_em,
  };
}

export async function fetchNotificacoes() {
  const { data, error } = await supabase
    .from("notificacoes")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data.map(rowToNotificacao);
}

export async function createNotificacao(n, fotoUrlJaEnviada) {
  const { error } = await supabase.from("notificacoes").insert({
    ambiente_nome: n.ambienteNome,
    foto_url: fotoUrlJaEnviada || null,
    observacao: n.observacao,
    data: n.data,
    hora: n.hora,
    inspetor_nome: n.inspetorNome,
    lida: false,
    criado_em: n.criadoEm,
  });
  if (error) throw error;
}

export async function markNotificacaoLida(id) {
  const { error } = await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
  if (error) throw error;
}

export async function deleteNotificacao(id) {
  const { error } = await supabase.from("notificacoes").delete().eq("id", id);
  if (error) throw error;
}

export async function enviarEmailNotificacao(dados) {
  const { data, error } = await supabase.functions.invoke("notificar-email", { body: dados });
  if (error) {
    let detalhe = error.message || String(error);
    try {
      if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        if (body?.error) detalhe = body.error;
      }
    } catch { /* mantém a mensagem genérica se não der pra ler o corpo */ }
    throw new Error(detalhe);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/* ------------------------------- resumo IA -------------------------------- */

export async function gerarResumoIA(inspecoes, periodoLabel) {
  const payload = inspecoes.map(i => ({
    data: i.data,
    hora: i.hora,
    ambienteNome: i.ambienteNome,
    status: i.status === "limpo" ? "Limpo" : i.status === "parcial" ? "Limpeza Parcial" : "Não Limpo",
    observacao: i.observacao,
    inspetorNome: i.inspetorNome,
  }));
  const { data, error } = await supabase.functions.invoke("resumo-ia", {
    body: { inspecoes: payload, periodoLabel },
  });
  if (error) {
    // Tenta extrair a mensagem real que a Edge Function devolveu no corpo
    // da resposta (o supabase-js, por padrão, só dá um erro genérico).
    let detalhe = error.message || String(error);
    try {
      if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        if (body?.error) detalhe = body.error;
      }
    } catch { /* mantém a mensagem genérica se não der pra ler o corpo */ }
    throw new Error(detalhe);
  }
  if (data?.error) throw new Error(data.error);
  return data.resumo;
}
