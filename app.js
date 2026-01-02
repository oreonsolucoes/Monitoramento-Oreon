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
let chartInstance = null;

// RENDERIZAÇÃO
function render(data) {
    if (!data) return;
    const grid = document.getElementById('grid-clientes');

    for (let cid in data) {
        let card = document.getElementById(`card-${cid}`);
        const info = data[cid].stats;
        if (!info) continue;

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
                    <div class="bg-black/40 p-3 rounded-2xl text-center border border-white/5">
                        <p class="text-[7px] text-slate-500 font-bold uppercase">CPU</p>
                        <p id="cpu-${cid}" class="text-xs font-black text-blue-400">--</p>
                    </div>
                    <div class="bg-black/40 p-3 rounded-2xl text-center border border-white/5">
                        <p class="text-[7px] text-slate-500 font-bold uppercase">RAM</p>
                        <p id="ram-${cid}" class="text-xs font-black text-purple-400">--</p>
                    </div>
                    <div class="bg-black/40 p-3 rounded-2xl text-center border border-white/5">
                        <p class="text-[7px] text-slate-500 font-bold uppercase">Boot</p>
                        <p id="boot-${cid}" class="text-xs font-black text-green-500">--</p>
                    </div>
                </div>
                <div class="mb-6">
                    <p class="text-[8px] text-slate-600 font-black uppercase mb-2 tracking-widest">Rede / Dispositivos</p>
                    <div id="ips-${cid}" class="space-y-1"></div>
                </div>
                <div>
                    <p class="text-[8px] text-slate-600 font-black uppercase mb-2 tracking-widest">Processos Ativos</p>
                    <div id="procs-${cid}" class="max-h-64 overflow-y-auto space-y-1 pr-1"></div>
                </div>
            `;
            grid.appendChild(card);
        }

        // Atualizar Textos
        const updateText = (id, val) => { const el = document.getElementById(id); if(el && el.textContent !== val) el.textContent = val; };
        updateText(`sinc-${cid}`, `SINC: ${info.last_seen}`);
        updateText(`cpu-${cid}`, info.hardware.cpu);
        updateText(`ram-${cid}`, info.hardware.ram);
        updateText(`boot-${cid}`, info.hardware.boot);

        // Atualizar IPs (Rede)
        if (info.dispositivos) {
            const ipContainer = document.getElementById(`ips-${cid}`);
            for (let nome in info.dispositivos) {
                const dev = info.dispositivos[nome];
                let ipRow = ipContainer.querySelector(`[data-nome="${nome}"]`);
                const ipMarkup = `
                    <p class="text-[9px] font-bold text-white uppercase">${nome}</p>
                    <span class="text-[8px] font-black ${dev.status === 'online' ? 'text-green-500' : 'text-red-600'} uppercase">${dev.lat}ms</span>
                `;
                if (!ipRow) {
                    ipRow = document.createElement('div');
                    ipRow.className = "flex justify-between items-center bg-black/20 p-2 rounded-xl border border-white/5 cursor-pointer hover:bg-black/40";
                    ipRow.dataset.nome = nome;
                    ipRow.onclick = () => window.abrirGrafico(cid, nome, dev.ip);
                    ipRow.innerHTML = ipMarkup;
                    ipContainer.appendChild(ipRow);
                } else if (ipRow.innerHTML !== ipMarkup) {
                    ipRow.innerHTML = ipMarkup;
                }
            }
        }

        // Atualizar Processos (Mesma lógica do anterior)
        const procContainer = document.getElementById(`procs-${cid}`);
        const pids = info.processos.map(p => p.pid.toString());
        Array.from(procContainer.children).forEach(c => { if(!pids.includes(c.dataset.pid)) c.remove(); });
        info.processos.forEach(p => {
            let pRow = procContainer.querySelector(`[data-pid="${p.pid}"]`);
            const pMarkup = `<span class="truncate w-24">${p.name}</span><div class="flex items-center gap-2"><span>${p.memory_percent.toFixed(1)}%</span><i onclick="window.cmd('${cid}', 'KILL', ${p.pid})" class="fas fa-times text-red-900 hover:text-red-500 cursor-pointer"></i></div>`;
            if(!pRow) {
                pRow = document.createElement('div'); pRow.className = "proc-item"; pRow.dataset.pid = p.pid; pRow.innerHTML = pMarkup; procContainer.appendChild(pRow);
            } else if(pRow.innerHTML !== pMarkup) { pRow.innerHTML = pMarkup; }
        });
    }
}

// GRÁFICOS
window.abrirGrafico = (cid, nome, ip) => {
    document.getElementById('detalhe-nome').innerText = nome;
    document.getElementById('detalhe-ip').innerText = ip;
    document.getElementById('modal-detalhes').classList.replace('hidden', 'flex');
    // Aqui você pode adicionar a lógica de carregar histórico do Firebase se desejar
};

window.fecharDetalhes = () => document.getElementById('modal-detalhes').classList.replace('flex', 'hidden');

// Auth e Boot (Igual ao anterior)
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-scr').classList.add('hidden');
        document.getElementById('dash-scr').classList.replace('hidden', 'flex');
        onValue(ref(db, 'monitoramento/'), (snap) => render(snap.val()));
    }
});
document.getElementById('btn-login').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('pass').value);
