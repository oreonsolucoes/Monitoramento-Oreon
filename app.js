import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD17hUBK6pY-E_hT9h8Nr0tyPp-5aBT4ZI",
    authDomain: "oreon-monitoramento.firebaseapp.com",
    databaseURL: "https://oreon-monitoramento-default-rtdb.firebaseio.com",
    projectId: "oreon-monitoramento",
    appId: "1:844248167462:web:eaedb32e3d78b60bd722e7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// LOGIN / LOGOUT
document.getElementById('btn-login').onclick = () => {
    signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('pass').value);
};
document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-scr').classList.add('hidden');
        document.getElementById('dash-scr').classList.replace('hidden', 'flex');
        onValue(ref(db, 'monitoramento/'), (snap) => render(snap.val()));
    }
});

// FUNÇÃO DE RENDERIZAÇÃO (ANTI-PISCADA)
function render(data) {
    if (!data) return;
    const grid = document.getElementById('grid-clientes');

    for (let cid in data) {
        let card = document.getElementById(`card-${cid}`);
        const info = data[cid].stats;
        if (!info) continue;

        // Criar card se não existir
        if (!card) {
            card = document.createElement('div');
            card.id = `card-${cid}`;
            card.className = "card-monitor";
            card.innerHTML = `
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-black italic text-white uppercase">${cid}</h3>
                    <span id="sinc-${cid}" class="text-[9px] text-blue-500 font-bold">--</span>
                </div>
                <div class="grid grid-cols-3 gap-2 mb-6">
                    <div class="bg-black/40 p-3 rounded-2xl text-center">
                        <p class="text-[7px] text-slate-500 font-bold uppercase">CPU</p>
                        <p id="cpu-${cid}" class="text-xs font-black text-blue-400">--</p>
                    </div>
                    <div class="bg-black/40 p-3 rounded-2xl text-center">
                        <p class="text-[7px] text-slate-500 font-bold uppercase">RAM</p>
                        <p id="ram-${cid}" class="text-xs font-black text-purple-400">--</p>
                    </div>
                    <div class="bg-black/40 p-3 rounded-2xl text-center">
                        <p class="text-[7px] text-slate-500 font-bold uppercase">Boot</p>
                        <p id="boot-${cid}" class="text-xs font-black text-green-500">--</p>
                    </div>
                </div>
                <div id="procs-${cid}" class="max-h-80 overflow-y-auto space-y-1"></div>
            `;
            grid.appendChild(card);
        }

        // Atualizar textos fixos (SÓ TROCA SE FOR DIFERENTE)
        const updateText = (id, val) => {
            const el = document.getElementById(id);
            if (el.textContent !== val) el.textContent = val;
        };

        updateText(`sinc-${cid}`, `SINC: ${info.last_seen}`);
        updateText(`cpu-${cid}`, info.hardware.cpu);
        updateText(`ram-${cid}`, info.hardware.ram);
        updateText(`boot-${cid}`, info.hardware.boot);

        // Atualizar lista de processos (RECONCILIAÇÃO)
        const container = document.getElementById(`procs-${cid}`);
        const novosPids = info.processos.map(p => p.pid.toString());

        // 1. Remove quem saiu da lista
        Array.from(container.children).forEach(child => {
            if (!novosPids.includes(child.dataset.pid)) child.remove();
        });

        // 2. Atualiza ou Adiciona
        info.processos.forEach(p => {
            let pRow = container.querySelector(`[data-pid="${p.pid}"]`);
            const pMarkup = `
                <span class="font-bold uppercase truncate w-24">${p.name}</span>
                <div class="flex items-center gap-3">
                    <span class="text-slate-400">${p.memory_percent.toFixed(1)}%</span>
                    <i onclick="window.cmd('${cid}', 'KILL', ${p.pid})" class="fas fa-times text-red-800 hover:text-red-500 cursor-pointer"></i>
                </div>
            `;

            if (!pRow) {
                pRow = document.createElement('div');
                pRow.className = "proc-item";
                pRow.dataset.pid = p.pid;
                pRow.innerHTML = pMarkup;
                container.appendChild(pRow);
            } else {
                if (pRow.innerHTML !== pMarkup) pRow.innerHTML = pMarkup;
            }
        });
    }
}

window.cmd = (cid, acao, pid) => {
    if (confirm(`${acao} processo ${pid}?`)) {
        set(ref(db, `monitoramento/${cid}/cmd`), { acao, pid, timestamp: Date.now() });
    }
};