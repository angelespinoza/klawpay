const { useState, useEffect, useCallback } = React;

// ── i18n ────────────────────────────────────────────
const T = {
  en: {
    onboarding: "Onboarding", dashboard: "Dashboard", settings: "Settings",
    businessName: "Business Name", whatsapp: "WhatsApp Number",
    chainsToAccept: "Chains to Accept", refundPolicy: "Refund Policy",
    autoWindow: "Auto-approve window", autoUnder: "Auto-approve under",
    maxRefunds: "Max refunds per client", createWallets: "Create My Wallets",
    creating: "Creating wallets...", yourWallets: "Your Wallet Addresses",
    copied: "Copied!", copy: "Copy", scanQr: "Scan to receive payments",
    totalReceived: "Received Today", totalRefunded: "Refunded Today",
    netRevenue: "Net Revenue", recentTx: "Recent Transactions",
    time: "Time", client: "Client", amount: "Amount", chain: "Chain",
    type: "Type", status: "Status", explorer: "Explorer",
    payment: "payment", refund: "refund",
    editPolicy: "Edit Refund Policy", savePolicy: "Save Policy", saved: "Saved!",
    whatsappConnected: "WhatsApp Connected", webhookUrl: "OpenClaw Webhook URL",
    webhookHint: "Add this to your OpenClaw config:",
    testConnection: "Test Connection", testing: "Testing...",
    connected: "Connected", disconnected: "Disconnected",
    merchantId: "Merchant ID", noTx: "No transactions yet",
    custom: "Custom", unlimited: "Unlimited",
    welcome: "Set up your merchant account to start accepting crypto payments.",
    h24: "24 hours", h72: "72 hours", d7: "7 days",
  },
  es: {
    onboarding: "Registro", dashboard: "Panel", settings: "Ajustes",
    businessName: "Nombre del Negocio", whatsapp: "Numero de WhatsApp",
    chainsToAccept: "Cadenas a Aceptar", refundPolicy: "Politica de Reembolso",
    autoWindow: "Ventana de auto-aprobacion", autoUnder: "Auto-aprobar menor a",
    maxRefunds: "Max reembolsos por cliente", createWallets: "Crear Mis Billeteras",
    creating: "Creando billeteras...", yourWallets: "Direcciones de Billetera",
    copied: "Copiado!", copy: "Copiar", scanQr: "Escanea para recibir pagos",
    totalReceived: "Recibido Hoy", totalRefunded: "Reembolsado Hoy",
    netRevenue: "Ingreso Neto", recentTx: "Transacciones Recientes",
    time: "Hora", client: "Cliente", amount: "Monto", chain: "Cadena",
    type: "Tipo", status: "Estado", explorer: "Explorador",
    payment: "pago", refund: "reembolso",
    editPolicy: "Editar Politica de Reembolso", savePolicy: "Guardar", saved: "Guardado!",
    whatsappConnected: "WhatsApp Conectado", webhookUrl: "URL de Webhook OpenClaw",
    webhookHint: "Agrega esto a tu configuracion de OpenClaw:",
    testConnection: "Probar Conexion", testing: "Probando...",
    connected: "Conectado", disconnected: "Desconectado",
    merchantId: "ID de Comercio", noTx: "Sin transacciones aun",
    custom: "Personalizado", unlimited: "Ilimitado",
    welcome: "Configura tu cuenta de comercio para comenzar a aceptar pagos crypto.",
    h24: "24 horas", h72: "72 horas", d7: "7 dias",
  },
  pt: {
    onboarding: "Cadastro", dashboard: "Painel", settings: "Configuracoes",
    businessName: "Nome do Negocio", whatsapp: "Numero de WhatsApp",
    chainsToAccept: "Redes Aceitas", refundPolicy: "Politica de Reembolso",
    autoWindow: "Janela de auto-aprovacao", autoUnder: "Auto-aprovar abaixo de",
    maxRefunds: "Max reembolsos por cliente", createWallets: "Criar Minhas Carteiras",
    creating: "Criando carteiras...", yourWallets: "Enderecos das Carteiras",
    copied: "Copiado!", copy: "Copiar", scanQr: "Escaneie para receber pagamentos",
    totalReceived: "Recebido Hoje", totalRefunded: "Reembolsado Hoje",
    netRevenue: "Receita Liquida", recentTx: "Transacoes Recentes",
    time: "Hora", client: "Cliente", amount: "Valor", chain: "Rede",
    type: "Tipo", status: "Status", explorer: "Explorador",
    payment: "pagamento", refund: "reembolso",
    editPolicy: "Editar Politica de Reembolso", savePolicy: "Salvar", saved: "Salvo!",
    whatsappConnected: "WhatsApp Conectado", webhookUrl: "URL do Webhook OpenClaw",
    webhookHint: "Adicione isso a sua configuracao OpenClaw:",
    testConnection: "Testar Conexao", testing: "Testando...",
    connected: "Conectado", disconnected: "Desconectado",
    merchantId: "ID do Comerciante", noTx: "Nenhuma transacao ainda",
    custom: "Personalizado", unlimited: "Ilimitado",
    welcome: "Configure sua conta de comerciante para comecar a aceitar pagamentos crypto.",
    h24: "24 horas", h72: "72 horas", d7: "7 dias",
  },
};

const CHAINS = [
  { id: "solana", label: "Solana", icon: "SOL" },
  { id: "base", label: "EVM / Base", icon: "ETH" },
  { id: "xrpl", label: "XRPL", icon: "XRP" },
  { id: "sui", label: "Sui", icon: "SUI" },
];

const EXPLORER = {
  solana: (h) => `https://explorer.solana.com/tx/${h}?cluster=devnet`,
  base: (h) => `https://sepolia.basescan.org/tx/${h}`,
  xrpl: (h) => `https://testnet.xrpl.org/transactions/${h}`,
  sui: (h) => `https://suiexplorer.com/txblock/${h}?network=testnet`,
  ethereum: (h) => `https://sepolia.etherscan.io/tx/${h}`,
};

const API = "";

// ── QR Code (simple SVG via API) ────────────────────
function QR({ value, size = 120 }) {
  // Use a deterministic SVG pattern as placeholder QR
  // In production use a real QR lib
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=131720&color=c8cdd8&format=svg`;
  return React.createElement("img", { src, width: size, height: size, alt: "QR", style: { borderRadius: 8 } });
}

// ── Components ──────────────────────────────────────

function Tab({ active, label, onClick }) {
  return React.createElement("button", {
    onClick,
    className: `tab ${active ? "tab-active" : ""}`,
  }, label);
}

function Stat({ label, value, color }) {
  return React.createElement("div", { className: "stat-card" },
    React.createElement("div", { className: "stat-label" }, label),
    React.createElement("div", { className: "stat-value", style: { color } }, value),
  );
}

function CopyBtn({ text, t }) {
  const [copied, setCopied] = useState(false);
  return React.createElement("button", {
    className: "copy-btn",
    onClick: () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); },
  }, copied ? t.copied : t.copy);
}

// ── SCREEN 1: Onboarding ────────────────────────────

function Onboarding({ t, merchant, setMerchant }) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [chains, setChains] = useState(["xrpl"]);
  const [autoWindow, setAutoWindow] = useState("72h");
  const [autoUnder, setAutoUnder] = useState("50");
  const [customUnder, setCustomUnder] = useState("");
  const [maxRefunds, setMaxRefunds] = useState("3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleChain = (id) => {
    setChains((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const register = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(API + "/api/merchants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: name, whatsapp, chains,
          policy: {
            autoWindow,
            autoUnder: autoUnder === "custom" ? Number(customUnder) : Number(autoUnder),
            maxRefunds: maxRefunds === "unlimited" ? -1 : Number(maxRefunds),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setMerchant(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  if (merchant) {
    return React.createElement("div", null,
      React.createElement("h2", { className: "section-title" }, t.yourWallets),
      React.createElement("p", { className: "dim", style: { marginBottom: 8 } }, t.merchantId + ": " + merchant.merchantId),
      React.createElement("div", { className: "wallets-grid" },
        Object.entries(merchant.wallets || {}).map(([chain, addr]) =>
          React.createElement("div", { key: chain, className: "wallet-card" },
            React.createElement("div", { className: "wallet-chain" }, chain),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, marginTop: 8 } },
              React.createElement(QR, { value: addr, size: 96 }),
              React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                React.createElement("div", { className: "wallet-addr" }, addr),
                React.createElement(CopyBtn, { text: addr, t }),
              ),
            ),
            React.createElement("div", { className: "dim", style: { fontSize: 10, marginTop: 6 } }, t.scanQr),
          )
        )
      )
    );
  }

  return React.createElement("div", null,
    React.createElement("p", { className: "dim", style: { marginBottom: 20 } }, t.welcome),
    React.createElement("div", { className: "form-grid" },
      React.createElement("div", { className: "form-group" },
        React.createElement("label", null, t.businessName),
        React.createElement("input", { value: name, onChange: (e) => setName(e.target.value), placeholder: "My Store" }),
      ),
      React.createElement("div", { className: "form-group" },
        React.createElement("label", null, t.whatsapp),
        React.createElement("input", { value: whatsapp, onChange: (e) => setWhatsapp(e.target.value), placeholder: "+1 555 123 4567" }),
      ),
    ),
    React.createElement("label", { style: { display: "block", marginTop: 16, marginBottom: 8 } }, t.chainsToAccept),
    React.createElement("div", { className: "chains-row" },
      CHAINS.map((ch) =>
        React.createElement("label", { key: ch.id, className: `chain-check ${chains.includes(ch.id) ? "active" : ""}` },
          React.createElement("input", { type: "checkbox", checked: chains.includes(ch.id), onChange: () => toggleChain(ch.id) }),
          React.createElement("span", null, ch.icon + " " + ch.label),
        )
      )
    ),
    React.createElement("h3", { className: "section-title", style: { marginTop: 24 } }, t.refundPolicy),
    React.createElement("div", { className: "form-grid" },
      React.createElement("div", { className: "form-group" },
        React.createElement("label", null, t.autoWindow),
        React.createElement("select", { value: autoWindow, onChange: (e) => setAutoWindow(e.target.value) },
          React.createElement("option", { value: "24h" }, t.h24),
          React.createElement("option", { value: "72h" }, t.h72),
          React.createElement("option", { value: "7d" }, t.d7),
        ),
      ),
      React.createElement("div", { className: "form-group" },
        React.createElement("label", null, t.autoUnder),
        React.createElement("select", { value: autoUnder, onChange: (e) => setAutoUnder(e.target.value) },
          React.createElement("option", { value: "10" }, "$10"),
          React.createElement("option", { value: "50" }, "$50"),
          React.createElement("option", { value: "200" }, "$200"),
          React.createElement("option", { value: "custom" }, t.custom),
        ),
        autoUnder === "custom" && React.createElement("input", {
          type: "number", value: customUnder, onChange: (e) => setCustomUnder(e.target.value),
          placeholder: "$", style: { marginTop: 6 },
        }),
      ),
      React.createElement("div", { className: "form-group" },
        React.createElement("label", null, t.maxRefunds),
        React.createElement("select", { value: maxRefunds, onChange: (e) => setMaxRefunds(e.target.value) },
          React.createElement("option", { value: "1" }, "1"),
          React.createElement("option", { value: "2" }, "2"),
          React.createElement("option", { value: "3" }, "3"),
          React.createElement("option", { value: "unlimited" }, t.unlimited),
        ),
      ),
    ),
    error && React.createElement("div", { className: "error-box" }, error),
    React.createElement("button", {
      className: "btn-primary", onClick: register, disabled: loading || !name,
      style: { marginTop: 16 },
    }, loading ? t.creating : t.createWallets),
  );
}

// ── SCREEN 2: Dashboard ─────────────────────────────

function DashboardScreen({ t, merchant }) {
  const [audit, setAudit] = useState([]);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(API + "/api/audit?limit=20");
        if (res.ok) setAudit(await res.json());
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = audit.filter((e) => e.timestamp?.startsWith(today));

  const received = todayEntries
    .filter((e) => e.event === "payment_simulated")
    .reduce((s, e) => s + (e.data?.amount || 0), 0);
  const refunded = todayEntries
    .filter((e) => e.event === "refund_executed")
    .reduce((s, e) => s + (e.data?.amount || 0), 0);

  const fmtTime = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
  };

  const getType = (event) => {
    if (event.includes("payment")) return t.payment;
    if (event.includes("refund")) return t.refund;
    return event;
  };

  const getStatus = (event) => {
    if (event.includes("executed") || event.includes("simulated")) return "success";
    if (event.includes("denied")) return "denied";
    if (event.includes("failed")) return "failed";
    return "pending";
  };

  const getExplorer = (entry) => {
    const d = entry.data;
    if (!d?.txHash || !d?.chain) return null;
    const fn = EXPLORER[d.chain];
    return fn ? fn(d.txHash) : null;
  };

  return React.createElement("div", null,
    React.createElement("div", { className: "stats-row" },
      React.createElement(Stat, { label: t.totalReceived, value: "$" + received.toFixed(2), color: "#22c55e" }),
      React.createElement(Stat, { label: t.totalRefunded, value: "$" + refunded.toFixed(2), color: "#ef4444" }),
      React.createElement(Stat, { label: t.netRevenue, value: "$" + (received - refunded).toFixed(2), color: "#6366f1" }),
    ),
    React.createElement("h3", { className: "section-title", style: { marginTop: 24 } }, t.recentTx),
    React.createElement("div", { className: "table-wrap" },
      React.createElement("table", { className: "tx-table" },
        React.createElement("thead", null,
          React.createElement("tr", null,
            [t.time, t.client, t.amount, t.chain, t.type, t.status, t.explorer].map((h) =>
              React.createElement("th", { key: h }, h)
            )
          )
        ),
        React.createElement("tbody", null,
          audit.length === 0
            ? React.createElement("tr", null, React.createElement("td", { colSpan: 7, className: "empty" }, t.noTx))
            : [...audit].reverse().map((e, i) => {
              const st = getStatus(e.event);
              const exp = getExplorer(e);
              return React.createElement("tr", { key: i },
                React.createElement("td", { className: "mono" }, fmtTime(e.timestamp)),
                React.createElement("td", null, e.data?.clientName || e.data?.client || "-"),
                React.createElement("td", null, e.data?.amount ? (e.data.amount + " " + (e.data.currency || "")) : "-"),
                React.createElement("td", null, e.data?.chain
                  ? React.createElement("span", { className: "tag tag-chain" }, e.data.chain) : "-"),
                React.createElement("td", null, React.createElement("span", { className: "tag tag-type" }, getType(e.event))),
                React.createElement("td", null, React.createElement("span", { className: `tag tag-${st}` }, st)),
                React.createElement("td", null, exp
                  ? React.createElement("a", { href: exp, target: "_blank", rel: "noopener", className: "explorer-link" }, "View")
                  : "-"),
              );
            })
        ),
      ),
    ),
  );
}

// ── SCREEN 3: Settings ──────────────────────────────

function SettingsScreen({ t, merchant }) {
  const [autoWindow, setAutoWindow] = useState(merchant?.policy?.autoWindow || "72h");
  const [autoUnder, setAutoUnder] = useState(String(merchant?.policy?.autoUnder || "50"));
  const [maxRefunds, setMaxRefunds] = useState(
    merchant?.policy?.maxRefunds === -1 ? "unlimited" : String(merchant?.policy?.maxRefunds || "3")
  );
  const [saved, setSaved] = useState(false);
  const [connStatus, setConnStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const testConn = async () => {
    setTesting(true);
    try {
      const res = await fetch(API + "/health");
      setConnStatus(res.ok ? "ok" : "fail");
    } catch { setConnStatus("fail"); }
    setTesting(false);
  };

  const webhookUrl = `https://clawrevert-production.up.railway.app/hooks/${merchant?.merchantId || "your-merchant-id"}`;

  return React.createElement("div", null,
    React.createElement("h3", { className: "section-title" }, t.editPolicy),
    React.createElement("div", { className: "form-grid" },
      React.createElement("div", { className: "form-group" },
        React.createElement("label", null, t.autoWindow),
        React.createElement("select", { value: autoWindow, onChange: (e) => setAutoWindow(e.target.value) },
          React.createElement("option", { value: "24h" }, t.h24),
          React.createElement("option", { value: "72h" }, t.h72),
          React.createElement("option", { value: "7d" }, t.d7),
        ),
      ),
      React.createElement("div", { className: "form-group" },
        React.createElement("label", null, t.autoUnder),
        React.createElement("select", { value: autoUnder, onChange: (e) => setAutoUnder(e.target.value) },
          React.createElement("option", { value: "10" }, "$10"),
          React.createElement("option", { value: "50" }, "$50"),
          React.createElement("option", { value: "200" }, "$200"),
        ),
      ),
      React.createElement("div", { className: "form-group" },
        React.createElement("label", null, t.maxRefunds),
        React.createElement("select", { value: maxRefunds, onChange: (e) => setMaxRefunds(e.target.value) },
          React.createElement("option", { value: "1" }, "1"),
          React.createElement("option", { value: "2" }, "2"),
          React.createElement("option", { value: "3" }, "3"),
          React.createElement("option", { value: "unlimited" }, t.unlimited),
        ),
      ),
    ),
    React.createElement("button", { className: "btn-primary", onClick: save, style: { marginTop: 12 } },
      saved ? t.saved : t.savePolicy),

    React.createElement("div", { className: "settings-section" },
      React.createElement("h3", { className: "section-title" }, t.whatsappConnected),
      React.createElement("div", { className: "mono dim" }, merchant?.whatsapp || "-"),
    ),

    React.createElement("div", { className: "settings-section" },
      React.createElement("h3", { className: "section-title" }, t.webhookUrl),
      React.createElement("p", { className: "dim", style: { marginBottom: 8, fontSize: 12 } }, t.webhookHint),
      React.createElement("div", { className: "webhook-box" },
        React.createElement("code", null, webhookUrl),
        React.createElement(CopyBtn, { text: webhookUrl, t }),
      ),
    ),

    React.createElement("div", { className: "settings-section" },
      React.createElement("button", { className: "btn-secondary", onClick: testConn, disabled: testing },
        testing ? t.testing : t.testConnection),
      connStatus && React.createElement("span", {
        className: `conn-status ${connStatus === "ok" ? "conn-ok" : "conn-fail"}`,
        style: { marginLeft: 12 },
      }, connStatus === "ok" ? t.connected : t.disconnected),
    ),

    merchant?.merchantId && React.createElement("div", { className: "settings-section" },
      React.createElement("h3", { className: "section-title" }, t.merchantId),
      React.createElement("div", { className: "mono dim" }, merchant.merchantId),
    ),
  );
}

// ── App ─────────────────────────────────────────────

function App() {
  const [lang, setLang] = useState("en");
  const [tab, setTab] = useState("onboarding");
  const [merchant, setMerchant] = useState(null);
  const t = T[lang];

  // Switch to dashboard after registration
  useEffect(() => {
    if (merchant && tab === "onboarding") {
      // Stay on onboarding to show wallets, user can navigate
    }
  }, [merchant]);

  return React.createElement("div", { className: "app" },
    // Header
    React.createElement("header", null,
      React.createElement("div", { className: "header-left" },
        React.createElement("div", { className: "logo" },
          React.createElement("span", { className: "logo-k" }, "Klaw"),
          React.createElement("span", null, "Pay"),
        ),
        merchant && React.createElement("span", { className: "merchant-name" }, merchant.businessName),
      ),
      React.createElement("div", { className: "lang-select" },
        ["en", "es", "pt"].map((l) =>
          React.createElement("button", {
            key: l, onClick: () => setLang(l),
            className: `lang-btn ${lang === l ? "lang-active" : ""}`,
          }, l.toUpperCase())
        ),
      ),
    ),

    // Tabs
    React.createElement("nav", { className: "tabs" },
      React.createElement(Tab, { active: tab === "onboarding", label: t.onboarding, onClick: () => setTab("onboarding") }),
      React.createElement(Tab, { active: tab === "dashboard", label: t.dashboard, onClick: () => setTab("dashboard") }),
      React.createElement(Tab, { active: tab === "settings", label: t.settings, onClick: () => setTab("settings") }),
    ),

    // Content
    React.createElement("main", { className: "content" },
      tab === "onboarding" && React.createElement(Onboarding, { t, merchant, setMerchant }),
      tab === "dashboard" && React.createElement(DashboardScreen, { t, merchant }),
      tab === "settings" && React.createElement(SettingsScreen, { t, merchant }),
    ),
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
