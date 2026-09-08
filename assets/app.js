// =====================================================================
//  Estudo Bíblico — lógica da interface.
//
//  Rota por hash (#/AA/43/3) porque o GitHub Pages serve o site a partir
//  de um subcaminho e não sabe reescrever URLs. Hash funciona em
//  qualquer hospedagem estática, e ainda dá link compartilhável e botão
//  voltar funcionando.
// =====================================================================

import * as api from "./api.js";
import { VERSAO_PADRAO } from "./config.js";

const $ = (s) => document.querySelector(s);

const estado = {
  versao: VERSAO_PADRAO,
  livro: 43,
  capitulo: 3,
  livros: [],
  versiculos: [],
  lugares: [],
  usuario: null,
  maxCapitulo: 0,
};

let mapa = null;
let marcadores = [];

// ------------------------------ utilidades ----------------------------

const livroPorId = (id) => estado.livros.find((l) => l.id === Number(id));

const referencia = (verseId) => {
  const livro = livroPorId(Math.floor(verseId / 1_000_000));
  const cap = Math.floor((verseId % 1_000_000) / 1000);
  const ver = verseId % 1000;
  return `${livro ? livro.name_pt : "?"} ${cap}:${ver}`;
};

function escapar(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

/** Remove acentos para comparar — a busca do banco já é tolerante. */
const semAcento = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function realcar(texto, termo) {
  if (!termo) return escapar(texto);
  const alvo = semAcento(termo);
  const base = semAcento(texto);
  let saida = "", i = 0;
  while (i < texto.length) {
    const p = base.indexOf(alvo, i);
    if (p === -1 || !alvo) { saida += escapar(texto.slice(i)); break; }
    saida += escapar(texto.slice(i, p));
    saida += "<mark>" + escapar(texto.slice(p, p + termo.length)) + "</mark>";
    i = p + termo.length;
  }
  return saida;
}

function avisar(elemento, titulo, detalhe) {
  elemento.innerHTML =
    `<div class="vazio"><h2>${escapar(titulo)}</h2><p>${escapar(detalhe)}</p></div>`;
}

// -------------------------------- painel ------------------------------

function abrirPainel(titulo) {
  $("#painel-titulo").textContent = titulo;
  $("#painel").hidden = false;
  if (window.innerWidth <= 900) $("#veu").hidden = false;
  return $("#painel-corpo");
}

function fecharPainel() {
  $("#painel").hidden = true;
  $("#veu").hidden = true;
  if (mapa) { mapa.remove(); mapa = null; marcadores = []; }
}

// -------------------------------- rota --------------------------------

function lerRota() {
  const partes = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (partes.length >= 3) {
    estado.versao = partes[0];
    estado.livro = Number(partes[1]);
    estado.capitulo = Number(partes[2]);
  }
}

function irPara(versao, livro, capitulo) {
  location.hash = `/${versao}/${livro}/${capitulo}`;
}

/** O link do título volta para Gênesis 1 na versão aberta. */
function atualizarMarca() {
  const marca = document.querySelector(".marca");
  if (marca) marca.href = `#/${estado.versao}/1/1`;
}

function irParaVersiculo(verseId) {
  const livro = Math.floor(verseId / 1_000_000);
  const cap = Math.floor((verseId % 1_000_000) / 1000);
  fecharPainel();
  if (livro === estado.livro && cap === estado.capitulo) {
    destacar(verseId);
  } else {
    sessionStorage.setItem("irParaVersiculo", String(verseId));
    irPara(estado.versao, livro, cap);
  }
}

function destacar(verseId) {
  const el = document.querySelector(`[data-verse="${verseId}"]`);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("destacado");
  setTimeout(() => el.classList.remove("destacado"), 1600);
}

// ------------------------------- rail ---------------------------------

async function montarRail() {
  const alvo = $("#rail-conteudo");
  alvo.innerHTML = "";

  for (const testamento of ["AT", "NT"]) {
    const titulo = document.createElement("div");
    titulo.className = "testamento";
    titulo.textContent = testamento === "AT" ? "Antigo Testamento" : "Novo Testamento";
    alvo.appendChild(titulo);

    for (const livro of estado.livros.filter((l) => l.testament === testamento)) {
      const botao = document.createElement("button");
      botao.className = "livro-item";
      botao.textContent = livro.name_pt;
      botao.setAttribute("aria-current", livro.id === estado.livro ? "true" : "false");
      botao.onclick = () => escolherLivro(livro.id);
      alvo.appendChild(botao);

      if (livro.id === estado.livro) {
        const grade = document.createElement("div");
        grade.className = "capitulos";
        for (let c = 1; c <= estado.maxCapitulo; c++) {
          const b = document.createElement("button");
          b.className = "capitulo-item";
          b.textContent = c;
          b.setAttribute("aria-current", c === estado.capitulo ? "true" : "false");
          b.onclick = () => {
            irPara(estado.versao, livro.id, c);
            $("#rail").dataset.aberto = "false";
          };
          grade.appendChild(b);
        }
        alvo.appendChild(grade);
      }
    }
  }
}

async function escolherLivro(id) {
  estado.livro = id;
  estado.maxCapitulo = await api.totalCapitulos(estado.versao, id);
  irPara(estado.versao, id, 1);
}

// ------------------------------ leitura -------------------------------

async function renderizar() {
  const alvo = $("#leitura");

  alvo.innerHTML = '<div class="esqueleto" style="width:40%"></div>' +
    Array.from({ length: 8 }, () => '<div class="esqueleto"></div>').join("");

  try {
    estado.maxCapitulo = await api.totalCapitulos(estado.versao, estado.livro);
    const [versiculos, lugares] = await Promise.all([
      api.lerCapitulo(estado.versao, estado.livro, estado.capitulo),
      api.lugaresDoCapitulo(estado.livro, estado.capitulo).catch(() => []),
    ]);
    estado.versiculos = versiculos;
    estado.lugares = lugares;
  } catch (e) {
    avisar(alvo, "Não foi possível carregar o capítulo",
      e.message || "Verifique a conexão com o Supabase.");
    return;
  }

  const livro = livroPorId(estado.livro);
  if (!estado.versiculos.length) {
    avisar(alvo, "Capítulo sem texto",
      `${livro ? livro.name_pt : ""} ${estado.capitulo} não existe nesta versão.`);
    return;
  }

  const comLugar = new Set(estado.lugares.map((l) => l.verse_id));

  const cabecalho = `
    <div class="cabecalho-capitulo">
      <h1>${escapar(livro ? livro.name_pt : "")} ${estado.capitulo}</h1>
      ${estado.lugares.length
        ? `<button class="btn-mapa" id="btn-mapa">Ver mapa · ${new Set(estado.lugares.map(l=>l.id)).size}</button>`
        : ""}
      <span class="nota-versao">${escapar(estado.versao)}</span>
    </div>`;

  const corpo = estado.versiculos.map((v) => {
    const sinais = [];
    if (Number(v.notas) > 0) sinais.push('<span class="marcador" data-tipo="nota" title="Você anotou aqui">✎</span>');
    if (comLugar.has(v.verse_id)) sinais.push('<span class="marcador" data-tipo="lugar" title="Lugar no mapa">◆</span>');
    return `
      <p class="versiculo" data-verse="${v.verse_id}" ${v.cor ? `data-cor="${escapar(v.cor)}"` : ""}>
        <span class="numero">${v.verse}</span>${escapar(v.texto)}
        <span class="margem">${sinais.join("")}</span>
      </p>`;
  }).join("");

  const anterior = estado.capitulo > 1;
  const proximo = estado.capitulo < estado.maxCapitulo;
  const rodape = `
    <div class="rodape-capitulo">
      <button id="btn-anterior" ${anterior ? "" : "disabled"}>← Capítulo anterior</button>
      <button id="btn-proximo" ${proximo ? "" : "disabled"}>Próximo capítulo →</button>
    </div>`;

  alvo.innerHTML = cabecalho + corpo + rodape;

  if (anterior) $("#btn-anterior").onclick = () => irPara(estado.versao, estado.livro, estado.capitulo - 1);
  if (proximo) $("#btn-proximo").onclick = () => irPara(estado.versao, estado.livro, estado.capitulo + 1);
  const btnMapa = $("#btn-mapa");
  if (btnMapa) btnMapa.onclick = mostrarMapa;

  await montarRail();
  atualizarMarca();
  window.scrollTo(0, 0);

  const alvoVerso = sessionStorage.getItem("irParaVersiculo");
  if (alvoVerso) {
    sessionStorage.removeItem("irParaVersiculo");
    setTimeout(() => destacar(Number(alvoVerso)), 120);
  }
}

// -------------------------- menu do versículo -------------------------

let versiculoAtivo = null;

function abrirMenuVersiculo(elemento) {
  versiculoAtivo = Number(elemento.dataset.verse);
  const menu = $("#menu-versiculo");
  const caixa = elemento.getBoundingClientRect();
  menu.hidden = false;
  const alturaMenu = menu.offsetHeight;
  const espacoAbaixo = window.innerHeight - caixa.bottom;
  const topo = espacoAbaixo > alturaMenu + 12
    ? caixa.bottom + window.scrollY + 6
    : caixa.top + window.scrollY - alturaMenu - 6;
  menu.style.top = `${Math.max(8, topo)}px`;
  menu.style.left = `${Math.max(8, caixa.left)}px`;
}

function fecharMenuVersiculo() {
  $("#menu-versiculo").hidden = true;
}

function montarCores() {
  const cores = ["amarelo", "verde", "azul", "rosa", "roxo"];
  const alvo = $("#cores");
  alvo.innerHTML = cores
    .map((c) => `<button class="cor" data-cor="${c}" aria-label="Marcar de ${c}"></button>`)
    .join("") + '<button class="cor" data-cor="limpar" aria-label="Remover marcação">✕</button>';

  alvo.onclick = async (e) => {
    const botao = e.target.closest(".cor");
    if (!botao || versiculoAtivo == null) return;
    const cor = botao.dataset.cor === "limpar" ? null : botao.dataset.cor;
    fecharMenuVersiculo();
    try {
      await api.marcar(versiculoAtivo, cor, estado.versao);
      const el = document.querySelector(`[data-verse="${versiculoAtivo}"]`);
      if (cor) el.dataset.cor = cor; else delete el.dataset.cor;
    } catch (err) {
      pedirConta(err.message);
    }
  };
}

// ---------------------------- painel: palavras ------------------------

async function mostrarPalavras(verseId) {
  const corpo = abrirPainel(referencia(verseId));
  corpo.innerHTML = '<div class="esqueleto"></div><div class="esqueleto"></div>';

  let palavras;
  try {
    palavras = await api.palavrasDoVersiculo(verseId);
  } catch (e) {
    avisar(corpo, "Não foi possível carregar as palavras", e.message);
    return;
  }

  if (!palavras.length) {
    avisar(corpo, "Sem texto original para este versículo",
      "O interlinear cobre o hebraico do Antigo Testamento e o grego do Novo.");
    return;
  }

  corpo.innerHTML = palavras.map((p) => {
    const idioma = p.original && /[\u0590-\u05FF]/.test(p.original) ? "hbo" : "grc";
    return `
      <div class="palavra">
        <div class="palavra-forma" lang="${idioma}">${escapar(p.original)}</div>
        <div class="palavra-meta">
          ${p.strong ? `<button class="strong" data-strong="${escapar(p.strong)}">${escapar(p.strong)}</button>` : ""}
          ${p.translit ? `<span>${escapar(p.translit)}</span>` : ""}
        </div>
        ${p.definicao ? `<div class="palavra-def">${escapar(p.definicao)}</div>` : ""}
        ${p.origem ? `<div class="palavra-origem"><b>Origem.</b> ${escapar(p.origem)}</div>` : ""}
        ${p.morfologia ? `<div class="palavra-morf">${escapar(p.morfologia)}</div>` : ""}
      </div>`;
  }).join("");

  corpo.onclick = (e) => {
    const botao = e.target.closest(".strong");
    if (botao) mostrarOcorrencias(botao.dataset.strong);
  };
}

async function mostrarOcorrencias(strong) {
  const corpo = abrirPainel(`Raiz ${strong}`);
  corpo.innerHTML = '<div class="esqueleto"></div><div class="esqueleto"></div>';

  let linhas;
  try {
    linhas = await api.ocorrenciasDoStrong(strong, estado.versao);
  } catch (e) {
    avisar(corpo, "Não foi possível buscar as ocorrências", e.message);
    return;
  }

  // A lista pode passar de 200 itens; mostramos em blocos para não travar.
  let mostrados = 0;
  const bloco = 60;

  const desenhar = () => {
    const parte = linhas.slice(mostrados, mostrados + bloco);
    mostrados += parte.length;
    const html = parte.map((r) => `
      <button class="resultado" data-verse="${r.verse_id}">
        <div class="resultado-ref">${escapar(r.referencia)} · ${escapar(r.original || "")}</div>
        <div class="resultado-texto">${escapar(r.texto)}</div>
      </button>`).join("");
    corpo.insertAdjacentHTML("beforeend", html);
    const btn = $("#btn-mais");
    if (btn) btn.remove();
    if (mostrados < linhas.length) {
      corpo.insertAdjacentHTML("beforeend",
        `<button class="secundario" id="btn-mais" style="margin-top:14px">Mostrar mais ${Math.min(bloco, linhas.length - mostrados)}</button>`);
      $("#btn-mais").onclick = desenhar;
    }
  };

  corpo.innerHTML = `<p class="trecho-versiculo">${linhas.length} versículos usam esta raiz.</p>`;
  desenhar();
  corpo.onclick = (e) => {
    const r = e.target.closest(".resultado");
    if (r) irParaVersiculo(Number(r.dataset.verse));
  };
}

// ---------------------------- painel: anotação ------------------------

async function mostrarAnotacao(verseId) {
  const corpo = abrirPainel(referencia(verseId));
  const versiculo = estado.versiculos.find((v) => v.verse_id === verseId);

  if (!estado.usuario) {
    avisar(corpo, "Entre para anotar",
      "Ler não exige conta. Anotações e marcações precisam, para ficarem só suas.");
    return;
  }

  let notas = [];
  try { notas = await api.notasDoVersiculo(verseId); } catch (_) {}

  corpo.innerHTML = `
    ${versiculo ? `<div class="trecho-versiculo">${escapar(versiculo.texto)}</div>` : ""}
    <textarea class="editor-nota" id="editor-nota" placeholder="O que você percebeu aqui?"></textarea>
    <div class="nota-acoes">
      <button class="primario" id="btn-salvar-nota">Salvar anotação</button>
    </div>
    <div id="lista-notas" style="margin-top:20px">
      ${notas.map((n) => `
        <div class="nota-item" data-id="${n.id}">${escapar(n.body)}
          <div class="nota-acoes">
            <button class="secundario" data-apagar="${n.id}">Apagar</button>
          </div>
        </div>`).join("")}
    </div>`;

  $("#btn-salvar-nota").onclick = async () => {
    const texto = $("#editor-nota").value.trim();
    if (!texto) return;
    try {
      await api.salvarNota(verseId, texto);
      await mostrarAnotacao(verseId);
      marcarMargem(verseId);
    } catch (e) {
      pedirConta(e.message);
    }
  };

  $("#lista-notas").onclick = async (e) => {
    const id = e.target.dataset?.apagar;
    if (!id) return;
    await api.apagarNota(id);
    await mostrarAnotacao(verseId);
  };
}

function marcarMargem(verseId) {
  const el = document.querySelector(`[data-verse="${verseId}"] .margem`);
  if (el && !el.querySelector('[data-tipo="nota"]')) {
    el.insertAdjacentHTML("afterbegin",
      '<span class="marcador" data-tipo="nota" title="Você anotou aqui">✎</span>');
  }
}

// ------------------------------ painel: mapa --------------------------

function mostrarMapa() {
  const corpo = abrirPainel("Lugares deste capítulo");
  const unicos = [];
  const vistos = new Set();
  for (const l of estado.lugares) {
    if (vistos.has(l.id)) continue;
    vistos.add(l.id);
    unicos.push(l);
  }

  corpo.innerHTML = `
    <div id="mapa"></div>
    <p class="aviso-mapa">As posições seguem a identificação mais aceita pelo
      OpenBible.info. Alguns lugares — Sodoma, Emaús e o monte Sinai entre eles —
      têm localização debatida.</p>
    <div style="margin-top:14px">
      ${unicos.map((l) => `
        <button class="lugar-item" data-id="${l.id}" data-verse="${l.verse_id}">
          <div class="lugar-nome">${escapar(l.nome)}</div>
          <div class="lugar-meta">${escapar(l.tipo || "")}${l.atual ? " · hoje: " + escapar(l.atual) : ""}</div>
        </button>`).join("")}
    </div>`;

  mapa = L.map("mapa");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 17,
  }).addTo(mapa);

  marcadores = unicos.map((l) => {
    const m = L.marker([l.lat, l.lon]).addTo(mapa);
    m.bindPopup(
      `<b>${escapar(l.nome)}</b><br>${escapar(l.atual || l.tipo || "")}`
    );
    m.on("click", () => irParaVersiculo(l.verse_id));
    return { id: l.id, marcador: m };
  });

  if (unicos.length) {
    mapa.fitBounds(L.latLngBounds(unicos.map((l) => [l.lat, l.lon])).pad(0.25));
  }
  setTimeout(() => mapa.invalidateSize(), 60);

  corpo.querySelectorAll(".lugar-item").forEach((b) => {
    b.onclick = () => {
      const alvo = marcadores.find((m) => m.id === Number(b.dataset.id));
      if (alvo) { mapa.setView(alvo.marcador.getLatLng(), 8); alvo.marcador.openPopup(); }
    };
  });
}

// ------------------------------- busca --------------------------------

async function fazerBusca(termo) {
  const corpo = abrirPainel(`Busca: ${termo}`);
  corpo.innerHTML = '<div class="esqueleto"></div><div class="esqueleto"></div>';

  let linhas;
  try {
    linhas = await api.buscar(estado.versao, termo, 50);
  } catch (e) {
    avisar(corpo, "A busca falhou", e.message);
    return;
  }

  if (!linhas.length) {
    avisar(corpo, "Nada encontrado",
      "Tente uma palavra sozinha, sem artigo, ou outra forma da mesma palavra.");
    return;
  }

  corpo.innerHTML = linhas.map((r) => `
    <button class="resultado" data-verse="${r.verse_id}">
      <div class="resultado-ref">${escapar(r.referencia)}</div>
      <div class="resultado-texto">${realcar(r.texto, termo)}</div>
    </button>`).join("");

  corpo.onclick = (e) => {
    const r = e.target.closest(".resultado");
    if (r) irParaVersiculo(Number(r.dataset.verse));
  };
}

// -------------------------------- conta -------------------------------

let modoCriar = false;

function pedirConta(mensagem) {
  const aviso = $("#conta-aviso");
  aviso.hidden = !mensagem;
  aviso.textContent = mensagem || "";
  $("#dialogo-conta").showModal();
}

function atualizarBotaoConta() {
  $("#btn-conta").textContent = estado.usuario ? "Sair" : "Entrar";
}

async function configurarConta() {
  const sessao = await api.sessao();
  estado.usuario = sessao?.user ?? null;
  atualizarBotaoConta();

  // supabase-js dispara o evento inicial na hora; só re-renderiza depois
  // que a inicialização terminou, senão desenhamos o capítulo duas vezes.
  api.aoMudarSessao((s) => {
    estado.usuario = s?.user ?? null;
    atualizarBotaoConta();
    if (estado.pronto) renderizar();
  });

  $("#btn-conta").onclick = async () => {
    if (estado.usuario) { await api.sair(); }
    else pedirConta();
  };

  $("#btn-cancelar-conta").onclick = () => $("#dialogo-conta").close();

  $("#btn-alternar-conta").onclick = () => {
    modoCriar = !modoCriar;
    $("#titulo-conta").textContent = modoCriar ? "Criar conta" : "Entrar";
    $("#btn-enviar-conta").textContent = modoCriar ? "Criar conta" : "Entrar";
    $("#btn-alternar-conta").textContent = modoCriar ? "Já tenho conta" : "Criar uma conta";
  };

  $("#btn-enviar-conta").onclick = async () => {
    const email = $("#conta-email").value.trim();
    const senha = $("#conta-senha").value;
    const aviso = $("#conta-aviso");
    const { error } = modoCriar
      ? await api.criarConta(email, senha)
      : await api.entrar(email, senha);
    if (error) {
      aviso.hidden = false;
      aviso.textContent = error.message;
      return;
    }
    $("#dialogo-conta").close();
    if (modoCriar) {
      alert("Conta criada. Se o projeto exigir confirmação, verifique seu e-mail.");
    }
  };
}

// -------------------------------- tema --------------------------------

function configurarTema() {
  const salvo = localStorage.getItem("tema");
  const escuro = salvo
    ? salvo === "escuro"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.tema = escuro ? "escuro" : "claro";

  $("#btn-tema").onclick = () => {
    const novo = document.documentElement.dataset.tema === "escuro" ? "claro" : "escuro";
    document.documentElement.dataset.tema = novo;
    localStorage.setItem("tema", novo);
  };
}

// -------------------------------- início ------------------------------

async function iniciar() {
  configurarTema();
  montarCores();

  if (!api.configurado()) {
    avisar($("#leitura"), "Falta configurar o Supabase",
      "Abra assets/config.js e preencha SUPABASE_URL e SUPABASE_ANON_KEY com os dados do seu projeto.");
    return;
  }

  try {
    const [livros, versoes] = await Promise.all([api.listarLivros(), api.listarVersoes()]);
    estado.livros = livros;

    const seletor = $("#seletor-versao");
    seletor.innerHTML = versoes
      .map((v) => `<option value="${escapar(v.code)}">${escapar(v.code)}</option>`)
      .join("");
    seletor.onchange = () => irPara(seletor.value, estado.livro, estado.capitulo);
  } catch (e) {
    avisar($("#leitura"), "Não foi possível falar com o Supabase",
      e.message || "Confira a URL e a chave em assets/config.js.");
    return;
  }

  await configurarConta();

  lerRota();
  $("#seletor-versao").value = estado.versao;
  if (!location.hash) irPara(estado.versao, estado.livro, estado.capitulo);
  await renderizar();
  estado.pronto = true;

  window.addEventListener("hashchange", async () => {
    lerRota();
    $("#seletor-versao").value = estado.versao;
    fecharPainel();
    await renderizar();
  });
}

// ------------------------------- eventos ------------------------------

$("#palco").addEventListener("click", (e) => {
  const marcador = e.target.closest(".marcador");
  if (marcador) {
    const verso = Number(marcador.closest(".versiculo").dataset.verse);
    if (marcador.dataset.tipo === "nota") mostrarAnotacao(verso);
    else mostrarMapa();
    return;
  }
  const versiculo = e.target.closest(".versiculo");
  if (versiculo) abrirMenuVersiculo(versiculo);
  else fecharMenuVersiculo();
});

$("#menu-versiculo").addEventListener("click", (e) => {
  const acao = e.target.dataset.acao;
  if (!acao || versiculoAtivo == null) return;
  fecharMenuVersiculo();
  if (acao === "anotar") mostrarAnotacao(versiculoAtivo);
  if (acao === "palavras") mostrarPalavras(versiculoAtivo);
});

$("#btn-fechar-painel").onclick = fecharPainel;
$("#veu").onclick = () => { fecharPainel(); $("#rail").dataset.aberto = "false"; };

$("#form-busca").addEventListener("submit", (e) => {
  e.preventDefault();
  const termo = $("#campo-busca").value.trim();
  if (termo) fazerBusca(termo);
});

$("#btn-menu").onclick = () => {
  const rail = $("#rail");
  const aberto = rail.dataset.aberto === "true";
  rail.dataset.aberto = aberto ? "false" : "true";
  $("#veu").hidden = aberto;
};

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (e.key === "Escape") { fecharPainel(); fecharMenuVersiculo(); }
  if (e.key === "ArrowLeft" && estado.capitulo > 1)
    irPara(estado.versao, estado.livro, estado.capitulo - 1);
  if (e.key === "ArrowRight" && estado.capitulo < estado.maxCapitulo)
    irPara(estado.versao, estado.livro, estado.capitulo + 1);
});

iniciar();
