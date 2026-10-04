// ====== CONFIGURE AQUI (troque todo mês o que for preciso) ======
const CONFIG = {
  URL_SCRIPT:
    "https://script.google.com/macros/s/AKfycbyLIKwHK_if9qX9itcTWQAjE0Rt7Xpmpsq2oYKZLsz1yisqaNAsbYRY8lYTUkqMqK2HNg/exec",
  TOTAL: 100,
  PRECO: 10,
  PREMIO_TITULO: "Kit de limpeza especial",
  PREMIO_ITENS:
    "10 Panos de chão, 1 mop de limpeza, 1 mop limpa vidros e 1 kit de sacos de lixo.",
  WHATSAPP: "5549991782851",
  CHAVE_PIX: "33645986000106",
  HORAS_RESERVA: 24,
  SORTEIO:
    "Sorteio pela Loteria Federal assim que os 100 números forem vendidos.",
};

// ── VENDEDORES ──────────────────────────────────────────────
// Cada vendedor tem um link próprio: suapagina.com/rifa/?vendedor=ID
// Para adicionar alguém novo, basta incluir uma linha aqui.
const VENDEDORES = {
  loja: { nome: "Casa do Sabão (Loja)" },
  arthur: { nome: "Arthur" },
  gisele: { nome: "Gisele" },
  thais: { nome: "Thais" },
  // joao: { nome: "João" },
};
// =================================================================

const $ = (id) => document.getElementById(id);
const brl = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

let ocupados = {};
let escolhidos = new Set();

// ── VENDEDOR ATUAL VIA LINK (?vendedor=ID) ──
// Se o cliente abre o link com ?vendedor=arthur, guardamos no navegador
// para que continue identificado mesmo se recarregar a página.
// Link sem vendedor (ou com ID desconhecido) cai em "loja".
function pegarVendedorAtual() {
  const params = new URLSearchParams(window.location.search);
  const idURL = (params.get("vendedor") || "").trim().toLowerCase();
  let salvo = null;
  try {
    salvo = localStorage.getItem("rifaVendedorId");
  } catch (e) {}

  if (idURL && VENDEDORES[idURL]) {
    try {
      localStorage.setItem("rifaVendedorId", idURL);
    } catch (e) {}
    return { id: idURL, ...VENDEDORES[idURL] };
  }

  const id = salvo && VENDEDORES[salvo] ? salvo : "loja";
  return { id, ...VENDEDORES[id] };
}

const vendedorAtual = pegarVendedorAtual();

// Textos da página
$("premio-titulo").textContent = CONFIG.PREMIO_TITULO;
$("premio-itens").textContent = CONFIG.PREMIO_ITENS;
$("preco-linha").textContent =
  CONFIG.TOTAL + " números a " + brl(CONFIG.PRECO) + " cada";
$("regras").textContent =
  "A reserva vale por " +
  CONFIG.HORAS_RESERVA +
  " horas. Depois do Pix, o número é confirmado. " +
  CONFIG.SORTEIO;

// Grade de números
function desenharGrade() {
  const grade = $("grade");
  grade.innerHTML = "";
  for (let n = 1; n <= CONFIG.TOTAL; n++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = n;
    b.setAttribute("aria-label", "Número " + n);
    if (ocupados[n]) {
      b.disabled = true;
      escolhidos.delete(n);
    }
    if (escolhidos.has(n)) b.classList.add("sel");
    b.addEventListener("click", () => alternar(n, b));
    grade.appendChild(b);
  }
  atualizarResumo();
}

function alternar(n, botao) {
  if (escolhidos.has(n)) escolhidos.delete(n);
  else escolhidos.add(n);
  botao.classList.toggle("sel");
  atualizarResumo();
}

function listaOrdenada() {
  return [...escolhidos].sort((a, b) => a - b);
}

function atualizarResumo() {
  const lista = listaOrdenada();
  const resumo = $("resumo");
  $("enviar").disabled = lista.length === 0;
  if (!lista.length) {
    resumo.hidden = true;
    return;
  }
  resumo.hidden = false;
  resumo.textContent =
    lista.join(", ") + " — " + brl(lista.length * CONFIG.PRECO);
}

// Busca os números já vendidos na planilha
async function carregar() {
  try {
    const r = await fetch(CONFIG.URL_SCRIPT);
    const d = await r.json();
    ocupados = d.ocupados || {};
    $("carregando").hidden = true;
  } catch (e) {
    $("carregando").textContent =
      "Não foi possível carregar os números. Recarregue a página.";
  }
  desenharGrade();
}

function mensagem(texto, erro) {
  const m = $("msg");
  m.textContent = texto;
  m.className = erro ? "erro" : "";
}

// Máscara do telefone: (49) 99999-9999
$("telefone").addEventListener("input", (e) => {
  let d = e.target.value.replace(/\D/g, "").slice(0, 11);
  if (d.length > 6)
    d =
      "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4);
  else if (d.length > 2) d = "(" + d.slice(0, 2) + ") " + d.slice(2);
  e.target.value = d;
});

// Envio da reserva
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = $("nome").value.trim();
  const tel = $("telefone").value.replace(/\D/g, "");
  const lista = listaOrdenada();

  if (nome.length < 2) return mensagem("Informe seu nome.", true);
  if (tel.length < 10) return mensagem("Informe o telefone com DDD.", true);
  if (!lista.length) return mensagem("Escolha pelo menos um número.", true);

  const btn = $("enviar");
  btn.disabled = true;
  mensagem("Reservando…", false);

  try {
    const r = await fetch(CONFIG.URL_SCRIPT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita bloqueio de CORS
      body: JSON.stringify({
        nome,
        telefone: tel,
        numeros: lista,
        vendedorId: vendedorAtual.id,
        vendedor: vendedorAtual.nome,
      }),
    });
    const d = await r.json();
    if (d.ok) return confirmar(nome, lista);
    if (d.ocupados) ocupados = d.ocupados;
    desenharGrade();
    mensagem(d.erro || "Não foi possível reservar.", true);
  } catch (err) {
    mensagem("Falha de conexão. Tente de novo.", true);
  }
  btn.disabled = escolhidos.size === 0;
});

// Tela de confirmação com Pix e WhatsApp
function confirmar(nome, lista) {
  const total = lista.length * CONFIG.PRECO;
  $("area-rifa").hidden = true;
  $("resumo").hidden = true;
  $("ok").hidden = false;
  $("ok-numeros").textContent = lista.join(", ");
  $("ok-total").textContent = brl(total);
  $("ok-pix").textContent = CONFIG.CHAVE_PIX;
  let txt =
    "Olá! Sou " +
    nome +
    ". Reservei os números " +
    lista.join(", ") +
    " da rifa (" +
    brl(total) +
    "). Segue o comprovante do Pix.";
  if (vendedorAtual.id !== "loja")
    txt += " Vendedor(a): " + vendedorAtual.nome + ".";
  $("ok-zap").href =
    "https://wa.me/" + CONFIG.WHATSAPP + "?text=" + encodeURIComponent(txt);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

carregar();
